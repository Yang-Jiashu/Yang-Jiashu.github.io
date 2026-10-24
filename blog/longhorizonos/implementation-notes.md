# LongHorizonOS：机制、证据与实验口径

更新于 2026-10-24。对应 2026-10-22 本地候选实现及其冻结实验包。公开仓库的旧版本不一定包含同一实现；代码位置不是在线效果证据。可公开的逐项证据与原文件 SHA-256 见 `assets/evidence.json`。

## 一个可以被推翻的命题

在相同输入、候选可行集、验证方式和时间预算下，让上下文准备成本参与动作排序，能否改善已验证进展与完整时间/token 成本之间的经验权衡？

若只改变了顺序，而任务质量没有改善、总成本没有下降，或效果变差，该工作流就不支持收益命题。本文不声称所有 harness 都存在同一损失，也不将该问题称为首次发现。

## 代码究竟控制什么

以下路径相对候选源码根目录；精确哈希由证据清单记录。

| 环节 | 实现 | 输入与输出 |
| --- | --- | --- |
| 动态需求 | `src/lhos/agent_os/context/lifecycle.py`、`src/lhos/integrations/models/lifecycle_workspace.py` | 按已注册的 source→signal→rule 更新需求；依赖由应用声明，非任意自然语言依赖的自动发现。 |
| 联合计划 | `src/lhos/agent_os/context/joint.py`，`JointActionContextPlanner.plan` | 输入动作、版本绑定表示、声明估计和容量；输出 `action_id`、`context_plan.selected_ids`、`total_work_units` 及拒绝原因。 |
| 持久执行 | `src/lhos/integrations/models/joint_dispatch.py`、`joint_journal.py` | 同一次决策绑定材料与动作；执行前预留，验证后提交，异常保留已发生成本。未决请求阻止不确定重放。 |
| 原生 phase | `src/lhos/integrations/harness/native_dsh_phase.py`，`NativeDSHPhaseExecutor.execute` | 在真实 SDK execution context 内调用既有 DSH adapter。一个 phase 可包含多次 provider/tool 调用，不能当作一个 HTTP 请求。 |
| 独立验证 | `src/lhos/benchmarks/joint_study.py`，`IndependentPytest` | 模型 UID 65534、验证器 UID 65533；输出测试与版本检查分开。native 使用 audit provenance，shell 内部 I/O 仍有 opaque 范围。 |

Graph 维护显式依赖与来源有效性；memory 保留持久材料；context 交付本轮输入。OS 的职责是管理这些状态的生命周期、资源准入、执行所有权、故障恢复及提交边界。它不能证明任意模型推理正确。

## 排序与单位

为每个动作求满足当前版本、上下文容量、完整请求容量、工作预算和逻辑资源约束的材料覆盖，再比较声明进展与成本。联合策略采用 `G/(P+E)`，对照采用 `G/E`。分数使用精确 Fraction，平局按确定性规则处理。

- G：声明进展，不是独立评估器测到的真实 reward。
- P 与 E：必须使用同一种声明工作单位，分别表示准备和执行估计。
- context/request：默认核算 UTF-8 字节，不按字符比例猜 token。
- provider usage：另记完整输入和输出；未知保留 unknown 与已知下界。

这是一轮决策的启发式。材料覆盖求解的精确性只针对有限、可加的声明成本模型，不推出长期全局最优。当前 pilot 的动作统一使用 G=1、E=1000、slot=1，P 默认来自表示 footprint；P 尚未校准为实测时间、token 或货币费用。

## 构造示例与相反案例

`assets/verify_example.py` 使用候选实现的真实 planner 复现两例，并用小规模穷举核对最优声明进展。它不调用 API/Docker。

| 示例 | 预算 | 动作（G/P/E） | 执行成本排序 | 准备感知排序 |
| --- | --- | --- | --- | --- |
| 正例 | 5 | A=3/3/2，B=C=2/0/2 | A，进展3、耗费5 | B+C，进展4、耗费4 |
| 反例 | 6 | A=10/5/1，B=7/2/2 | A，进展10、耗费6 | B，进展7、耗费4，剩余不足以执行A |

