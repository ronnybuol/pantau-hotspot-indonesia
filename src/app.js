const DATA_BASE = './data';
const PERSISTENT_DAYS = 60;
const numberID = new Intl.NumberFormat('id-ID');
const dateID = new Intl.DateTimeFormat('id-ID', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });

let summary = [];
let meta = null;
let cumulative = [];
let moving7 = [];
let currentIndex = 0;
let playing = false;
let timer = null;
let monthCache = new Map();
let monthManifest = {};
let hotspotLayer = null;
let chart = null;

const els = {
  play: document.querySelector('#playBtn'), reset: document.querySelector('#resetBtn'), speed: document.querySelector('#speedSelect'),
  persist: document.querySelector('#persistToggle'), slider: document.querySelector('#dateSlider'), date: document.querySelector('#dateLabel'),
  daily: document.querySelector('#dailyCount'), avg7: document.querySelector('#avg7'), cumulative: document.querySelector('#cumulativeCount'),
  frp: document.querySelector('#frpSum'), peak: document.querySelector('#peakBadge')
};

const map = L.map('map', { zoomControl:true, preferCanvas:true, minZoom:4, maxZoom:10, worldCopyJump:false });
map.fitBounds([[-11.6,94.7],[6.6,141.5]], { padding:[8,8] });
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  subdomains:'abcd', maxZoom:20,
  attribution:'&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

const loading = L.DomUtil.create('div','loading-pill');
loading.textContent = 'Memuat data…';
loading.style.display = 'none';
map.getContainer().appendChild(loading);

function isoToDate(iso){ return new Date(`${iso}T00:00:00Z`); }
function monthKey(iso){ return iso.slice(0,7); }

async function loadJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Gagal memuat ${url}`);
  return r.json();
}

async function decodeGzipBytes(b64){
  if(!('DecompressionStream' in window)) throw new Error('Browser tidak mendukung DecompressionStream');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodeCompressedJSON(b64){
  const bytes = await decodeGzipBytes(b64);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function loadCompressedJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Gagal memuat ${url}`);
  return decodeCompressedJSON((await r.text()).trim());
}

