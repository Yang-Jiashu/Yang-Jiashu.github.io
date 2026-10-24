(function () {
  "use strict";
  const script = document.currentScript;
  const dataURL = new URL("evidence.json", script.src);
  const roots = Array.from(document.querySelectorAll(".figure-scaling[data-cx-scaling]"));
  if (!roots.length) return;
  const number = new Intl.NumberFormat("en-US");
  const SVG_NS = "http://www.w3.org/2000/svg";
  const xmax = 128;
  const ymax = 40000;
  const xticks = [1, 4, 16, 64, 128];
  const yticks = [1, 10, 100, 1000, 20000];
  const x = n => Math.log2(n) / Math.log2(xmax);
  const y = n => 1 - Math.log(n) / Math.log(ymax);
  const cap = entry => entry.status === "capped" || entry.capped === true;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function path(svg, className, d) {
    const node = document.createElementNS(SVG_NS, "path");
    node.setAttribute("class", className);
    node.setAttribute("d", d);
    svg.append(node);
  }
  function chart(rows, topology) {
    const panel = element("section", "cx-chart");
    const heading = element("div", "cx-chart-heading");
    heading.append(element("strong", "", topology === "disconnected" ? "独立需求" : "连通需求"));
    heading.append(element("span", "", topology === "disconnected" ? "8 个规模" : "两种求解计数重合"));
    const body = element("div", "cx-chart-body");
    const plot = element("div", "cx-plot");
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    plot.append(svg);
    body.append(plot);
    for (const value of yticks) {
      const tick = element("span", "cx-y-tick" + (value === 20000 ? " cx-cap-tick" : ""), number.format(value));
      tick.style.top = y(value) * 100 + "%";
      body.append(tick);
    }
    for (const value of xticks) {
      const tick = element("span", "cx-x-tick", value);
      tick.style.left = x(value) * 100 + "%";
      body.append(tick);
    }
    for (const series of ["monolithic_same_solver", "factorized"]) {
      for (const row of rows) {
        const entry = row[series];
        const isFactor = series === "factorized";
        const isCapped = cap(entry);
        const isOverlap = isFactor && isCapped && cap(row.monolithic_same_solver);
        const marker = element("span", "cx-point " + (isFactor ? "cx-point-factor" : "cx-point-whole") + (isCapped ? " cx-point-cap" : "") + (isOverlap ? " cx-point-overlap" : ""));
        const label = `${row.required_inputs} 个需求，${isFactor ? "图分解" : "整体求解"}：${number.format(entry.labels_explored)} 次${isCapped ? "，达到上限，未完成" : "，已完成"}`;
        marker.style.left = x(row.required_inputs) * 100 + "%";
        marker.style.top = y(entry.labels_explored) * 100 + "%";
        marker.setAttribute("role", "img");
        marker.setAttribute("aria-label", label);
        marker.setAttribute("tabindex", "0");
        marker.title = label;
        plot.append(marker);
      }
    }
    panel.append(heading, body, element("p", "cx-axis-label", "需求数量 · 对数坐标（两图同尺）"));
    function draw() {
      const w = plot.clientWidth;
      const h = plot.clientHeight;
      if (!w || !h) return;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.replaceChildren();
      const xy = (n, v) => `${(x(n) * w).toFixed(2)},${(y(v) * h).toFixed(2)}`;
      for (const value of yticks) {
        path(svg, value === 20000 ? "cx-cap-rule" : "cx-grid", `M0,${y(value) * h}H${w}`);
      }
      path(svg, "cx-axis", `M0,0V${h}H${w}`);
      for (const series of ["monolithic_same_solver", "factorized"]) {
        let d = "";
        let continuous = false;
        for (const row of rows) {
          if (cap(row[series])) { continuous = false; continue; }
          d += `${continuous ? "L" : "M"}${xy(row.required_inputs, row[series].labels_explored)} `;
          continuous = true;
        }
        path(svg, "cx-series " + (series === "factorized" ? "cx-series-factor" : "cx-series-whole"), d);
      }
    }
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(draw).observe(plot);
    else window.addEventListener("resize", draw);
    requestAnimationFrame(draw);
    return panel;
  }
  function table(rows) {
    const details = element("details", "cx-scaling-details");
    details.append(element("summary", "", `查看完整 ${rows.length} 行记录`));
    const wrap = element("div", "cx-table-wrap");
    const table = element("table", "cx-scaling-table");
    table.append(element("caption", "", "DP 转移次数；△ 表示达到 20,000 次上限、未完成求解。"));
    const head = element("thead");
    const hr = element("tr");
    for (const label of ["拓扑", "需求数量", "图分解", "整体求解"]) {
      const th = element("th", "", label); th.scope = "col"; hr.append(th);
    }
    head.append(hr);
    const tbody = element("tbody");
    for (const row of rows) {
      const tr = element("tr");
      tr.append(element("td", "", row.topology === "disconnected" ? "独立" : "连通"), element("td", "", row.required_inputs));
      for (const key of ["factorized", "monolithic_same_solver"]) {
        const entry = row[key];
        const td = element("td", cap(entry) ? "cx-table-cap" : "", `${cap(entry) ? "△ " : ""}${number.format(entry.labels_explored)}${cap(entry) ? " · 未完成" : ""}`);
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(head, tbody); wrap.append(table); details.append(wrap);
    return details;
  }
  fetch(dataURL).then(response => {
    if (!response.ok) throw new Error("evidence unavailable");
    return response.json();
  }).then(data => {
    const scaling = data && data.planner_scaling;
    const rows = scaling && scaling.rows;
    if (!Array.isArray(rows) || rows.length !== 11 || scaling.cap !== 20000 || !rows.every(row =>
      ["connected", "disconnected"].includes(row.topology) && Number.isFinite(row.required_inputs) && row.required_inputs >= 1 && row.required_inputs <= xmax &&
      ["factorized", "monolithic_same_solver"].every(key => row[key] && ["exact", "capped"].includes(row[key].status) && Number.isFinite(row[key].labels_explored) && row[key].labels_explored >= 1 && row[key].labels_explored <= scaling.cap)
    )) throw new Error("invalid microbenchmark data");
    for (const root of roots) {
      const plots = element("div", "cx-scaling-plots");
      for (const topology of ["disconnected", "connected"]) {
        const subset = rows.filter(row => row.topology === topology).sort((a, b) => a.required_inputs - b.required_inputs);
        plots.append(chart(subset, topology));
      }
      root.querySelector("[data-cx-scaling-content]").replaceChildren(plots);
      root.append(table(rows));
      root.dataset.cxLoaded = "true";
    }
  }).catch(() => {
    for (const root of roots) {
      root.querySelector("[data-cx-scaling-content]").replaceChildren(element("p", "cx-scaling-unavailable", "数据不可用：微基准记录未能载入。"));
      root.dataset.cxLoaded = "unavailable";
    }
  });
}());