两例中两策略均检查完整成本能否容纳。反例表明，准备感知的单步比值也可能更差。原始结果见 `assets/declared-examples.json`。

复现命令（在冻结候选源码目录，Python 3.11+ 与依赖就绪后）：

```bash
PYTHONPATH=src:. python3 /path/to/verify_example.py --output /tmp/lhos-declared-examples.json
```

## 已有数据支持到哪里

| 证据 | 已支持 | 不支持 |
| --- | --- | --- |
| 最终包 546 项测试；相关源码回归 2615 passed、2个平台专属 skipped | 已测试的控制与异常合同 | 全项目绝无漏洞；在线模型兼容与效果 |
| 最终包 18/18 离线运行 | v1→v2、7 phase、不同首步、资源/lease释放 | 真实 reward/token/时间收益；所有试次均 `measurement_valid=false` |
| 两臂相同初始 artifact SHA 与候选成本 | 所示排序干预在同一声明输入基础上发生 | provider 内部随机性一致；两种策略最终效果相同或更优 |
| 图分解微基准 | 同一求解器在独立需求结构上的转移减少；两者均可解时覆盖与成本相同 | 任意结构都加速；触上限实例的时间加速比；原创算法或 Agent 效果 |

离线轨迹中的 v1 次序分别为 `core→audit→api→integration` 与 `audit→core→api→integration`。v2 只重做 `core→api→integration`，audit 保留；变化发生在全部 v1 完成之后。因此这条轨迹主要证明首步排序与局部失效接线，不能证明前瞻调度或长期复用带来的收益。

微基准的 `labels_explored` 是实际执行的 DP 转移计数，非不同状态数。分解与不分解使用相同 20,000 上限；触及上限记为未解。连通图仍可能出现指数开销，8需求实例两者均1,281次，12需求实例两者均触上限。该分解是经典图结构优化。

## 付费 pilot 的固定对照

默认是两种排序 × 300/900/1800秒 × 三次重复，共18 trials。两臂共享版本观察、上下文覆盖、可行性、验证、估计和资源，唯一干预是排序是否包含P。

代码中的对照标识是 `checkpoint_retrieval`，网页称“执行成本排序（忽略P）”。它是共享同一上下文机制的受控排序消融；本轮G/E相同，等价于既定次序。不能将它描述为击败通用checkpoint/检索系统的强基线。seed17/29/43是配对重复标签，不声称控制了provider内部随机种子。

Reward为 `(v1四个公开里程碑 + v2四个公开里程碑 + 最终隐藏测试)/9`。保留全部调用与失败成本，token未知不填0，任务超时保留，基础设施异常单独报告。旧46-case测评分数与此指标不可混用。

这轮真实实验能给出单工作流初步预算曲线。若要支持更广的系统贡献，还需区分：共享准备或未来材料需求是否真正改变决策成本；估计P与实测开销的对应关系；局部来源变化时的增量处理；相同信息下其他准备感知策略的表现。不能仅靠这18个试次声称这些问题均已解决。

## 既有系统优化的角色

增量图分析、邻接/倒排索引、需求覆盖、语义记忆闭包、准入、Claim/Lease、并行退避和流式补位，构成现有运行时基础。它们的入口和启用条件不同；本次主线只追踪联合计划到native phase这一路径。模块数量不能代替核心机制的归因实验，也不表示每项都是原创贡献。

## 来源

- 博客机制与成本表达参考：[Reactive Optimizers](https://xingjianbai.com/reactive-optimizers/)。它的在线结果属于原作者的实验，不属于本项目。
- 自动研究迭代场景参考：[ResearchBoost](https://ydove0324.github.io/hx_resume/blog/researchboost/)。
- 数据依据：冻结实验包验收记录、离线控制器账本/进度/SDK数据库，以及同求解器分解消融。完整相对来源与哈希在 `assets/evidence.json`。
