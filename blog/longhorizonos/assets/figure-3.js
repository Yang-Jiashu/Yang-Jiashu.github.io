(() => {
  'use strict';
  const script = document.currentScript;
  const url = new URL('evidence.json',script.src).href;
  const names = {pricing_core:'定价核心',audit:'审计',pricing_api:'API',integration:'集成'};
  const node = (tag,cls,text) => { const value=document.createElement(tag); if(cls)value.className=cls; if(text!==undefined)value.textContent=text; return value; };
  const format = value => typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US'):'未知';
  const chain = phases => { const list=node('ol','tr-chain'); phases.forEach((phase,index)=>{const item=node('li',index===0?'tr-first':''); item.title=`v${phase.version} · ${phase.action_id} · ${format(phase.request_bytes)} 字节`; item.append(node('span','tr-node-label',names[phase.action_id]||phase.action_id));list.append(item);});return list; };
  fetch(url,{credentials:'same-origin'}).then(response=>{if(!response.ok)throw new Error('missing');return response.json();}).then(evidence=>{
    const data=evidence.offline_trace;
    if(!data||!Array.isArray(data.arms)||data.arms.length!==2)throw new Error('invalid');
    document.querySelectorAll('.figure-trace').forEach(root=>{
      const mount=root.querySelector('.tr-mount'); const fragment=document.createDocumentFragment();
      const lanes=node('div','tr-lanes');
      data.arms.forEach(arm=>{
        const joint=arm.arm==='joint'; const lane=node('div','tr-lane'+(joint?' tr-lane-joint':''));
        const label=node('div','tr-lane-label',joint?'准备感知排序':'执行成本排序');label.append(node('small','',joint?'G / (P + E)':'G / E'));
        const phases=arm.phases.filter(phase=>phase.version===1); if(phases.length!==4)throw new Error('invalid_v1');
        lane.append(label,chain(phases));lanes.append(lane);
      }); fragment.append(lanes);
      const first=data.arms[0].phases.filter(phase=>phase.version===2);
      const second=data.arms[1].phases.filter(phase=>phase.version===2);
      if(first.length!==3||JSON.stringify(first.map(p=>p.action_id))!==JSON.stringify(second.map(p=>p.action_id)))throw new Error('invalid_v2');
      const change=node('div','tr-change');change.append(node('strong','','合同更新 v1 → v2'),node('span','','审计保持有效'));fragment.append(change);
      const common=node('div','tr-common');const label=node('div','tr-common-label','相同后续');label.append(node('small','','v2 · 两臂各执行 3 步'));common.append(label,chain(first));fragment.append(common);
      const totals=node('div','tr-costs');data.arms.forEach((arm,index)=>{if(index)totals.append(node('span','tr-cost-separator','≈'));const cost=node('div','tr-cost');cost.append(node('span','tr-cost-label',arm.arm==='joint'?'准备感知排序':'执行成本排序'),node('span','tr-cost-value',format(arm.final.request_bytes)),node('span','tr-cost-unit','字节'));totals.append(cost);});fragment.append(totals);
      fragment.append(node('p','tr-conclusion','累计外部请求包几乎一致，本例没有体现总体节省。'));
      const details=node('details','tr-details');details.append(node('summary','','查看 7 阶段账本与计量说明'));
      const ledger=node('div','tr-ledger');data.arms.forEach(arm=>{ledger.append(node('h4','',arm.arm==='joint'?'准备感知排序':'执行成本排序'));const table=node('table');const head=node('thead');const tr=node('tr');['阶段','版本 / 动作','请求字节','声明工量'].forEach(text=>tr.append(node('th','',text)));head.append(tr);table.append(head);const body=node('tbody');arm.phases.forEach((phase,index)=>{const row=node('tr');[index+1,`v${phase.version} · ${names[phase.action_id]||phase.action_id}`,format(phase.request_bytes),format(phase.declared_work_units)].forEach(text=>row.append(node('td','',text)));body.append(row);});table.append(body);ledger.append(table);});ledger.append(node('p','','数据来自合成候选的离线控制运行，未调用模型。大小为外部调用参数的 UTF-8 字节，不是 HTTP wire 或 token；measurement_valid=false。'));details.append(ledger);fragment.append(details);mount.replaceChildren(fragment);
    });
  }).catch(()=>document.querySelectorAll('.figure-trace .tr-mount').forEach(mount=>mount.replaceChildren(node('p','tr-loading','记录暂时不可用，请从文末下载数据；这里不填充示例值。'))));
})();
