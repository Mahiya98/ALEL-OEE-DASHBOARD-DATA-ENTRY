// Fetch Google Sheet as JSON via gviz endpoint (no API key required)
async function loadSheet() {
  const url =
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}` +
    `/gviz/tq?tqx=out:json&gid=${CONFIG.GID}`;

  const res  = await fetch(url);
  const text = await res.text();
  // Strip the gviz wrapper:  google.visualization.Query.setResponse({...});
  const json = JSON.parse(text.substring(47, text.length - 2));

  const rows = json.table.rows.map(r =>
    (r.c || []).map(c => (c == null ? '' : (c.f != null ? c.f : c.v)))
  );
  return rows;
}

function parseNum(v) {
  if (v === '' || v == null) return 0;
  const n = parseFloat(String(v).replace(/[, %]/g,''));
  return isNaN(n) ? 0 : n;
}
