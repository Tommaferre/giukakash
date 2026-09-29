/* ============================================================
   charts.js — grafici SVG senza dipendenze esterne
   ============================================================ */

const Charts = (() => {

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  // ---------------- LINE CHART (multi-serie) ----------------
  // series: [{ id, label, color, points: [cents,...] }], labels: [string,...]
  function lineChart(container, series, labels, opts = {}) {
    container.innerHTML = '';
    const width = container.clientWidth || 320;
    const height = opts.height || 180;
    const padL = 4, padR = 4, padT = 12, padB = 22;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const visible = series.filter(s => s.visible !== false);
    const allValues = visible.flatMap(s => s.points);
    let min = Math.min(0, ...allValues);
    let max = Math.max(...allValues, 0);
    if (min === max) { min -= 100; max += 100; }
    const range = max - min || 1;

    const n = labels.length;
    const stepX = n > 1 ? innerW / (n - 1) : 0;

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, class: 'chart-svg' });

    // linee guida orizzontali
    const gridLines = 3;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (innerH / gridLines) * i;
      svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, class: 'chart-grid' }));
    }

    function xFor(i) { return padL + stepX * i; }
    function yFor(v) { return padT + innerH - ((v - min) / range) * innerH; }

    visible.forEach(s => {
      if (!s.points.length) return;
      let d = '';
      s.points.forEach((v, i) => {
        const x = xFor(i), y = yFor(v);
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      });
      const isTotal = s.id === 'total';
      const path = svgEl('path', {
        d: d.trim(), fill: 'none', stroke: s.color,
        'stroke-width': isTotal ? 2.5 : 1.75,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        opacity: isTotal ? 1 : 0.85
      });
      svg.appendChild(path);

      if (isTotal) {
        // area sotto la curva totale
        const areaD = d.trim() + ` L${xFor(s.points.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${xFor(0)},${(padT + innerH).toFixed(1)} Z`;
        const area = svgEl('path', { d: areaD, fill: s.color, opacity: 0.08 });
        svg.insertBefore(area, path);
        // punto finale
        const lastX = xFor(s.points.length - 1), lastY = yFor(s.points[s.points.length - 1]);
        svg.appendChild(svgEl('circle', { cx: lastX, cy: lastY, r: 3.5, fill: s.color }));
      }
    });

    // etichette asse x (poche, per non affollare)
    const labelCount = Math.min(n, opts.maxLabels || 5);
    const labelStep = Math.max(1, Math.floor((n - 1) / (labelCount - 1 || 1)));
    for (let i = 0; i < n; i += labelStep) {
      const t = svgEl('text', { x: xFor(i), y: height - 4, class: 'chart-axis-label', 'text-anchor': i === 0 ? 'start' : (i >= n - 1 ? 'end' : 'middle') });
      t.textContent = labels[i];
      svg.appendChild(t);
    }

    container.appendChild(svg);
  }

  // ---------------- DONUT CHART ----------------
  // data: [{label, value, color}]
  function donutChart(container, items, opts = {}) {
    container.innerHTML = '';
    const size = opts.size || 160;
    const stroke = opts.stroke || 22;
    const r = (size - stroke) / 2;
    const cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const total = items.reduce((s, i) => s + i.value, 0);

    const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'donut-svg' });
    svg.appendChild(svgEl('circle', { cx, cy, r, fill: 'none', stroke: 'var(--border)', 'stroke-width': stroke }));

    let offset = 0;
    if (total > 0) {
      items.forEach(item => {
        const frac = item.value / total;
        const len = frac * circumference;
        const circle = svgEl('circle', {
          cx, cy, r, fill: 'none', stroke: item.color, 'stroke-width': stroke,
          'stroke-dasharray': `${len} ${circumference - len}`,
          'stroke-dashoffset': -offset,
          transform: `rotate(-90 ${cx} ${cy})`,
          'stroke-linecap': items.length === 1 ? 'butt' : 'butt'
        });
        svg.appendChild(circle);
        offset += len;
      });
    }
    container.appendChild(svg);
  }

  // ---------------- BAR CHART (grouped, 2 serie: entrate/uscite) ----------------
  // categories: [string,...], series: [{label, color, values:[cents,...]}]
  function barChart(container, categories, series, opts = {}) {
    container.innerHTML = '';
    const width = container.clientWidth || 320;
    const height = opts.height || 160;
    const padL = 4, padR = 4, padT = 8, padB = 20;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const allValues = series.flatMap(s => s.values);
    const max = Math.max(...allValues, 1);

    const n = categories.length;
    const groupW = innerW / n;
    const barGap = 2;
    const barW = Math.max(2, (groupW - barGap * (series.length + 1)) / series.length);

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, class: 'chart-svg' });
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: padT + innerH, y2: padT + innerH, class: 'chart-grid' }));

    for (let i = 0; i < n; i++) {
      const groupX = padL + i * groupW;
      series.forEach((s, si) => {
        const v = s.values[i] || 0;
        const h = (v / max) * innerH;
        const x = groupX + barGap + si * (barW + barGap);
        const y = padT + innerH - h;
        svg.appendChild(svgEl('rect', { x, y, width: barW, height: Math.max(h, v > 0 ? 1.5 : 0), rx: 1.5, fill: s.color }));
      });
      // etichetta categoria (solo alcune per non affollare su mobile)
      if (n <= 8 || i % Math.ceil(n / 8) === 0) {
        const t = svgEl('text', { x: groupX + groupW / 2, y: height - 4, class: 'chart-axis-label', 'text-anchor': 'middle' });
        t.textContent = categories[i];
        svg.appendChild(t);
      }
    }
    container.appendChild(svg);
  }

  return { lineChart, donutChart, barChart };
})();
