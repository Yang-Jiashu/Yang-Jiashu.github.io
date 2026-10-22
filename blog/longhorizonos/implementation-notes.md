# LongHorizonOS：图中机制与实现对照

核对日期：2026-10-22。此表对应本地候选工作源的代码审阅；公开仓库的不同分支或旧版本不一定包含同一实现。表中“已有实现”不等于默认启用、所有入口统一接通、经过真实模型收益验证，亦不等于原创算法贡献。

## 执行与资源调度

| 图中机制 | 实现位置（相对 `src/lhos/`） | 范围与边界 |
| --- | --- | --- |
| 就绪前沿、关键路径与解锁值 | `sdk/graph_analysis.py:404`，`IncrementalGraphAnalyzer` | 缓存结构索引与分析结果；有效性变化时更新相关区域，结构变化时重建。分析谓词等价的状态转换可跳过无效重算，不抑制真实失效。 |
| 邻接索引与批量图计算 | `graph/queries.py:34`；`graph/critical_path.py:57,90` | 入/出边按邻接度查询，关键路径用拓扑 DP；解锁计数采用位集并释放不再需要的中间掩码。关键路径 DP 为 O(V+E)，不能把全部位集计算也写成这个复杂度。 |
| 可选图效用排序 | `sdk/frontier_policy.py:154,290` | 默认修复优先并使用确定性字典序；graph-utility 是显式可选策略，利用关键路径位置与即时解锁值。 |
| 估计进展与计算预算排序 | `sdk/compute_budget.py:681` | 修复优先，再比较 `(进展×成功率×稳定率)/(成本+预期返工)` 的声明估计；估计来自调用方，未知保持未知。与 legacy `runtime/cost_aware_scheduler.py` 的加权打分属于不同 profile。 |
| 冲突、预算、资源联合选批 | `sdk/unified_policy.py:177,398` | 同一选批过程检查已声明约束；仅实际选中者扣减预算与逻辑容量。策略无副作用，规划不等于取得执行权。确定性贪心，不保证全局最优。 |
| 稳定性过滤、并行度与退避 | `sdk/parallelism_policy.py:221,245`；`sdk/streaming_policy.py:49,119` | 选批前考虑上游反复变化及在途冲突；退避降低并行度后重新选批记账。未知读写不能当作独立访问。 |
| 流式补位 | `sdk/os.py:4432` | 显式启用 streaming 与 adaptive 后，工作槽释放时取得最新状态并重新准入，避免整批屏障；不退回未过滤派发。容量释放不退还已经发生的计算成本。 |
| 权威准入与执行所有权 | `runtimes/multi_agent/scheduler.py:1276,1684,1929` | 在调度锁内重新检查 graph version、ready 状态、进程与资源，预留容量并取得 Claim/Lease；执行成功与语义验证分开，不能由策略提议直接宣告完成。 |

## 上下文与恢复

这些是不同入口可选的组件，图中虚线框刻意不表示它们已在一个默认原生 harness 中全部串联。

| 图中机制 | 实现位置（相对 `src/lhos/`） | 范围与边界 |
| --- | --- | --- |
| 语义记忆与依赖闭包 | `integrations/harness/semantic_memory.py:1056,1211` | 先保留必需约束、活跃 next_step 与完整依赖闭包，再按匹配/图信号/陈旧度选择可选闭包并展开原始摘录。必需闭包放不下时拒绝不完整交接。Agent 声明不自动升级为外部验证证据。 |
| 交接分组编码 | `integrations/harness/handoff_compiler.py:439,537` | 在受限来源分区和加性成本模型下选择单项/分组编码；限时、解码往返校验，长度不增才应用，否则回退。是可选 compiler profile，默认 legacy；不宣称普遍最优压缩。 |
| 需求覆盖规划 | `agent_os/context/demand.py:243,267,397` | 按当前来源版本过滤表示；按需求—表示关联拆组件，同覆盖保留低成本表示，再用位集 DP；有内容寻址 LRU 和复杂度上限。优化的是声明成本，常用字节，不等于供应商 token 最优；不默认由所有入口启用。 |
| 分页、驻留与快照恢复 | `agent_os/context/service.py:69,435,571,627,780` | 复用不可变版本字节/哈希，required 与 pinned 页受保护；恢复重新核对来源与页哈希。各淘汰 policy 单独选择，不是同时运行。 |
| 换窗准入 | `integrations/harness/context_transition.py:39`；`working_set_adapter.py:366,447` | 检查记忆覆盖和语义缺口；剩余墙钟时间须容纳残余准备与一次调用的耗时代理。未满足时 resume；已完成准备不重复扣计。不是 reward 预测器或精确 token 最优器。 |
| 有限合同下的动态需求 | `agent_os/context/lifecycle.py:189,336` | 使用 source→signal→rule 和按值倒排索引，只重算相关规则；冲突值拒绝，旧观察变 stale。是 SDK/JSON 合同原型；`lifecycle_workspace.py:254` 仍提前读取所有 guard sources，不声称按可达分支延迟观察已经实现。 |

## 图 3 的含义

图 3 是按联合准入约束构造的规则示例：总容量 2，A 请求 3 且分别与 B/C 冲突；B、C 各请求 1 且互相相容。跳过 A 后可以选 B+C。它说明为何不能独立选取后简单求交集，不是 benchmark、吞吐或 reward 的测量结果，也不证明贪心在任意实例中最优。

## 实际接入边界

- SDK 的预算、资源、自适应并行和 streaming 已有组合接线，仍需显式配置和有效声明输入。
- 原生 DSH 的 working-set 默认关闭，启用受 memory-first 条件约束；交接 compiler 默认 legacy。
- 动态需求可经 `LifecycleSDKDispatcher` 接 SDK/模型端口和独立验证，文件明确为 opt-in workspace/JSON contract，不能据此宣称已经接管任意第三方 CLI 的隐藏状态与副作用。
- 真实系统收益须比较相同信息、相同模型与预算，保留输入总量、未缓存输入、缓存读取、输出、时间、失败和恢复成本；provider cache_read 不是本系统 memory/LRU 命中。

实现、算法新颖性和真实收益需要不同证据；此表仅记录机制实现与接入范围。
