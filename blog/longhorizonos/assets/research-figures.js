/* The plots read frozen local evidence. No provider or model call is made. */
(() => {
  'use strict';
  const script = document.currentScript;
  const defaultURL = script && script.src ? new URL('evidence.json', script.src).href : '../assets/evidence.json';
  const roots = [...document.querySelectorAll('[data-evidence-view]')];
  if (!roots.length) return;
  const has = value => value !== null && value !== undefined;
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : 'not available';
  const string = value => has(value) ? String(value) : 'not available';
  const el = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (has(value)) node.textContent = value; return node; };
  const unavailable = (node, message) => node.replaceChildren(el('p', 'rf-unavailable', `not available · ${message}`));
  const armName = id => ({joint:'准备感知排序（joint）',checkpoint_retrieval:'执行成本排序（忽略 P）'}[id] || string(id));
  const version = value => has(value) ? String(value).replace(/^v?/i, 'v') : '版本 not available';
  const phaseValue = (row, keys) => { for (const key of keys) if (has(row[key])) return row[key]; return null; };
  function trace(root, evidence) {
    const data = evidence.offline_trace;
    const content = root.querySelector('[data-trace-content]');
    if (!data || !Array.isArray(data.arms) || !data.arms.length) { unavailable(content, '没有 offline_trace.arms 记录'); root.querySelector('[data-trace-meta]').textContent = '数据 not available'; return; }
    root.querySelector('[data-trace-meta]').textContent = `预算 ${number(data.budget_seconds)} s · seed ${string(data.seed)} · API ${number(data.provider_calls)}`;
    root.querySelector('[data-trace-provenance]').textContent = `measurement_valid = ${string(data.measurement_valid)}`;
    const switcher = root.querySelector('[data-arm-switch]');
    const buttons = data.arms.map((arm, index) => {
      const button = el('button', '', arm.arm === 'joint' ? '准备感知排序' : arm.arm === 'checkpoint_retrieval' ? '执行成本排序' : armName(arm.arm || arm.id));
      button.setAttribute('aria-label', arm.public_label || arm.label || armName(arm.arm || arm.id));
      button.type = 'button'; button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => { buttons.forEach((item, itemIndex) => item.setAttribute('aria-pressed', String(itemIndex === index))); show(arm); });
      return button;
    });
    switcher.replaceChildren(...buttons);
    function show(arm) {
      const phases = arm.phases;
      if (!Array.isArray(phases) || !phases.length) { unavailable(content, '该臂没有 phase 记录'); return; }
      const fragment = document.createDocumentFragment();
      const policy = arm.selection_policy || arm.arm;
      fragment.append(el('p', 'rf-trace-policy', policy === 'joint' ? '排序分数 G / (P + E) · 首先选择准备成本更低的 audit' : policy === 'checkpoint_retrieval' ? '排序分数 G / E · 分数相同时沿既定顺序选择 pricing_core' : '排序策略 not available'));
      const versions = [...new Set(phases.map(row => row.version).filter(has))];
      const path = el('div', 'rf-version-path'); path.append(el('span', '', '输入版本'));
      versions.forEach((value, index) => { if (index) path.append(el('span', '', '→')); path.append(el('span', 'rf-version-pill', version(value))); });
      if (!versions.length) path.append(el('span', '', 'not available'));
      fragment.append(path);
      const head = el('div', 'rf-timeline-head'); ['#','Phase / 动作','版本','结果','请求 bytes'].forEach(value => head.append(el('span','',value))); fragment.append(head);
      const list = el('ol', 'rf-timeline');
      phases.forEach((phase, index) => {
        if (index && has(phase.version) && phases[index - 1].version !== phase.version) {
          const change = el('li', 'rf-trace-change', `输入切换：${version(phases[index - 1].version)} → ${version(phase.version)}`);
          if (Array.isArray(phase.state_before?.done_actions)) change.append(el('span', '', `此时已完成：${phase.state_before.done_actions.join(', ') || '无'}`));
          list.append(change);
        }
        const row = el('li', 'rf-trace-row');
        row.append(el('span', 'rf-trace-index', String(index + 1)));
        const action = el('div', 'rf-trace-action'); action.append(el('code', '', string(phase.action_id)));
        const required = phaseValue(phase, ['required_inputs','demand_count']);
        const cover = phaseValue(phase, ['selected_cover','selected_ids']);
        const items = [];
        if (Array.isArray(required)) items.push(`需求 ${required.length}`);
        else if (typeof required === 'number') items.push(`需求 ${required}`);
        if (Array.isArray(cover)) items.push(`覆盖 ${cover.length}`);
        else if (typeof cover === 'number') items.push(`覆盖 ${cover}`);
        const label = phase.label || (typeof phase.phase === 'string' ? phase.phase : null);
        if (label) items.unshift(label);
        if (items.length) { action.append(el('small', '', items.join(' · '))); action.title = items.join(' · '); }
        row.append(action, el('span', 'rf-version-pill', version(phase.version)));
        const status = el('div', 'rf-trace-state', phase.status === 'verified' ? '已验证' : string(phase.status));
        const prep = phaseValue(phase, ['preparation_cost','preparation_cost_units']);
        const work = phaseValue(phase, ['declared_work_units','work_units']);
        const cost = []; if (typeof prep === 'number') cost.push(`P ${number(prep)}`); if (typeof work === 'number') cost.push(`P+E ${number(work)}`);
        if (cost.length) { const summary=el('small','rf-trace-work'); summary.append(el('span','rf-work-detail',cost.join(' · ')),el('span','rf-work-short',`工量 ${number(work)}`)); status.append(summary); }
        row.append(status);
        const bytes = el('div', 'rf-trace-bytes', number(phase.request_bytes)); bytes.append(el('small', '', 'UTF-8 bytes')); row.append(bytes); list.append(row);
      });
      fragment.append(list);
      const final = arm.final || {};
      const summary = el('dl', 'rf-final-summary');
      const summaryValues = [['累计请求 · UTF-8 bytes', number(final.request_bytes)], ['累计声明工作单位', number(final.declared_work_units)], [`独立测试 · ${number(final.verified_phase_count)} phases`, typeof final.independent_test_pass === 'boolean' ? (final.independent_test_pass ? '通过（fixture）' : '未通过（fixture）') : 'not available']];
      summaryValues.forEach(([label, value]) => { const cell = el('div'); cell.append(el('dt','',label),el('dd',label.startsWith('独立') && final.independent_test_pass ? 'rf-result-yes' : '', value)); summary.append(cell); });
      fragment.append(summary);
      const comparison = el('div', 'rf-trace-totals');
      data.arms.forEach(other => {
        const totals = other.final || {};
        comparison.append(el('p', '', `${other.public_label || armName(other.arm)}：${number(totals.request_bytes)} bytes / ${number(totals.declared_work_units)} 声明工作单位`));
      });
      const baseline = data.arms.find(item => item.arm === 'checkpoint_retrieval')?.final;
      const joint = data.arms.find(item => item.arm === 'joint')?.final;
      if (baseline && joint && has(baseline.request_bytes) && has(joint.request_bytes) && has(baseline.declared_work_units) && has(joint.declared_work_units) && joint.request_bytes >= baseline.request_bytes && joint.declared_work_units >= baseline.declared_work_units) comparison.append(el('strong', '', '两臂累计请求约相同，本例未体现总量节省。'));
      fragment.append(comparison); content.replaceChildren(fragment);
    }
    show(data.arms[0]);
  }
  function scaling(root, evidence) {
    const data = evidence.planner_scaling;
    const content = root.querySelector('[data-scaling-content]');
    if (!data || !Array.isArray(data.rows) || !data.rows.length) { unavailable(content, '没有 planner_scaling.rows 记录'); root.querySelector('[data-scaling-meta]').textContent = '数据 not available'; return; }
    root.querySelector('[data-scaling-meta]').textContent = `Pareto cover DP · API ${number(data.provider_calls)} · cap ${number(data.cap)}`;
    root.querySelector('[data-scaling-provenance]').textContent = data.data_kind === 'synthetic_declared_contracts_not_agent_reward' ? '合成声明合同 · 非 Agent reward' : string(data.data_kind);
    const counts = data.rows.flatMap(row => [row.factorized?.labels_explored,row.monolithic_same_solver?.labels_explored]).filter(value => typeof value === 'number' && value >= 0);
    const maximum = Math.max(1,...counts);
    const legend = el('div', 'rf-scaling-legend');
    [['分解','rf-swatch-exec'],['整体 · 同一求解器','rf-swatch-mono']].forEach(([label, css]) => { const span = el('span'); span.append(el('i',`rf-swatch ${css}`),document.createTextNode(label)); legend.append(span); });
    const table = el('table','rf-scaling-table'); const caption = el('caption','','实际 DP 转移次数；同一行使用相同需求与成本。'); table.append(caption);
    const thead = el('thead'); const headers = el('tr'); ['需求结构 / 数量','分解 · 转移次数','整体 · 转移次数'].forEach(label => { const cell = el('th','',label); cell.scope='col'; headers.append(cell); }); thead.append(headers); table.append(thead);
    const tbody = el('tbody'); let previousTopology = null;
    data.rows.forEach(item => {
      const row = el('tr'); row.dataset.newTopology = String(item.topology !== previousTopology); previousTopology = item.topology;
      row.dataset.representative = String((item.topology === 'disconnected' && [8,12,64].includes(item.required_inputs)) || (item.topology === 'connected' && [8,12].includes(item.required_inputs)));
      row.hidden = row.dataset.representative !== 'true';
      const topology = el('th','rf-topology',({disconnected:'独立需求',connected:'连通图',chain:'链状',dense:'稠密'}[item.topology] || string(item.topology))); topology.scope = 'row';
      topology.append(el('span','',`${number(item.required_inputs)} 个需求`)); row.append(topology);
      [['factorized',false],['monolithic_same_solver',true]].forEach(([key,isMono]) => {
        const result = item[key] || {}; const cell = el('td','rf-label-cell'); const count = el('div','rf-label-count'); count.append(el('span','',number(result.labels_explored)));
        const capped = result.capped === true || result.status === 'capped';
        if (capped) { const flag = el('small','rf-capped','capped'); flag.title = result.reason || '达到 DP 转移复杂度上限；未完成求解'; count.append(flag); }
        else count.append(el('small','',result.status === 'exact' ? 'exact' : string(result.status)));
        cell.append(count);
        if (typeof result.labels_explored === 'number') { const track = el('div','rf-count-track'); track.setAttribute('aria-hidden','true'); const bar = el('i',`rf-count-bar${isMono ? ' rf-count-mono' : ''}`); bar.style.width = `${Math.min(100,result.labels_explored / maximum * 100)}%`; bar.dataset.capped=String(capped); track.append(bar); cell.append(track); }
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(tbody); const foot = el('div','rf-scaling-foot',`统一条长标尺：0 → ${number(maximum)} 次转移。exact = 完整求解；capped = 触及上限。`);
    const toggle = el('button','rf-scaling-toggle',`展开全部 ${data.rows.length} 组实例`); toggle.type='button'; toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click',()=>{const expand=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expand));[...tbody.children].forEach(row=>{row.hidden=!expand && row.dataset.representative!=='true';});toggle.textContent=expand?'收起为 5 组代表实例':`展开全部 ${data.rows.length} 组实例`;});
    content.replaceChildren(legend,table,toggle,foot);
  }
  const requests = new Map();
  roots.forEach(root => {
    const url = root.dataset.evidenceUrl || defaultURL;
    if (!requests.has(url)) requests.set(url, fetch(url,{credentials:'same-origin'}).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }));
    requests.get(url).then(data => { if (root.dataset.evidenceView === 'trace') trace(root,data); else scaling(root,data); }).catch(() => {
      const content = root.querySelector('[data-trace-content],[data-scaling-content]'); unavailable(content,'无法读取冻结 evidence.json');
      const meta = root.querySelector('[data-trace-meta],[data-scaling-meta]'); if (meta) meta.textContent = '数据 not available';
    });
  });
})();