function parseMonthBinary(bytes, key){
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if(String.fromCharCode(...bytes.slice(0,4)) !== 'HSP2') throw new Error('Format data peta tidak dikenali');
  let o=4;
  const month = view.getUint8(o++);
  const dayCount = view.getUint8(o++);
  const expectedMonth = Number(key.slice(5,7));
  if(month !== expectedMonth) throw new Error(`Payload bulan tidak cocok: ${key}`);
  const days=[];
  for(let di=0;di<dayCount;di++){
    const day=view.getUint8(o++);
    const n=view.getUint16(o,true); o+=2;
    const cells=[];
    for(let i=0;i<n;i++){
      const latIndex=view.getUint8(o++);
      const lonIndex=view.getUint8(o++);
      const count=view.getUint16(o,true); o+=2;
      const activeDays=view.getUint8(o++);
      const lat=-11.875 + latIndex*0.25;
      const lon=90.125 + lonIndex*0.25;
      cells.push({lat,lon,count,active_days_2026:activeDays});
    }
    days.push({date:`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,cells});
  }
  return {days};
}

async function loadMonth(key){
  const parts = monthManifest[key];
  if(!parts?.length) throw new Error(`Manifest data tidak memuat ${key}`);
  const chunks = await Promise.all(parts.map(async name => {
    const r = await fetch(`${DATA_BASE}/months-upload/${name}`);
    if(!r.ok) throw new Error(`Gagal memuat ${name}`);
    return (await r.text()).trim();
  }));
  const bytes = await decodeGzipBytes(chunks.join(''));
  return parseMonthBinary(bytes,key);
}

async function getDayData(iso){
  const key = monthKey(iso);
  if(!monthCache.has(key)){
    loading.style.display='block';
    monthCache.set(key, loadMonth(key));
  }
  try{
    const month = await monthCache.get(key);
    return month.days.find(d => d.date === iso);
  } finally {
    loading.style.display='none';
  }
}

function computeSeries(){
  let run=0;
  cumulative = summary.map((d,i)=>{ run += d.count; return run; });
  moving7 = summary.map((d,i)=>{
    const start=Math.max(0,i-6); let s=0;
    for(let j=start;j<=i;j++) s+=summary[j].count;
    return s/(i-start+1);
  });
}

function buildChart(){
  const ctx=document.querySelector('#trendChart');
  const labels=summary.map(d=>d.date);
  chart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Deteksi harian', data:summary.map(d=>d.count), borderColor:'#e44722', backgroundColor:'rgba(228,71,34,.11)', borderWidth:1.7, pointRadius:0, fill:true, tension:.18 },
      { label:'Rata-rata 7 hari', data:moving7, borderColor:'#6b6760', borderWidth:1.5, borderDash:[5,4], pointRadius:0, fill:false, tension:.2 },
      { label:'Tanggal aktif', data:labels.map(()=>null), borderColor:'#2a100b', backgroundColor:'#2a100b', pointRadius:4.5, pointHoverRadius:5.5, showLine:false }
    ]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:false,callback:(value,index)=>{
          const d=isoToDate(labels[index]); return d.getUTCDate()===1 ? d.toLocaleDateString('id-ID',{month:'short',timeZone:'UTC'}) : '';
        }}},
        y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.07)'},ticks:{callback:v=>numberID.format(v)}}
      },
      plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>dateID.format(isoToDate(items[0].label)),label:item=>`${item.dataset.label}: ${numberID.format(Math.round(item.raw||0))}`}}}
    }
  });
}

function markerRadius(count){ return Math.max(2.2, Math.min(17, 2 + Math.sqrt(count)*1.45)); }
function markerOpacity(count){ return Math.min(.82, .28 + Math.log10(count+1)*.22); }

function drawCells(day){
  if(hotspotLayer) hotspotLayer.remove();
  const hidePersistent = els.persist.checked;
  const group=L.layerGroup();
  for(const c of day.cells){
    const {lat,lon,count} = c;
    const activeDays = c.active_days_2026;
    if(hidePersistent && activeDays >= PERSISTENT_DAYS) continue;
    const circle=L.circleMarker([lat,lon],{
      radius:markerRadius(count), color:'#a62b13', weight:.55,
      fillColor:'#e44722', fillOpacity:markerOpacity(count)
    });
    circle.bindTooltip(
      `<strong>${numberID.format(count)} deteksi</strong><br>`+
      `Grid aktif: ${numberID.format(activeDays)} hari dalam dataset`,
      {className:'hotspot-tip',sticky:true,direction:'top'}
    );
    circle.addTo(group);
  }
  hotspotLayer=group.addTo(map);
}

function updateChartCursor(i){
  chart.data.datasets[2].data = summary.map((d,idx)=> idx===i ? d.count : null);
  chart.update('none');
}

async function renderIndex(i){
  currentIndex=Math.max(0,Math.min(summary.length-1,i));
  els.slider.value=currentIndex;
  const s=summary[currentIndex];
  els.date.textContent=dateID.format(isoToDate(s.date));
  els.daily.textContent=numberID.format(s.count);
  els.avg7.textContent=numberID.format(Math.round(moving7[currentIndex]));
  els.cumulative.textContent=numberID.format(cumulative[currentIndex]);
  els.frp.textContent=numberID.format(Math.round(s.frp_sum));
  els.peak.hidden = s.date !== meta.peak_date;
  updateChartCursor(currentIndex);
  const day=await getDayData(s.date);
  if(currentIndex !== i) return;
  drawCells(day);
  prefetchNextMonth(s.date);
}

function prefetchNextMonth(iso){
  const d=isoToDate(iso); d.setUTCMonth(d.getUTCMonth()+1); d.setUTCDate(1);
  const key=d.toISOString().slice(0,7);
  if(key > meta.end_date.slice(0,7) || monthCache.has(key)) return;
  monthCache.set(key, loadMonth(key));
}

function stop(){
  playing=false; clearTimeout(timer); timer=null; els.play.textContent='▶ Putar';
}
function scheduleNext(){
  if(!playing) return;
  if(currentIndex>=summary.length-1){ stop(); return; }
  timer=setTimeout(async()=>{ await renderIndex(currentIndex+1); scheduleNext(); }, Number(els.speed.value));
}
function play(){
  if(playing){ stop(); return; }
  if(currentIndex>=summary.length-1) currentIndex=0;
  playing=true; els.play.textContent='❚❚ Jeda'; scheduleNext();
}

els.play.addEventListener('click',play);
els.reset.addEventListener('click',async()=>{stop();await renderIndex(0)});
els.slider.addEventListener('input',async e=>{stop();await renderIndex(Number(e.target.value))});
els.persist.addEventListener('change',async()=>{const day=await getDayData(summary[currentIndex].date);drawCells(day)});
els.speed.addEventListener('change',()=>{ if(playing){clearTimeout(timer);scheduleNext()} });

document.addEventListener('visibilitychange',()=>{ if(document.hidden) stop(); });

async function init(){
  [summary,meta,monthManifest]=await Promise.all([
    loadCompressedJSON(`${DATA_BASE}/summary.json.gz.b64`).catch(()=>loadJSON(`${DATA_BASE}/summary.json`)),
    loadJSON(`${DATA_BASE}/meta.json`),
    loadJSON(`${DATA_BASE}/months-upload/manifest.json`).catch(()=>({}))
  ]);
  els.slider.max=summary.length-1;
  computeSeries(); buildChart();
  await renderIndex(0);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced) setTimeout(play,900);
}

init().catch(err=>{
  console.error(err);
  loading.style.display='block'; loading.textContent='Data gagal dimuat';
});
