let RAW = [];
let charts = {};

document.addEventListener('DOMContentLoaded', async () => {
  await refreshAll();
  document.getElementById('refreshBtn').onclick = refreshAll;
  document.getElementById('resetBtn').onclick   = resetFilters;
  document.getElementById('shiftFilter').onchange = render;
  document.getElementById('dateFrom').onchange    = render;
  document.getElementById('dateTo').onchange      = render;
  document.getElementById('searchBox').oninput    = renderTable;
  setInterval(refreshAll, CONFIG.REFRESH_MS);
});

async function refreshAll() {
  document.getElementById('liveDot').classList.add('pulse');
  RAW = await loadSheet();
  populateShiftFilter();
  render();
  document.getElementById('liveDot').classList.remove('pulse');
}

function resetFilters() {
  document.getElementById('shiftFilter').value = 'ALL';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value   = '';
  document.getElementById('searchBox').value= '';
  render();
}

function populateShiftFilter() {
  const sel = document.getElementById('shiftFilter');
  const cur = sel.value;
  const shifts = [...new Set(RAW.map(r => r[COL.SHIFT]).filter(Boolean))];
  sel.innerHTML = '<option value="ALL">All Shifts</option>' +
    shifts.map(s => `<option value="${s}">${s}</option>`).join('');
  sel.value = cur || 'ALL';
}

function getFiltered() {
  const shift = document.getElementById('shiftFilter').value;
  const from  = document.getElementById('dateFrom').value;
  const to    = document.getElementById('dateTo').value;

  return RAW.filter(r => {
    if (!r[COL.DATE]) return false;
    if (shift !== 'ALL' && r[COL.SHIFT] !== shift) return false;
    const d = new Date(r[COL.DATE]);
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to))   return false;
    return true;
  });
}

function render() {
  const data = getFiltered();
  renderKPIs(data);
  renderTrend(data);
  renderDowntimePie(data);
  renderShiftBars(data);
  renderTable();
}

/* ========== KPI CARDS ========== */
function renderKPIs(data) {
  const totalAvail   = data.reduce((s,r)=>s+parseNum(r[COL.AVAILABLE]),0);
  const totalDown    = data.reduce((s,r)=>s+parseNum(r[COL.DOWNTIME]),0);
  const totalCap     = data.reduce((s,r)=>s+parseNum(r[COL.CAPACITY]),0);
  const totalActual  = data.reduce((s,r)=>s+parseNum(r[COL.ACTUAL]),0);
  const totalReject  = data.reduce((s,r)=>s+parseNum(r[COL.REJECT]),0);
  const goodYield    = totalActual - totalReject;

  const availability = totalAvail ? ((totalAvail-totalDown)/totalAvail)*100 : 0;
  const performance  = totalCap   ? (totalActual/totalCap)*100 : 0;
  const quality      = totalActual? (goodYield/totalActual)*100 : 0;
  const oee          = (availability * performance * quality) / 10000;

  const machines = new Set(data.map(r=>r[COL.MACHINE]).filter(Boolean));

  set('kpiMachines', machines.size);
  set('kpiOEE',          oee.toFixed(2)+'%');
  set('kpiAvailability', availability.toFixed(2)+'%');
  set('kpiPerformance',  performance.toFixed(2)+'%');
  set('kpiQuality',      quality.toFixed(2)+'%');
  set('kpiOutput',       totalActual.toLocaleString());
  set('kpiGood',         goodYield.toLocaleString());
  set('kpiLosses',       totalDown.toLocaleString());
  set('kpiPlanned',      totalAvail.toLocaleString());

  document.getElementById('oeeBar').style.width        = Math.min(oee,100)+'%';
  document.getElementById('availBar').style.width      = Math.min(availability,100)+'%';
  document.getElementById('perfBar').style.width       = Math.min(performance,100)+'%';
  document.getElementById('qualBar').style.width       = Math.min(quality,100)+'%';
}
function set(id, val){ document.getElementById(id).textContent = val; }

/* ========== OEE DAILY TREND ========== */
function renderTrend(data) {
  const byDate = {};
  data.forEach(r => {
    const d = r[COL.DATE]; if(!d) return;
    if(!byDate[d]) byDate[d] = {avail:0,down:0,cap:0,act:0,rej:0};
    byDate[d].avail += parseNum(r[COL.AVAILABLE]);
    byDate[d].down  += parseNum(r[COL.DOWNTIME]);
    byDate[d].cap   += parseNum(r[COL.CAPACITY]);
    byDate[d].act   += parseNum(r[COL.ACTUAL]);
    byDate[d].rej   += parseNum(r[COL.REJECT]);
  });
  const labels = Object.keys(byDate).sort((a,b)=>new Date(a)-new Date(b));
  const oee=[], av=[], pf=[], qu=[];
  labels.forEach(d=>{
    const x = byDate[d];
    const a = x.avail ? (x.avail-x.down)/x.avail*100 : 0;
    const p = x.cap   ? x.act/x.cap*100 : 0;
    const q = x.act   ? (x.act-x.rej)/x.act*100 : 0;
    av.push(a.toFixed(2)); pf.push(p.toFixed(2)); qu.push(q.toFixed(2));
    oee.push((a*p*q/10000).toFixed(2));
  });

  const ctx = document.getElementById('trendChart');
  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      {label:'OEE %',         data:oee, borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,.1)', tension:.35, fill:true},
      {label:'Availability %',data:av,  borderColor:'#3b82f6', tension:.35},
      {label:'Performance %', data:pf,  borderColor:'#f59e0b', tension:.35},
      {label:'Quality %',     data:qu,  borderColor:'#10b981', tension:.35},
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom'}},
      scales:{y:{ticks:{callback:v=>v+'%'}, suggestedMax:100}}}
  });
}

