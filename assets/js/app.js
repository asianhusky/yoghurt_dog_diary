const $ = (sel) => document.querySelector(sel);
const entriesEl = $('#entries');
const sortSel = $('#sortSelect');
const monthInput = $('#filterDate');
const dlBtn = $('#downloadJson');
const upInput = $('#uploadJson');
const schemaEl = $('#schema');

let DATA = { entries: [] }

init();

async function init(){
  try {
    const schema = await (await fetch('data/schema.json')).json();
    schemaEl.textContent = JSON.stringify(schema, null, 2);
  } catch {}

  const files = await loadManifest();
  const monthly = await Promise.all(files.map(loadJson));
  DATA.entries = monthly.flatMap(m => m.entries || []);
  render();
  drawChart();

  monthInput.addEventListener('input', render);
  sortSel.addEventListener('change', render);
  dlBtn.addEventListener('click', downloadMergedJson);
  upInput.addEventListener('change', handleUploadPreview);
}

async function loadManifest(){
  try {
    const manifest = await (await fetch('data/manifest.json', { cache: 'no-store' })).json();
    return manifest.files;
  } catch {
    return ['2025-09.json'];
  }
}

async function loadJson(path){
  try { return await (await fetch(`data/${path}`, { cache: 'no-store' })).json(); }
  catch { return { entries: [] }; }
}

function currentEntries(){
  const month = monthInput.value;
  const dir = sortSel.value;
  let items = (DATA.entries || []).slice().filter(x => x && x.date);
  if (month) items = items.filter(x => x.date.startsWith(month));
  items.sort((a,b) => dir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  return items;
}

function render(){
  const items = currentEntries();
  if (items.length === 0) { entriesEl.innerHTML = '<div class="empty">No entries for this view.</div>'; return; }
  entriesEl.innerHTML = items.map(htmlEntry).join('');
}

function htmlEntry(e){
  const moodClass = e.energy==='high'?'good': e.energy==='low'?'bad':'warn';
  const poopClass = e.poopQuality==='normal'?'good': e.poopQuality==='none'?'warn':'bad';
  return `<article class="entry">
    <h3>${fmtDate(e.date)}</h3>
    <div class="row">
      ${num(e.weight)? pill('',`Weight: ${e.weight} ${e.weightUnit||'lb'}`):''}
      ${pill(moodClass,`Energy: ${e.energy||'normal'}`)}
      ${num(e.meals)? pill('',`Meals: ${e.meals}`):''}
      ${num(e.waterCups)? pill('',`Water: ${e.waterCups} cups`):''}
      ${num(e.walks)? pill('',`Walks: ${e.walks}`):''}
      ${pill(poopClass,`Poop: ${e.poopQuality||'normal'}`)}
      ${e.medsGiven? pill('warn','Meds ✓') : pill('','Meds ✗')}
    </div>
    ${e.notes? `<div class="note space-top">${escapeHtml(e.notes)}</div>`:''}
  </article>`;
}

function pill(cls, text){ return `<span class="pill ${cls}">${text}</span>`; }
function num(v){ return typeof v === 'number' && Number.isFinite(v); }
function fmtDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(); }
function escapeHtml(str=''){ return String(str).replace(/[&<>\"']/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[s])); }

function drawChart(){
  const ctx = document.getElementById('weightChart');
  const points = (DATA.entries||[]).filter(e=>num(e.weight) && e.date).sort((a,b)=>a.date.localeCompare(b.date));
  const labels = points.map(p=>p.date);
  const data = points.map(p=>p.weight);
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Weight', data, tension: .3 }] },
    options: { plugins:{legend:{display:true}}, scales:{x:{ticks:{autoSkip:true}}, y:{beginAtZero:false}} }
  });
}

function downloadMergedJson(){
  const blob = new Blob([JSON.stringify({entries: currentEntries()}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dog-diary.json'; a.click();
  URL.revokeObjectURL(url);
}

function handleUploadPreview(e){
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const incoming = JSON.parse(reader.result);
      if(Array.isArray(incoming.entries)){
        DATA.entries = incoming.entries.concat(DATA.entries);
        render(); drawChart();
      }
    }catch{ alert('Invalid JSON'); }
  };
  reader.readAsText(file);
}