/* ========== DOWNTIME PIE ========== */
function renderDowntimePie(data) {
  const map = {};
  data.forEach(r=>{
    const reason = (r[COL.REASON]||'Unspecified').toString().trim();
    map[reason] = (map[reason]||0) + parseNum(r[COL.DOWNTIME]);
  });
  const labels = Object.keys(map);
  const values = Object.values(map);
  const colors = ['#facc15','#3b82f6','#ef4444','#f97316','#10b981','#8b5cf6','#06b6d4','#ec4899'];

  // Legend
  const total = values.reduce((a,b)=>a+b,0) || 1;
  document.getElementById('pieLegend').innerHTML = labels.map((l,i)=>`
    <div class="legend-row">
      <span class="dot" style="background:${colors[i%colors.length]}"></span>
      <span class="lbl">${l}</span>
      <span class="val">${values[i].toLocaleString()}</span>
      <span class="pct">${(values[i]/total*100).toFixed(1)}%</span>
    </div>`).join('');

  const ctx = document.getElementById('pieChart');
  if (charts.pie) charts.pie.destroy();
  charts.pie = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data:values, backgroundColor:colors, borderWidth:2, borderColor:'#fff'}]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{legend:{display:false}}}
  });
}

/* ========== SHIFT TARGET vs ACTUAL ========== */
function renderShiftBars(data) {
  const map = {};
  data.forEach(r=>{
    const item = r[COL.ITEM]; if(!item) return;
    if(!map[item]) map[item] = {target:0, actual:0};
    map[item].target += parseNum(r[COL.CAPACITY]);
    map[item].actual += parseNum(r[COL.ACTUAL]);
  });
  const items = Object.keys(map).sort((a,b)=>map[b].target - map[a].target).slice(0,30);
  const targets = items.map(i=>map[i].target);
  const actuals = items.map(i=>map[i].actual);

  const ctx = document.getElementById('barChart');
  if (charts.bar) charts.bar.destroy();
  charts.bar = new Chart(ctx, {
    type:'bar',
    data:{ labels:items, datasets:[
      { label:'Shift Targets', data:targets, backgroundColor:'#c7d2fe'},
      { label:'Actual Yields', data:actuals, backgroundColor:'#6366f1'}
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'top'}},
      scales:{x:{ticks:{maxRotation:60,minRotation:45,font:{size:10}}}}}
  });
}

/* ========== TABLE ========== */
function renderTable() {
  const search = document.getElementById('searchBox').value.toLowerCase();
  const data = getFiltered().filter(r =>
    !search || r.some(c => String(c).toLowerCase().includes(search))
  );

  const tbody = document.querySelector('#recordsTable tbody');
  tbody.innerHTML = data.map(r => {
    const cap = parseNum(r[COL.CAPACITY]);
    const act = parseNum(r[COL.ACTUAL]);
    const rej = parseNum(r[COL.REJECT]);
    const av  = parseNum(r[COL.AVAILABLE]);
    const dn  = parseNum(r[COL.DOWNTIME]);
    const a = av  ? (av-dn)/av*100 : 0;
    const p = cap ? act/cap*100   : 0;
    const q = act ? (act-rej)/act*100 : 0;
    const oee = (a*p*q/10000);
    const oeeClass = oee >= 85 ? 'ok' : oee >= 60 ? 'warn' : 'bad';
    return `<tr>
      <td>${r[COL.DATE]||''}</td>
      <td><span class="chip">${r[COL.MACHINE]||''}</span></td>
      <td>${r[COL.SHIFT]||''}</td>
      <td class="ellipsis" title="${r[COL.ITEM]||''}">${r[COL.ITEM]||''}</td>
      <td>${r[COL.REASON]||'-'}</td>
      <td class="num">${cap.toLocaleString()}</td>
      <td class="num blue">${act.toLocaleString()}</td>
      <td class="num red">${rej.toLocaleString()}</td>
      <td><span class="oee-pill ${oeeClass}">${oee.toFixed(2)}%</span></td>
    </tr>`;
  }).join('');

  document.getElementById('rowCount').textContent = data.length + ' records';
}
