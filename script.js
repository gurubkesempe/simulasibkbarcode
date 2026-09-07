/* ============================================================
   BK DIGITAL — FRONTEND LOGIC
   ============================================================ */

const TYPES = ['siswa','absensi','pelanggaran','konseling','kolaborasi','kebiasaan'];
const STATE = { siswa:[], absensi:[], pelanggaran:[], konseling:[], kolaborasi:[], kebiasaan:[] };
let API_URL = localStorage.getItem('bk_api_url') || '';
let API_TOKEN = localStorage.getItem('bk_api_token') || '';
let currentPage = 'dashboard';
let charts = {};

/* ---------------- ADAPTER: real Apps Script vs offline demo ---------------- */
const RealAdapter = {
  async getAll(type){
    const res = await fetch(`${API_URL}?action=getAll&type=${type}&token=${encodeURIComponent(API_TOKEN)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal mengambil data');
    return json.data;
  },
  async create(type, data){
    const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'create', type, data, token: API_TOKEN }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal menyimpan data');
    return json.data;
  },
  async update(type, id, data){
    const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'update', type, id, data, token: API_TOKEN }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal memperbarui data');
    return json.data;
  },
  async delete(type, id){
    const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'delete', type, id, token: API_TOKEN }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal menghapus data');
    return true;
  },
  async importBulk(type, rows, matchField){
    const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'importBulk', type, rows, matchField, token: API_TOKEN }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Gagal mengimpor data');
    return json.data;
  }
};

const DemoAdapter = {
  key(type){ return `bk_demo_${type}`; },
  read(type){ return JSON.parse(localStorage.getItem(this.key(type)) || '[]'); },
  write(type, arr){ localStorage.setItem(this.key(type), JSON.stringify(arr)); },
  async getAll(type){ return this.read(type); },
  async create(type, data){
    const arr = this.read(type);
    data.ID = data.ID || (type.substring(0,3).toUpperCase() + '-' + Date.now().toString(36));
    arr.push(data); this.write(type, arr); return data;
  },
  async update(type, id, data){
    const arr = this.read(type);
    const idx = arr.findIndex(o => String(o.ID) === String(id));
    if (idx === -1) throw new Error('Data tidak ditemukan');
    arr[idx] = { ...arr[idx], ...data }; this.write(type, arr); return arr[idx];
  },
  async delete(type, id){
    const arr = this.read(type).filter(o => String(o.ID) !== String(id));
    this.write(type, arr); return true;
  },
  async importBulk(type, rows, matchField){
    const arr = this.read(type);
    const existingKeys = new Set(arr.map(o => String(o[matchField]||'').trim().toLowerCase()).filter(Boolean));
    let added = 0, skipped = 0; const skippedKeys = [];
    rows.forEach((r,i) => {
      const key = String(r[matchField]||'').trim().toLowerCase();
      if (key && existingKeys.has(key)){ skipped++; skippedKeys.push(r[matchField]); return; }
      const row = { ...r, ID: r.ID || (type.substring(0,3).toUpperCase() + '-' + Date.now().toString(36) + '-' + i) };
      arr.push(row);
      if (key) existingKeys.add(key);
      added++;
    });
    this.write(type, arr);
    return { added, skipped, skippedKeys };
  },
  seedIfEmpty(){
    if (this.read('siswa').length) return;
    const siswa = [
      { ID:'SIS-1', NIS:'2201001', Nama:'Ahmad Fadillah', Kelas:'IX-A', JenisKelamin:'L', TempatTglLahir:'Semarang, 12-04-2011', Alamat:'Jl. Merdeka No. 12', NamaOrtu:'Budi Santoso', NoHPOrtu:'081234567801', Catatan:'', Barcode:'BK-2201001', FotoURL:'' },
      { ID:'SIS-2', NIS:'2201002', Nama:'Siti Nurhaliza', Kelas:'IX-A', JenisKelamin:'P', TempatTglLahir:'Purwodadi, 03-08-2011', Alamat:'Jl. Anggrek No. 5', NamaOrtu:'Sri Wahyuni', NoHPOrtu:'081234567802', Catatan:'', Barcode:'BK-2201002', FotoURL:'' },
      { ID:'SIS-3', NIS:'2201003', Nama:'Rizky Maulana', Kelas:'VIII-B', JenisKelamin:'L', TempatTglLahir:'Grobogan, 21-01-2012', Alamat:'Jl. Melati No. 9', NamaOrtu:'Agus Wibowo', NoHPOrtu:'081234567803', Catatan:'Perlu pemantauan kedisiplinan', Barcode:'BK-2201003', FotoURL:'' },
      { ID:'SIS-4', NIS:'2201004', Nama:'Dewi Lestari', Kelas:'VIII-B', JenisKelamin:'P', TempatTglLahir:'Purwodadi, 15-11-2011', Alamat:'Jl. Kenanga No. 2', NamaOrtu:'Hendra Kusuma', NoHPOrtu:'081234567804', Catatan:'', Barcode:'BK-2201004', FotoURL:'' },
      { ID:'SIS-5', NIS:'2201005', Nama:'Muhammad Iqbal', Kelas:'VII-C', JenisKelamin:'L', TempatTglLahir:'Semarang, 30-06-2012', Alamat:'Jl. Mawar No. 18', NamaOrtu:'Joko Prasetyo', NoHPOrtu:'081234567805', Catatan:'', Barcode:'BK-2201005', FotoURL:'' }
    ];
    this.write('siswa', siswa);
    const today = new Date(); const ymd = (d) => d.toISOString().slice(0,10);
    const absensi = [
      { ID:'ABS-1', Tanggal: ymd(today), SiswaID:'SIS-1', Nama:'Ahmad Fadillah', Kelas:'IX-A', Status:'Hadir', Keterangan:'' },
      { ID:'ABS-2', Tanggal: ymd(today), SiswaID:'SIS-3', Nama:'Rizky Maulana', Kelas:'VIII-B', Status:'Alpa', Keterangan:'Tanpa keterangan' },
      { ID:'ABS-3', Tanggal: ymd(today), SiswaID:'SIS-4', Nama:'Dewi Lestari', Kelas:'VIII-B', Status:'Sakit', Keterangan:'Demam' }
    ];
    this.write('absensi', absensi);
    const pelanggaran = [
      { ID:'PEL-1', Tanggal: ymd(today), SiswaID:'SIS-3', Nama:'Rizky Maulana', Kelas:'VIII-B', JenisPelanggaran:'Terlambat masuk sekolah', Poin:5, Keterangan:'Terlambat 20 menit', Penanganan:'Teguran lisan' },
      { ID:'PEL-2', Tanggal: ymd(today), SiswaID:'SIS-3', Nama:'Rizky Maulana', Kelas:'VIII-B', JenisPelanggaran:'Tidak mengerjakan tugas', Poin:5, Keterangan:'3x berturut-turut', Penanganan:'Pemanggilan siswa' }
    ];
    this.write('pelanggaran', pelanggaran);
    const konseling = [
      { ID:'KON-1', Tanggal: ymd(today), SiswaID:'SIS-3', Nama:'Rizky Maulana', Kelas:'VIII-B', Topik:'Kedisiplinan', Masalah:'Sering terlambat dan menunda tugas', HasilKonseling:'Siswa berjanji memperbaiki manajemen waktu', TindakLanjut:'Pemantauan 2 minggu', Konselor:'Bu Ratna, S.Pd' }
    ];
    this.write('konseling', konseling);
    const kolaborasi = [
      { ID:'KOL-1', Tanggal: ymd(today), SiswaID:'SIS-3', Nama:'Rizky Maulana', Kelas:'VIII-B', Jenis:'Pemanggilan Orang Tua', Tujuan:'Membahas kedisiplinan anak', Hasil:'Orang tua berkomitmen mendampingi di rumah', Petugas:'Bu Ratna, S.Pd' }
    ];
    this.write('kolaborasi', kolaborasi);
    const kebiasaan = [
      { ID:'HAB-1', Tanggal: ymd(today), SiswaID:'SIS-1', Nama:'Ahmad Fadillah', Kelas:'IX-A',
        BangunPagiPukul:'05.00', IbadahSholat:'Subuh, Duhur, Ashar, Maghrib, Isya', IbadahDhuha:'Ya', IbadahTadarus:'Juz 5',
        IbadahLainnya:'', OlahragaJenis:'Lari pagi', OlahragaDurasi:'20', BelajarMapel:'Matematika',
        MakanMenu:'Nasi, sayur bayam, telur, buah', BermasyarakatKegiatan:'Kerja bakti lingkungan',
        IstirahatPukul:'21.00', ParafOrtu:'Ya', ParafGuru:'', CatatanGuru:'' }
    ];
    this.write('kebiasaan', kebiasaan);
  }
};

let adapter = RealAdapter;

/* ---------------- UTIL ---------------- */
function $(sel, ctx=document){ return ctx.querySelector(sel); }
function $all(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }
function showLoading(v){ $('#loadingOverlay').classList.toggle('show', v); }
function toast(msg, type=''){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}
function fmtDate(d){
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}
function initials(name){ return (name||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(); }
function colorFromString(str){
  const colors = ['#2F6F63','#E0932F','#3B7DD8','#D9614F','#8A5FC7','#3E9A63'];
  let h = 0; for (let i=0;i<(str||'').length;i++) h = str.charCodeAt(i) + ((h<<5)-h);
  return colors[Math.abs(h) % colors.length];
}
function uniqueClasses(){
  const set = new Set(STATE.siswa.map(s => s.Kelas).filter(Boolean));
  return Array.from(set).sort();
}
function siswaById(id){ return STATE.siswa.find(s => String(s.ID) === String(id)); }
function isThisMonth(dateStr){
  if (!dateStr) return false;
  const d = new Date(dateStr); const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/* ---------------- DATA LOADING ---------------- */
async function loadAll(){
  showLoading(true);
  try{
    const results = await Promise.all(TYPES.map(t => adapter.getAll(t)));
    TYPES.forEach((t,i) => STATE[t] = results[i] || []);
    populateClassFilters();
    renderCurrentPage();
    renderDashboard();
  }catch(err){
    toast('Gagal memuat data: ' + err.message, 'error');
  }finally{
    showLoading(false);
  }
}

function populateClassFilters(){
  const classes = uniqueClasses();
  const selectors = ['#filterKelasSiswa','#filterKelasAbsensi','#filterKelasPelanggaran','#filterKelasKonseling','#filterKelasKebiasaan','#reportKelas'];
  selectors.forEach(sel => {
    const el = $(sel); if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Semua Kelas</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    el.value = current;
  });
  populateReportSiswaSelect();
}

function populateReportSiswaSelect(){
  const el = $('#reportSiswa'); if (!el) return;
  const current = el.value;
  const sorted = STATE.siswa.slice().sort((a,b) => (a.Nama||'').localeCompare(b.Nama||''));
  el.innerHTML = '<option value="">Pilih siswa...</option>' + sorted.map(s => `<option value="${s.ID}">${s.Nama} — ${s.Kelas}</option>`).join('');
  el.value = current;
}

/* ---------------- NAVIGATION ---------------- */
function goToPage(page){
  currentPage = page;
  $all('.page').forEach(p => p.classList.remove('active'));
  $(`#page-${page}`)?.classList.add('active');
  $all('.nav-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $all('.bn-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const titles = { dashboard:'Dashboard', siswa:'Data Siswa', absensi:'Absensi', pelanggaran:'Pelanggaran', konseling:'Konseling', kolaborasi:'Kolaborasi', kebiasaan:'7 Kebiasaan Anak Indonesia Hebat', laporan:'Laporan' };
  $('#pageTitle').textContent = titles[page] || page;
  closeMoreSheet();
  hideSearchDropdown();
  renderCurrentPage();
}
function renderCurrentPage(q){
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'siswa') renderSiswa(q);
  if (currentPage === 'absensi') renderAbsensi(q);
  if (currentPage === 'pelanggaran') renderPelanggaran(q);
  if (currentPage === 'konseling') renderKonseling(q);
  if (currentPage === 'kolaborasi') renderKolaborasi(q);
  if (currentPage === 'kebiasaan') renderKebiasaan(q);
}

$all('.nav-item[data-page]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); goToPage(n.dataset.page); }));
$all('.bn-item[data-page]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); goToPage(n.dataset.page); }));

/* mobile more sheet */
function openMoreSheet(){ $('#moreSheet').classList.add('open'); $('#sheetBackdrop').classList.add('open'); }
function closeMoreSheet(){ $('#moreSheet').classList.remove('open'); $('#sheetBackdrop').classList.remove('open'); }
$('#bnMore').addEventListener('click', e => { e.preventDefault(); openMoreSheet(); });
$('#sheetBackdrop').addEventListener('click', closeMoreSheet);
$all('#moreSheet .nav-item[data-page]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); goToPage(n.dataset.page); }));

$('#refreshBtn').addEventListener('click', loadAll);

/* ---------------- PENCARIAN GLOBAL ----------------
   Ketik di kotak pencarian atas untuk:
   1) Memfilter tabel/kartu di halaman yang sedang dibuka (siswa, absensi,
      pelanggaran, konseling, kolaborasi, kebiasaan), dan
   2) Menampilkan dropdown hasil pencarian siswa lintas halaman — klik salah
      satu hasil untuk langsung membuka Laporan Individu siswa tersebut. */
$('#globalSearch').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  renderCurrentPage(q || undefined);
  if (!q || q.length < 2){ hideSearchDropdown(); return; }
  renderSearchDropdown(q);
});
$('#globalSearch').addEventListener('focus', e => {
  const q = e.target.value.trim().toLowerCase();
  if (q.length >= 2) renderSearchDropdown(q);
});
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box') && !e.target.closest('#searchDropdown')) hideSearchDropdown();
});

function hideSearchDropdown(){ const el = $('#searchDropdown'); if (el) el.classList.remove('open'); }

function renderSearchDropdown(q){
  const dd = $('#searchDropdown');
  if (!dd) return;

  const matchSiswa = STATE.siswa.filter(s =>
    (s.Nama||'').toLowerCase().includes(q) || (s.NIS||'').toString().toLowerCase().includes(q) || (s.Kelas||'').toLowerCase().includes(q)
  ).slice(0, 6);

  const countsFor = (id) => ({
    absensiAlpa: STATE.absensi.filter(a => String(a.SiswaID)===String(id) && a.Status==='Alpa').length,
    pelanggaran: STATE.pelanggaran.filter(p => String(p.SiswaID)===String(id)).length,
    konseling: STATE.konseling.filter(k => String(k.SiswaID)===String(id)).length
  });

  if (!matchSiswa.length){
    dd.innerHTML = `<div class="search-dd-empty">Tidak ada siswa yang cocok dengan "${q}".</div>`;
  } else {
    dd.innerHTML = matchSiswa.map(s => {
      const c = countsFor(s.ID);
      return `<div class="search-dd-item">
        ${avatarHtmlFor(s, 28)}
        <span class="search-dd-info">
          <span class="search-dd-name">${s.Nama}</span>
          <span class="search-dd-sub">${s.Kelas||'-'} · NIS ${s.NIS||'-'} ${c.pelanggaran?`· ${c.pelanggaran} pelanggaran`:''} ${c.absensiAlpa?`· ${c.absensiAlpa}x alpa`:''}</span>
        </span>
        <span class="search-dd-actions">
          <button type="button" class="icon-btn-sm" data-quick-absensi="${s.ID}" title="Catat Absensi"><i class="fa-solid fa-calendar-check"></i></button>
          <button type="button" class="icon-btn-sm" data-goto-siswa="${s.ID}" title="Lihat Laporan"><i class="fa-solid fa-file-lines"></i></button>
        </span>
      </div>`;
    }).join('');
  }
  dd.classList.add('open');
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-goto-siswa]');
  if (btn){
    const id = btn.dataset.gotoSiswa;
    hideSearchDropdown();
    $('#globalSearch').value = '';
    goToPage('laporan');
    $('#reportType').value = 'individu';
    $('#reportType').dispatchEvent(new Event('change'));
    $('#reportSiswa').value = id;
    $('#btnGenerateReport').click();
    return;
  }
  const absBtn = e.target.closest('[data-quick-absensi]');
  if (absBtn){
    const id = absBtn.dataset.quickAbsensi;
    hideSearchDropdown();
    $('#globalSearch').value = '';
    goToPage('absensi');
    openForm('absensi', null, { SiswaID: id });
  }
});

/* ---------------- KOMBOBOX PENCARIAN SISWA (dipakai di semua form: absensi, pelanggaran, dst) ---------------- */
function siswaPickerFilter(wrap, query){
  const q = (query||'').trim().toLowerCase();
  const kelasSel = wrap.querySelector('.siswa-picker-kelas');
  const kelas = kelasSel ? kelasSel.value : '';
  let list = STATE.siswa;
  if (kelas) list = list.filter(s => s.Kelas === kelas);
  return list.filter(s => !q ||
    (s.Nama||'').toLowerCase().includes(q) ||
    (s.NIS||'').toString().toLowerCase().includes(q) ||
    (s.Kelas||'').toLowerCase().includes(q)
  ).slice(0, 50);
}
function siswaPickerRenderDropdown(wrap, query){
  const dd = wrap.querySelector('.siswa-picker-dropdown');
  const matches = siswaPickerFilter(wrap, query);
  dd.innerHTML = matches.length ? matches.map(s => `
      <button type="button" class="search-dd-item" data-pick-siswa="${s.ID}">
        ${avatarHtmlFor(s, 26)}
        <span class="search-dd-info"><span class="search-dd-name">${s.Nama}</span><span class="search-dd-sub">${s.Kelas||'-'} · NIS ${s.NIS||'-'}</span></span>
      </button>`).join('')
    : '<div class="search-dd-empty">Siswa tidak ditemukan untuk filter ini.</div>';
  dd.classList.add('open');
}
document.addEventListener('input', e => {
  if (!e.target.classList.contains('siswa-picker-input')) return;
  const wrap = e.target.closest('.siswa-picker');
  wrap.querySelector('input[type=hidden]').value = '';
  siswaPickerRenderDropdown(wrap, e.target.value);
});
document.addEventListener('focusin', e => {
  if (!e.target.classList.contains('siswa-picker-input')) return;
  const wrap = e.target.closest('.siswa-picker');
  siswaPickerRenderDropdown(wrap, e.target.value);
});
document.addEventListener('change', e => {
  if (!e.target.classList.contains('siswa-picker-kelas')) return;
  const wrap = e.target.closest('.siswa-picker');
  const input = wrap.querySelector('.siswa-picker-input');
  wrap.querySelector('input[type=hidden]').value = '';
  input.value = '';
  siswaPickerRenderDropdown(wrap, '');
  input.focus();
});
document.addEventListener('click', e => {
  const pickBtn = e.target.closest('[data-pick-siswa]');
  if (pickBtn && pickBtn.closest('.siswa-picker-dropdown')){
    const wrap = pickBtn.closest('.siswa-picker');
    const s = siswaById(pickBtn.dataset.pickSiswa);
    if (!s) return;
    wrap.querySelector('input[type=hidden]').value = s.ID;
    wrap.querySelector('.siswa-picker-input').value = `${s.Nama} — ${s.Kelas||'-'}`;
    wrap.querySelector('.siswa-picker-dropdown').classList.remove('open');
    return;
  }
  $all('.siswa-picker-dropdown.open').forEach(dd => {
    if (!dd.closest('.siswa-picker').contains(e.target)) dd.classList.remove('open');
  });
});

/* ---------------- DASHBOARD ---------------- */
function renderDashboard(){
  $('#statSiswa').textContent = STATE.siswa.length;
  $('#statAlpa').textContent = STATE.absensi.filter(a => a.Status === 'Alpa' && isThisMonth(a.Tanggal)).length;
  $('#statPelanggaran').textContent = STATE.pelanggaran.filter(p => isThisMonth(p.Tanggal)).length;
  $('#statKonseling').textContent = STATE.konseling.filter(k => isThisMonth(k.Tanggal)).length;

  renderTrendChart();
  renderPelanggaranChart();
  renderAbsensiChart('chartAbsensi', STATE.absensi);
  renderActivityList();
}

function last6Months(){
  const out = [];
  const now = new Date();
  for (let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    out.push({ label: d.toLocaleDateString('id-ID',{month:'short',year:'2-digit'}), y:d.getFullYear(), m:d.getMonth() });
  }
  return out;
}
function destroyChart(id){ if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function renderTrendChart(){
  const months = last6Months();
  const pelData = months.map(mo => STATE.pelanggaran.filter(p => { const d=new Date(p.Tanggal); return d.getFullYear()===mo.y && d.getMonth()===mo.m; }).length);
  const alpaData = months.map(mo => STATE.absensi.filter(a => a.Status==='Alpa' && (()=>{ const d=new Date(a.Tanggal); return d.getFullYear()===mo.y && d.getMonth()===mo.m; })()).length);
  destroyChart('trend');
  charts.trend = new Chart($('#chartTrend'), {
    type:'line',
    data:{ labels: months.map(m=>m.label), datasets:[
      { label:'Pelanggaran', data:pelData, borderColor:'#D9614F', backgroundColor:'rgba(217,97,79,.12)', tension:.35, fill:true },
      { label:'Alpa', data:alpaData, borderColor:'#2F6F63', backgroundColor:'rgba(47,111,99,.12)', tension:.35, fill:true }
    ]},
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{ size:11 } } } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });
}

function renderPelanggaranChart(){
  const counts = {};
  STATE.pelanggaran.forEach(p => { counts[p.JenisPelanggaran || 'Lainnya'] = (counts[p.JenisPelanggaran || 'Lainnya']||0)+1; });
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  destroyChart('pel');
  charts.pel = new Chart($('#chartPelanggaran'), {
    type:'bar',
    data:{ labels: entries.map(e=>e[0]), datasets:[{ data: entries.map(e=>e[1]), backgroundColor:'#E0932F', borderRadius:6, maxBarThickness:28 }] },
    options:{ indexAxis:'y', responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });
}

function renderAbsensiChart(canvasId, absensiData){
  const statuses = ['Hadir','Sakit','Izin','Alpa'];
  const colorMap = { Hadir:'#3E9A63', Sakit:'#3B7DD8', Izin:'#E0932F', Alpa:'#D9614F' };
  const counts = statuses.map(s => absensiData.filter(a=>a.Status===s).length);
  destroyChart(canvasId);
  const isDoughnut = canvasId === 'chartAbsensi';
  charts[canvasId] = new Chart($('#'+canvasId), {
    type: isDoughnut ? 'doughnut' : 'bar',
    data:{ labels: statuses, datasets:[{ data: counts, backgroundColor: statuses.map(s=>colorMap[s]), borderRadius: isDoughnut?0:6, borderWidth: isDoughnut?2:0, borderColor:'#fff' }] },
    options:{ responsive:true, plugins:{ legend:{ position: isDoughnut?'bottom':'display', labels:{ boxWidth:10, font:{size:11} } } }, scales: isDoughnut? {} : { y:{ beginAtZero:true, ticks:{precision:0} } } }
  });
}

function renderActivityList(){
  const items = [];
  STATE.pelanggaran.forEach(p => items.push({ t:p.Tanggal, html:`<b>${p.Nama||'-'}</b> — pelanggaran: ${p.JenisPelanggaran||'-'}`, color:'#D9614F' }));
  STATE.konseling.forEach(k => items.push({ t:k.Tanggal, html:`<b>${k.Nama||'-'}</b> — sesi konseling: ${k.Topik||'-'}`, color:'#3E9A63' }));
  STATE.kolaborasi.forEach(k => items.push({ t:k.Tanggal, html:`<b>${k.Nama||'-'}</b> — ${k.Jenis||'-'}`, color:'#3B7DD8' }));
  STATE.absensi.filter(a=>a.Status==='Alpa').forEach(a => items.push({ t:a.Tanggal, html:`<b>${a.Nama||'-'}</b> — tidak hadir tanpa keterangan`, color:'#E0932F' }));
  items.sort((a,b) => new Date(b.t) - new Date(a.t));
  const list = $('#activityList');
  if (!items.length){ list.innerHTML = '<li class="muted" style="border:none;padding:20px 4px;text-align:center">Belum ada aktivitas.</li>'; return; }
  list.innerHTML = items.slice(0,8).map(it => `<li><span class="activity-dot" style="background:${it.color}"></span><div><div>${it.html}</div><div class="a-time">${fmtDate(it.t)}</div></div></li>`).join('');
}

/* ---------------- DATA SISWA ---------------- */
function renderSiswa(searchQuery){
  const kelas = $('#filterKelasSiswa').value;
  let rows = STATE.siswa.filter(s => !kelas || s.Kelas === kelas);
  if (searchQuery) rows = rows.filter(s =>
    (s.Nama||'').toLowerCase().includes(searchQuery) ||
    (s.NIS||'').toString().toLowerCase().includes(searchQuery) ||
    (s.NamaOrtu||'').toLowerCase().includes(searchQuery)
  );
  const tbody = $('#tableSiswa tbody');
  const emptyState = $('#page-siswa .empty-state');
  if (!rows.length){ tbody.innerHTML=''; emptyState.style.display='block'; return; }
  emptyState.style.display='none';
  tbody.innerHTML = rows.map(s => {
    const pelanggaranCount = STATE.pelanggaran.filter(p => String(p.SiswaID)===String(s.ID)).length;
    const status = pelanggaranCount >= 3 ? { txt:'Perlu Perhatian', cls:'danger' } : pelanggaranCount >= 1 ? { txt:'Pemantauan', cls:'amber' } : { txt:'Baik', cls:'success' };
    return `<tr>
      <td>${s.NIS||'-'}</td>
      <td><div style="display:flex;align-items:center;gap:10px">
            ${avatarHtmlFor(s, 30)}
            ${s.Nama||'-'}
          </div></td>
      <td>${s.Kelas||'-'}</td>
      <td>${s.JenisKelamin||'-'}</td>
      <td>${s.NamaOrtu||'-'}</td>
      <td>${s.NoHPOrtu||'-'}</td>
      <td><span class="badge badge--${status.cls}"><span class="badge-dot" style="background:currentColor"></span>${status.txt}</span></td>
      <td><div class="row-actions">
            <button class="icon-btn-sm" data-edit="siswa" data-id="${s.ID}"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn-sm danger" data-del="siswa" data-id="${s.ID}"><i class="fa-solid fa-trash"></i></button>
          </div></td>
    </tr>`;
  }).join('');
}
$('#filterKelasSiswa').addEventListener('change', () => renderSiswa());

/* ---------------- ABSENSI ---------------- */
function renderAbsensi(searchQuery){
  const tgl = $('#filterTglAbsensi').value;
  const kelas = $('#filterKelasAbsensi').value;
  const status = $('#filterStatusAbsensi').value;
  let rows = STATE.absensi.filter(a => (!tgl || a.Tanggal===tgl) && (!kelas || a.Kelas===kelas) && (!status || a.Status===status));
  if (searchQuery) rows = rows.filter(a => (a.Nama||'').toLowerCase().includes(searchQuery) || (a.Keterangan||'').toLowerCase().includes(searchQuery));
  rows.sort((a,b)=> new Date(b.Tanggal)-new Date(a.Tanggal));
  renderAbsensiChart('chartAbsensiPage', rows);
  const tbody = $('#tableAbsensi tbody');
  const emptyState = $('#page-absensi .empty-state');
  if (!rows.length){ tbody.innerHTML=''; emptyState.style.display='block'; return; }
  emptyState.style.display='none';
  const badgeCls = { Hadir:'success', Sakit:'info', Izin:'amber', Alpa:'danger' };
  tbody.innerHTML = rows.map(a => `<tr>
      <td>${fmtDate(a.Tanggal)}</td><td>${a.Nama||'-'}</td><td>${a.Kelas||'-'}</td>
      <td><span class="badge badge--${badgeCls[a.Status]||'muted'}">${a.Status||'-'}</span></td>
      <td>${a.Keterangan||'-'}</td>
      <td><div class="row-actions">
        <button class="icon-btn-sm" data-edit="absensi" data-id="${a.ID}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn-sm danger" data-del="absensi" data-id="${a.ID}"><i class="fa-solid fa-trash"></i></button>
      </div></td></tr>`).join('');
}
['#filterTglAbsensi','#filterKelasAbsensi','#filterStatusAbsensi'].forEach(sel => $(sel).addEventListener('change', renderAbsensi));

/* ---------------- PELANGGARAN ---------------- */
function renderPelanggaran(searchQuery){
  const kelas = $('#filterKelasPelanggaran').value;
  const bulan = $('#filterBulanPelanggaran').value; // yyyy-mm
  let rows = STATE.pelanggaran.filter(p => (!kelas || p.Kelas===kelas) && (!bulan || (p.Tanggal||'').startsWith(bulan)));
  if (searchQuery) rows = rows.filter(p => (p.Nama||'').toLowerCase().includes(searchQuery) || (p.JenisPelanggaran||'').toLowerCase().includes(searchQuery));
  rows.sort((a,b)=> new Date(b.Tanggal)-new Date(a.Tanggal));
  const tbody = $('#tablePelanggaran tbody');
  const emptyState = $('#page-pelanggaran .empty-state');
  if (!rows.length){ tbody.innerHTML=''; emptyState.style.display='block'; return; }
  emptyState.style.display='none';
  tbody.innerHTML = rows.map(p => `<tr>
      <td>${fmtDate(p.Tanggal)}</td><td>${p.Nama||'-'}</td><td>${p.Kelas||'-'}</td>
      <td>${p.JenisPelanggaran||'-'}</td>
      <td><span class="badge badge--danger">${p.Poin||0} poin</span></td>
      <td>${p.Penanganan||'-'}</td>
      <td><div class="row-actions">
        <button class="icon-btn-sm" data-edit="pelanggaran" data-id="${p.ID}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn-sm danger" data-del="pelanggaran" data-id="${p.ID}"><i class="fa-solid fa-trash"></i></button>
      </div></td></tr>`).join('');
}
['#filterKelasPelanggaran','#filterBulanPelanggaran'].forEach(sel => $(sel).addEventListener('change', renderPelanggaran));

/* ---------------- KONSELING (card list) ---------------- */
function renderKonseling(searchQuery){
  const kelas = $('#filterKelasKonseling').value;
  let rows = STATE.konseling.filter(k => !kelas || k.Kelas===kelas);
  if (searchQuery) rows = rows.filter(k => (k.Nama||'').toLowerCase().includes(searchQuery) || (k.Topik||'').toLowerCase().includes(searchQuery));
  rows.sort((a,b)=> new Date(b.Tanggal)-new Date(a.Tanggal));
  const list = $('#listKonseling');
  $('#emptyKonseling').style.display = rows.length ? 'none' : 'block';
  list.innerHTML = rows.map(k => `
    <div class="entry-card">
      <div class="entry-card-head">
        <div class="entry-avatar-row">
          <span class="avatar-ring" style="background:${colorFromString(k.Nama)}">${initials(k.Nama)}</span>
          <div><div class="entry-name">${k.Nama||'-'}</div><div class="entry-sub">${k.Kelas||'-'} · ${k.Topik||'Konseling'}</div></div>
        </div>
        <div class="row-actions">
          <button class="icon-btn-sm" data-edit="konseling" data-id="${k.ID}"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn-sm danger" data-del="konseling" data-id="${k.ID}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="entry-body">
        <p><b>Masalah:</b> ${k.Masalah||'-'}</p>
        <p><b>Hasil:</b> ${k.HasilKonseling||'-'}</p>
        <p><b>Tindak lanjut:</b> ${k.TindakLanjut||'-'}</p>
      </div>
      <div class="entry-foot"><span class="entry-date">${fmtDate(k.Tanggal)}</span><span class="entry-sub">${k.Konselor||''}</span></div>
    </div>`).join('');
}
$('#filterKelasKonseling').addEventListener('change', renderKonseling);

/* ---------------- KOLABORASI (card list) ---------------- */
function renderKolaborasi(searchQuery){
  const jenis = $('#filterJenisKolaborasi').value;
  let rows = STATE.kolaborasi.filter(k => !jenis || k.Jenis===jenis);
  if (searchQuery) rows = rows.filter(k => (k.Nama||'').toLowerCase().includes(searchQuery) || (k.Jenis||'').toLowerCase().includes(searchQuery));
  rows.sort((a,b)=> new Date(b.Tanggal)-new Date(a.Tanggal));
  const list = $('#listKolaborasi');
  $('#emptyKolaborasi').style.display = rows.length ? 'none' : 'block';
  list.innerHTML = rows.map(k => `
    <div class="entry-card">
      <div class="entry-card-head">
        <div class="entry-avatar-row">
          <span class="avatar-ring" style="background:${colorFromString(k.Nama)}">${initials(k.Nama)}</span>
          <div><div class="entry-name">${k.Nama||'-'}</div><div class="entry-sub">${k.Kelas||'-'}</div></div>
        </div>
        <div class="row-actions">
          <button class="icon-btn-sm" data-edit="kolaborasi" data-id="${k.ID}"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn-sm danger" data-del="kolaborasi" data-id="${k.ID}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="entry-body">
        <p><span class="badge badge--info">${k.Jenis||'-'}</span></p>
        <p style="margin-top:8px"><b>Tujuan:</b> ${k.Tujuan||'-'}</p>
        <p><b>Hasil:</b> ${k.Hasil||'-'}</p>
      </div>
      <div class="entry-foot"><span class="entry-date">${fmtDate(k.Tanggal)}</span><span class="entry-sub">${k.Petugas||''}</span></div>
    </div>`).join('');
}
$('#filterJenisKolaborasi').addEventListener('change', renderKolaborasi);

/* ---------------- 7 KEBIASAAN ANAK INDONESIA HEBAT (card list) ---------------- */
function habitDone(v){ return v && String(v).trim() && String(v).trim().toLowerCase() !== 'tidak'; }
function renderKebiasaan(searchQuery){
  const kelas = $('#filterKelasKebiasaan').value;
  const tgl = $('#filterTglKebiasaan').value;
  let rows = STATE.kebiasaan.filter(k => (!kelas || k.Kelas===kelas) && (!tgl || k.Tanggal===tgl));
  if (searchQuery) rows = rows.filter(k => (k.Nama||'').toLowerCase().includes(searchQuery));
  rows.sort((a,b)=> new Date(b.Tanggal)-new Date(a.Tanggal));
  const list = $('#listKebiasaan');
  $('#emptyKebiasaan').style.display = rows.length ? 'none' : 'block';

  const habitDefs = [
    { key:'BangunPagiPukul', label:'Bangun Pagi', icon:'fa-sun', display: v => v || '-' },
    { key:'IbadahSholat', label:'Beribadah', icon:'fa-mosque', display: (v,k) => [v, habitDone(k.IbadahDhuha)?'Dhuha':'', k.IbadahTadarus?('Tadarus: '+k.IbadahTadarus):''].filter(Boolean).join(', ') || '-' },
    { key:'OlahragaJenis', label:'Berolahraga', icon:'fa-person-running', display: (v,k) => v ? `${v}${k.OlahragaDurasi?` (${k.OlahragaDurasi} menit)`:''}` : '-' },
    { key:'BelajarMapel', label:'Gemar Belajar', icon:'fa-book', display: v => v || '-' },
    { key:'MakanMenu', label:'Makan Sehat & Bergizi', icon:'fa-utensils', display: v => v || '-' },
    { key:'BermasyarakatKegiatan', label:'Bermasyarakat', icon:'fa-people-group', display: v => v || '-' },
    { key:'IstirahatPukul', label:'Istirahat Cukup', icon:'fa-bed', display: v => v || '-' }
  ];

  list.innerHTML = rows.map(k => `
    <div class="entry-card habit-card">
      <div class="entry-card-head">
        <div class="entry-avatar-row">
          <span class="avatar-ring" style="background:${colorFromString(k.Nama)}">${initials(k.Nama)}</span>
          <div><div class="entry-name">${k.Nama||'-'}</div><div class="entry-sub">${k.Kelas||'-'} · ${fmtDate(k.Tanggal)}</div></div>
        </div>
        <div class="row-actions">
          <button class="icon-btn-sm" data-print-habit="${k.ID}" title="Cetak formulir"><i class="fa-solid fa-print"></i></button>
          <button class="icon-btn-sm" data-edit="kebiasaan" data-id="${k.ID}"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn-sm danger" data-del="kebiasaan" data-id="${k.ID}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="habit-grid">
        ${habitDefs.map(h => `<div class="habit-item"><i class="fa-solid ${h.icon}"></i><div><span class="habit-label">${h.label}</span><span class="habit-value">${h.display(k[h.key], k)}</span></div></div>`).join('')}
      </div>
      <div class="entry-foot">
        <span class="entry-sub">${habitDone(k.ParafOrtu)?'<i class="fa-solid fa-check" style="color:var(--success)"></i> Paraf Ortu':'<i class="fa-regular fa-circle" style="color:var(--ink-soft)"></i> Paraf Ortu'} &nbsp;&nbsp; ${habitDone(k.ParafGuru)?'<i class="fa-solid fa-check" style="color:var(--success)"></i> Paraf Guru':'<i class="fa-regular fa-circle" style="color:var(--ink-soft)"></i> Paraf Guru'}</span>
      </div>
      ${k.CatatanGuru ? `<div class="habit-note"><b>Catatan Guru:</b> ${k.CatatanGuru}</div>` : ''}
    </div>`).join('');
}
$('#filterKelasKebiasaan').addEventListener('change', () => renderKebiasaan());
$('#filterTglKebiasaan').addEventListener('change', () => renderKebiasaan());

/* Cetak satu formulir kebiasaan meniru layout kertas "7 Kebiasaan Anak Indonesia Hebat" */
function printKebiasaanForm(id){
  const k = STATE.kebiasaan.find(o => String(o.ID)===String(id));
  if (!k) return;
  const row = (label, value) => `<tr><td class="hb-k">${label}</td><td class="hb-v">${value || '-'}</td></tr>`;
  const html = `
    <h2>7 Kebiasaan Anak Indonesia Hebat</h2>
    <div class="report-head-line"><span>Nama: ${k.Nama||'-'} &nbsp;|&nbsp; Kelas: ${k.Kelas||'-'}</span><span>Hari, tanggal: ${fmtDate(k.Tanggal)}</span></div>
    <table class="hb-table">
      <tbody>
        ${row('1. Bangun Pagi', 'Pukul: ' + (k.BangunPagiPukul||'-'))}
        ${row('2. Beribadah', (k.IbadahSholat||'-') + (habitDone(k.IbadahDhuha)?', Dhuha':'') + (k.IbadahTadarus?', Tadarus/Murajaah: '+k.IbadahTadarus:'') + (k.IbadahLainnya?', Lainnya: '+k.IbadahLainnya:''))}
        ${row('3. Berolahraga', 'Jenis: ' + (k.OlahragaJenis||'-') + ' — Durasi: ' + (k.OlahragaDurasi||'-'))}
        ${row('4. Gemar Belajar', 'Mapel: ' + (k.BelajarMapel||'-'))}
        ${row('5. Makan Sehat dan Bergizi', 'Menu: ' + (k.MakanMenu||'-'))}
        ${row('6. Bermasyarakat', 'Kegiatan: ' + (k.BermasyarakatKegiatan||'-'))}
        ${row('7. Istirahat Cukup', 'Pukul: ' + (k.IstirahatPukul||'-'))}
      </tbody>
    </table>
    <table class="hb-table" style="margin-top:14px">
      <tbody>
        <tr>
          <td class="hb-k" style="width:20%">Paraf Ortu</td>
          <td class="hb-k" style="width:20%">Paraf Guru</td>
          <td class="hb-k">Catatan Guru</td>
        </tr>
        <tr style="height:70px">
          <td>${habitDone(k.ParafOrtu)?'✓':''}</td>
          <td>${habitDone(k.ParafGuru)?'✓':''}</td>
          <td>${k.CatatanGuru||''}</td>
        </tr>
      </tbody>
    </table>`;
  $('#reportPreview').innerHTML = html;
  $('#reportPreviewCard').style.display = 'block';
  goToPage('laporan');
  $('#reportPreviewCard').scrollIntoView({ behavior:'smooth' });
  setTimeout(() => window.print(), 400);
}

/* ---------------- ROW ACTION DELEGATION (edit/delete) ---------------- */
document.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn = e.target.closest('[data-del]');
  const printHabitBtn = e.target.closest('[data-print-habit]');
  if (printHabitBtn){ printKebiasaanForm(printHabitBtn.dataset.printHabit); return; }
  if (editBtn) openForm(editBtn.dataset.edit, editBtn.dataset.id);
  if (delBtn){
    const type = delBtn.dataset.del, id = delBtn.dataset.id;
    if (!confirm('Yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.')) return;
    showLoading(true);
    try{
      await adapter.delete(type, id);
      STATE[type] = STATE[type].filter(o => String(o.ID) !== String(id));
      renderCurrentPage(); renderDashboard(); populateClassFilters();
      toast('Data berhasil dihapus.', 'success');
    }catch(err){ toast(err.message, 'error'); }
    finally{ showLoading(false); }
  }
});

/* ---------------- FORM CONFIG ---------------- */
function siswaSelectOptions(selectedId){
  return STATE.siswa.map(s => `<option value="${s.ID}" ${String(s.ID)===String(selectedId)?'selected':''}>${s.Nama} — ${s.Kelas}</option>`).join('');
}

const FORM_CONFIG = {
  siswa: {
    title: 'Data Siswa',
    fields: [
      { key:'NIS', label:'NIS', type:'text', required:true },
      { key:'Nama', label:'Nama Lengkap', type:'text', required:true },
      { key:'Kelas', label:'Kelas', type:'text', required:true, placeholder:'contoh: VIII-A' },
      { key:'JenisKelamin', label:'Jenis Kelamin', type:'select', options:['L','P'] },
      { key:'TempatTglLahir', label:'Tempat, Tgl Lahir', type:'text' },
      { key:'NamaOrtu', label:'Nama Orang Tua/Wali', type:'text' },
      { key:'NoHPOrtu', label:'No. HP Orang Tua', type:'text' },
      { key:'Alamat', label:'Alamat', type:'textarea', full:true },
      { key:'Catatan', label:'Catatan Khusus', type:'textarea', full:true },
      { key:'FotoURL', label:'Foto Siswa', type:'photo', full:true },
      { key:'Barcode', label:'Kode QR (untuk kartu absensi)', type:'barcode', full:true }
    ]
  },
  absensi: {
    title: 'Absensi Siswa',
    fields: [
      { key:'Tanggal', label:'Tanggal', type:'date', required:true, default: () => new Date().toISOString().slice(0,10) },
      { key:'SiswaID', label:'Siswa', type:'select-siswa', required:true, full:true },
      { key:'Status', label:'Status', type:'select', options:['Hadir','Sakit','Izin','Alpa'], required:true },
      { key:'Keterangan', label:'Keterangan', type:'textarea', full:true }
    ]
  },
  pelanggaran: {
    title: 'Pelanggaran Siswa',
    fields: [
      { key:'Tanggal', label:'Tanggal', type:'date', required:true, default: () => new Date().toISOString().slice(0,10) },
      { key:'SiswaID', label:'Siswa', type:'select-siswa', required:true, full:true },
      { key:'JenisPelanggaran', label:'Jenis Pelanggaran', type:'text', required:true },
      { key:'Poin', label:'Poin Pelanggaran', type:'number' },
      { key:'Keterangan', label:'Keterangan', type:'textarea', full:true },
      { key:'Penanganan', label:'Penanganan', type:'textarea', full:true }
    ]
  },
  konseling: {
    title: 'Sesi Konseling',
    fields: [
      { key:'Tanggal', label:'Tanggal', type:'date', required:true, default: () => new Date().toISOString().slice(0,10) },
      { key:'SiswaID', label:'Siswa', type:'select-siswa', required:true, full:true },
      { key:'Topik', label:'Topik', type:'text', required:true },
      { key:'Konselor', label:'Konselor / Guru BK', type:'text' },
      { key:'Masalah', label:'Uraian Masalah', type:'textarea', full:true },
      { key:'HasilKonseling', label:'Hasil Konseling', type:'textarea', full:true },
      { key:'TindakLanjut', label:'Rencana Tindak Lanjut', type:'textarea', full:true }
    ]
  },
  kolaborasi: {
    title: 'Kolaborasi (Panggilan Ortu / Home Visit)',
    fields: [
      { key:'Tanggal', label:'Tanggal', type:'date', required:true, default: () => new Date().toISOString().slice(0,10) },
      { key:'SiswaID', label:'Siswa', type:'select-siswa', required:true, full:true },
      { key:'Jenis', label:'Jenis Kegiatan', type:'select', options:['Pemanggilan Orang Tua','Home Visit'], required:true },
      { key:'Petugas', label:'Petugas BK', type:'text' },
      { key:'Tujuan', label:'Tujuan Kegiatan', type:'textarea', full:true },
      { key:'Hasil', label:'Hasil / Kesepakatan', type:'textarea', full:true }
    ]
  },
  kebiasaan: {
    title: '7 Kebiasaan Anak Indonesia Hebat',
    fields: [
      { key:'Tanggal', label:'Hari, Tanggal', type:'date', required:true, default: () => new Date().toISOString().slice(0,10) },
      { key:'SiswaID', label:'Siswa', type:'select-siswa', required:true, full:true },
      { key:'BangunPagiPukul', label:'1. Bangun Pagi — Pukul', type:'text', placeholder:'contoh: 05.00' },
      { key:'IbadahSholat', label:'2. Beribadah — Sholat', type:'checkbox-group', options:['Subuh','Duhur','Ashar','Maghrib',"Isya'"], full:true },
      { key:'IbadahDhuha', label:'Sholat Dhuha', type:'checkbox' },
      { key:'IbadahTadarus', label:'Tadarus / Murajaah', type:'text', placeholder:'contoh: Juz 5 / Surah Al-Kahfi' },
      { key:'IbadahLainnya', label:'Ibadah Lainnya', type:'text', full:true },
      { key:'OlahragaJenis', label:'3. Berolahraga — Jenis', type:'text' },
      { key:'OlahragaDurasi', label:'Durasi (menit)', type:'text' },
      { key:'BelajarMapel', label:'4. Gemar Belajar — Mapel', type:'text', full:true },
      { key:'MakanMenu', label:'5. Makan Sehat dan Bergizi — Menu', type:'textarea', full:true },
      { key:'BermasyarakatKegiatan', label:'6. Bermasyarakat — Kegiatan', type:'textarea', full:true },
      { key:'IstirahatPukul', label:'7. Istirahat Cukup — Pukul', type:'text' },
      { key:'ParafOrtu', label:'Paraf Orang Tua (sudah diperiksa)', type:'checkbox' },
      { key:'ParafGuru', label:'Paraf Guru (sudah diperiksa)', type:'checkbox' },
      { key:'CatatanGuru', label:'Catatan Guru', type:'textarea', full:true }
    ]
  }
};

/* ---------------- MODAL FORM ---------------- */
function openForm(type, id, prefill){
  const cfg = FORM_CONFIG[type];
  const existing = id ? STATE[type].find(o => String(o.ID)===String(id)) : null;
  $('#modalTitle').textContent = (existing ? 'Edit ' : 'Tambah ') + cfg.title;

  const fieldsHtml = cfg.fields.map(f => {
    const val = existing ? (existing[f.key] ?? '')
      : (prefill && prefill[f.key] !== undefined ? prefill[f.key]
      : (typeof f.default==='function' ? f.default() : ''));
    const wrapClass = 'field' + (f.full ? ' full' : '');
    if (f.type === 'select'){
      return `<div class="${wrapClass}"><label>${f.label}</label>
        <select name="${f.key}" ${f.required?'required':''}>
          <option value="">Pilih...</option>
          ${f.options.map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    }
    if (f.type === 'select-siswa'){
      const selSiswa = val ? siswaById(val) : null;
      const displayVal = selSiswa ? `${selSiswa.Nama} — ${selSiswa.Kelas||'-'}` : '';
      const kelasOpts = uniqueClasses().map(c => `<option value="${c}">${c}</option>`).join('');
      return `<div class="${wrapClass}"><label>${f.label}</label>
        <div class="siswa-picker">
          <div class="siswa-picker-row">
            <select class="siswa-picker-kelas" title="Filter kelas"><option value="">Semua Kelas</option>${kelasOpts}</select>
            <input type="text" class="siswa-picker-input" autocomplete="off" placeholder="Ketik nama, NIS, atau kelas siswa..." value="${displayVal}" />
          </div>
          <input type="hidden" name="${f.key}" value="${val||''}" />
          <div class="siswa-picker-dropdown search-dropdown"></div>
        </div></div>`;
    }
    if (f.type === 'textarea'){
      return `<div class="${wrapClass}"><label>${f.label}</label><textarea name="${f.key}">${val||''}</textarea></div>`;
    }
    if (f.type === 'checkbox-group'){
      const selected = (val||'').split(',').map(s=>s.trim());
      return `<div class="${wrapClass}"><label>${f.label}</label>
        <div class="checkbox-group">
          ${f.options.map(o => `<label class="checkbox-pill"><input type="checkbox" name="${f.key}" value="${o}" ${selected.includes(o)?'checked':''}/> ${o}</label>`).join('')}
        </div></div>`;
    }
    if (f.type === 'checkbox'){
      const checked = habitDone(val);
      return `<div class="${wrapClass} field--checkbox"><label class="checkbox-pill"><input type="checkbox" name="${f.key}" value="Ya" ${checked?'checked':''}/> ${f.label}</label></div>`;
    }
    if (f.type === 'photo'){
      return `<div class="${wrapClass} field-photo">
        <label>${f.label}</label>
        <div class="photo-upload" id="photoUpload_${f.key}">
          <div class="photo-preview" id="photoPreview_${f.key}">${val ? `<img src="${val}" alt="Foto siswa" />` : `<i class="fa-solid fa-user"></i>`}</div>
          <div class="photo-actions">
            <input type="file" accept="image/*" capture="environment" class="hidden photo-file-input" id="photoFile_${f.key}" />
            <button type="button" class="btn btn-ghost btn-sm photo-pick-btn" data-photo-key="${f.key}"><i class="fa-solid fa-camera"></i> Ambil / Upload Foto</button>
            ${val ? `<button type="button" class="btn btn-ghost btn-sm photo-remove-btn" data-photo-key="${f.key}"><i class="fa-solid fa-trash"></i> Hapus</button>` : ''}
          </div>
          <p class="photo-hint muted">Foto otomatis dikompres &amp; disimpan langsung di Google Sheet (tanpa Google Drive).</p>
        </div>
        <input type="hidden" name="${f.key}" value="${val||''}" />
      </div>`;
    }
    if (f.type === 'barcode'){
      return `<div class="${wrapClass} field-barcode">
        <label>${f.label}</label>
        <div class="barcode-row">
          <input type="text" name="${f.key}" class="barcode-input" value="${val||''}" placeholder="contoh: BK-2201001" autocomplete="off" />
          <button type="button" class="btn btn-ghost btn-sm barcode-gen-btn"><i class="fa-solid fa-shuffle"></i> Buat Otomatis</button>
        </div>
        <div class="barcode-preview-wrap">
          <img class="barcode-preview-svg qr-preview-img" alt="" />
          <button type="button" class="btn btn-ghost btn-sm barcode-print-btn"><i class="fa-solid fa-print"></i> Cetak Kartu QR</button>
        </div>
        <p class="muted photo-hint">Tempel/cetak kode QR ini di kartu siswa. Saat kartu ditunjukkan ke kamera di menu Absensi, siswa otomatis tercatat hadir.</p>
      </div>`;
    }
    return `<div class="${wrapClass}"><label>${f.label}</label><input type="${f.type}" name="${f.key}" value="${val||''}" ${f.placeholder?`placeholder="${f.placeholder}"`:''} ${f.required?'required':''} /></div>`;
  }).join('');

  $('#modalBody').innerHTML = `
    <form id="entityForm">
      <div class="form-grid">${fieldsHtml}</div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="formCancel">Batal</button>
        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Simpan</button>
      </div>
    </form>`;

  $all('.field-barcode', $('#modalBody')).forEach(refreshBarcodePreview);

  $('#formCancel').addEventListener('click', closeModal);
  $('#entityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    cfg.fields.forEach(f => {
      if (f.type === 'checkbox-group'){ data[f.key] = fd.getAll(f.key).join(', '); }
      else if (f.type === 'checkbox'){ data[f.key] = fd.get(f.key) ? 'Ya' : ''; }
      else { data[f.key] = fd.get(f.key) || ''; }
    });
    if (data.SiswaID !== undefined){
      const s = siswaById(data.SiswaID);
      if (s){ data.Nama = s.Nama; data.Kelas = s.Kelas; }
    }
    const missingSiswa = cfg.fields.find(f => f.type === 'select-siswa' && f.required && !data[f.key]);
    if (missingSiswa){ toast(`${missingSiswa.label} wajib dipilih — ketik nama lalu klik salah satu hasil.`, 'error'); return; }
    showLoading(true);
    try{
      if (existing){
        const updated = await adapter.update(type, existing.ID, data);
        const idx = STATE[type].findIndex(o=>String(o.ID)===String(existing.ID));
        STATE[type][idx] = { ...existing, ...updated, ...data, ID: existing.ID };
        toast('Data berhasil diperbarui.', 'success');
      }else{
        const created = await adapter.create(type, data);
        STATE[type].push({ ...data, ...created });
        toast('Data berhasil disimpan.', 'success');
      }
      closeModal();
      populateClassFilters();
      renderCurrentPage();
      renderDashboard();
    }catch(err){
      toast(err.message, 'error');
    }finally{
      showLoading(false);
    }
  });

  openModal();
}

function openModal(){ $('#modalBackdrop').classList.add('open'); }
function closeModal(){ $('#modalBackdrop').classList.remove('open'); }

/* ---------------- AVATAR (pakai foto siswa kalau ada, kalau tidak pakai inisial berwarna) ---------------- */
function avatarHtmlFor(s, size){
  size = size || 30;
  if (s && s.FotoURL){
    return `<img src="${s.FotoURL}" alt="${s.Nama||''}" class="avatar-ring avatar-photo" style="width:${size}px;height:${size}px;object-fit:cover;" />`;
  }
  const nama = s ? s.Nama : '';
  return `<span class="avatar-ring" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.36)}px;background:${colorFromString(nama)}">${initials(nama)}</span>`;
}

/* ---------------- UPLOAD & KOMPRESI FOTO SISWA ----------------
   Foto di-resize & dikompres di browser (canvas) supaya cukup kecil untuk
   disimpan langsung sebagai teks (data URL base64) di dalam sel Google
   Sheet — tidak perlu Google Drive / server tambahan sama sekali. Kualitas
   otomatis diturunkan bertahap kalau hasilnya masih terlalu besar. */
function compressImageToDataUrl(file, maxW, maxH, quality){
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')){ reject(new Error('File yang dipilih bukan gambar.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        let width = img.naturalWidth, height = img.naturalHeight;
        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        let q = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > 42000 && q > 0.25){
          q -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        if (dataUrl.length > 48000){ reject(new Error('Ukuran foto masih terlalu besar setelah dikompres. Coba foto lain.')); return; }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setPhotoValue(key, dataUrl){
  const wrap = $(`#photoUpload_${key}`);
  if (!wrap) return;
  const hidden = wrap.parentElement.querySelector(`input[type=hidden][name="${key}"]`);
  if (hidden) hidden.value = dataUrl || '';
  const preview = $(`#photoPreview_${key}`);
  if (preview) preview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Foto siswa" />` : `<i class="fa-solid fa-user"></i>`;
  const actions = wrap.querySelector('.photo-actions');
  let removeBtn = wrap.querySelector('.photo-remove-btn');
  if (dataUrl && !removeBtn && actions){
    removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-ghost btn-sm photo-remove-btn';
    removeBtn.dataset.photoKey = key;
    removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Hapus';
    actions.appendChild(removeBtn);
  } else if (!dataUrl && removeBtn){
    removeBtn.remove();
  }
}

document.addEventListener('click', e => {
  const pickBtn = e.target.closest('.photo-pick-btn');
  if (pickBtn){ $(`#photoFile_${pickBtn.dataset.photoKey}`)?.click(); return; }
  const rmBtn = e.target.closest('.photo-remove-btn');
  if (rmBtn){ setPhotoValue(rmBtn.dataset.photoKey, ''); return; }
});
document.addEventListener('change', async e => {
  if (!e.target.classList.contains('photo-file-input')) return;
  const file = e.target.files[0];
  const key = e.target.id.replace('photoFile_', '');
  if (!file) return;
  showLoading(true);
  try{
    const dataUrl = await compressImageToDataUrl(file, 280, 280, 0.75);
    setPhotoValue(key, dataUrl);
  }catch(err){
    toast(err.message, 'error');
  }finally{
    showLoading(false);
    e.target.value = '';
  }
});

/* ---------------- KODE QR SISWA (generate + preview + cetak kartu) ----------------
   Sebelumnya pakai barcode batang (CODE128) tapi seringkali sulit terbaca kamera HP/webcam
   karena butuh fokus & sudut yang presisi. QR code jauh lebih toleran terhadap sudut, jarak,
   dan resolusi kamera yang seadanya, jadi lebih andal untuk absensi lewat kamera. */
function refreshBarcodePreview(wrap){
  if (!wrap) return;
  const input = wrap.querySelector('.barcode-input');
  const img = wrap.querySelector('.barcode-preview-svg');
  if (!input || !img) return;
  const val = input.value.trim();
  if (!val || typeof QRCode === 'undefined'){ img.src = ''; img.style.display='none'; return; }
  QRCode.toDataURL(val, { margin: 1, width: 130 })
    .then(url => { img.src = url; img.style.display='inline-block'; })
    .catch(() => { img.src = ''; img.style.display='none'; });
}
document.addEventListener('input', e => {
  if (!e.target.classList.contains('barcode-input')) return;
  refreshBarcodePreview(e.target.closest('.field-barcode'));
});
document.addEventListener('click', e => {
  const genBtn = e.target.closest('.barcode-gen-btn');
  if (genBtn){
    const wrap = genBtn.closest('.field-barcode');
    const input = wrap.querySelector('.barcode-input');
    const nisInput = document.querySelector('#entityForm input[name="NIS"]');
    const base = (nisInput && nisInput.value.trim()) ? nisInput.value.trim() : Date.now().toString(36).toUpperCase();
    input.value = 'BK-' + base;
    refreshBarcodePreview(wrap);
    return;
  }
  const printBtn = e.target.closest('.barcode-print-btn');
  if (printBtn){
    const wrap = printBtn.closest('.field-barcode');
    const code = wrap.querySelector('.barcode-input').value.trim();
    if (!code){ toast('Isi atau buat kode QR terlebih dahulu.', 'error'); return; }
    const namaInput = document.querySelector('#entityForm input[name="Nama"]');
    const kelasInput = document.querySelector('#entityForm input[name="Kelas"]');
    const nisInput = document.querySelector('#entityForm input[name="NIS"]');
    printBarcodeCard(code, namaInput ? namaInput.value : '', kelasInput ? kelasInput.value : '', nisInput ? nisInput.value : '');
    return;
  }
});

function printBarcodeCard(code, nama, kelas, nis){
  const w = window.open('', '_blank', 'width=440,height=440');
  if (!w){ toast('Popup diblokir browser. Izinkan popup untuk mencetak kartu.', 'error'); return; }
  const safe = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  w.document.write(`<!DOCTYPE html><html><head><title>Kartu QR Siswa</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <style>
      body{ font-family:Arial, sans-serif; text-align:center; padding:28px; }
      .card{ border:2px solid #2F6F63; border-radius:12px; padding:18px 22px; display:inline-block; min-width:220px; }
      h3{ margin:0 0 2px; font-size:18px; }
      p{ margin:0 0 12px; color:#555; font-size:13px; }
      img{ display:block; margin:0 auto; }
      .code-text{ margin-top:8px; font-size:12px; color:#555; letter-spacing:.5px; }
    </style></head><body>
    <div class="card">
      <h3>${safe(nama) || '-'}</h3>
      <p>${safe(kelas) || '-'}${nis ? ' &middot; NIS ' + safe(nis) : ''}</p>
      <img id="qrImg" width="180" height="180" />
      <div class="code-text">${safe(code)}</div>
    </div>
    <script>
      window.onload = function(){
        QRCode.toDataURL(${JSON.stringify(code)}, { margin: 1, width: 220 }).then(function(url){
          document.getElementById('qrImg').src = url;
          setTimeout(function(){ window.print(); }, 300);
        });
      };
    <\/script>
    </body></html>`);
  w.document.close();
}

/* ---------------- CETAK KARTU BARCODE MASSAL (ukuran kartu pelajar) ----------------
   Alur: pilih kelas (opsional) & centang siswa yang mau dicetak kartunya →
   siswa yang belum punya kode Barcode akan dibuatkan otomatis (BK-<NIS/ID>) &
   langsung disimpan supaya bisa dipindai di Mode Kamera → semua kartu dirender
   dalam satu halaman cetak berukuran kartu pelajar standar (ID-1 / CR80,
   85.6mm x 53.98mm) tersusun rapi di kertas A4, siap digunting/dilaminating. */
function openBulkBarcodePrint(){
  $('#modalTitle').textContent = 'Cetak Kartu QR (Massal)';
  const kelasOpts = uniqueClasses().map(c => `<option value="${c}">${c}</option>`).join('');
  const savedSchool = localStorage.getItem('bk_school_name') || '';
  const savedYear = localStorage.getItem('bk_school_year') || '';
  const esc = (s) => String(s||'').replace(/"/g, '&quot;');

  $('#modalBody').innerHTML = `
    <div class="field"><label>Kelas</label>
      <select id="bcpKelas"><option value="">Semua Kelas</option>${kelasOpts}</select>
    </div>
    <div class="form-grid">
      <div class="field"><label>Nama Sekolah (tampil di kartu)</label>
        <input type="text" id="bcpSekolah" value="${esc(savedSchool)}" placeholder="Contoh: SMP Negeri 1 Purwodadi" />
      </div>
      <div class="field"><label>Tahun Ajaran (opsional)</label>
        <input type="text" id="bcpTahun" value="${esc(savedYear)}" placeholder="Contoh: 2025/2026" />
      </div>
    </div>
    <p class="muted" style="margin:-6px 0 14px">Siswa yang belum punya kode QR akan dibuatkan otomatis & disimpan, supaya langsung bisa dipindai di Mode Kamera.</p>
    <div class="bulk-list-head">
      <label class="checkbox-pill"><input type="checkbox" id="bcpCheckAll" /> Pilih Semua</label>
      <span class="muted" id="bcpCount"></span>
    </div>
    <div class="bulk-siswa-list" id="bcpSiswaList"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="bcpCancel">Batal</button>
      <button type="button" class="btn btn-primary" id="bcpSubmit"><i class="fa-solid fa-print"></i> Cetak Kartu Terpilih</button>
    </div>`;

  function updateBcpCount(){
    const total = $all('.bcp-siswa-check').length;
    const checked = $all('.bcp-siswa-check:checked').length;
    $('#bcpCount').textContent = total ? `${checked} dari ${total} siswa dipilih` : 'Tidak ada data siswa.';
  }
  function renderBcpList(kelas){
    const list = $('#bcpSiswaList');
    const rows = STATE.siswa
      .filter(s => !kelas || s.Kelas === kelas)
      .sort((a,b) => (a.Kelas||'').localeCompare(b.Kelas||'') || (a.Nama||'').localeCompare(b.Nama||''));
    if (!rows.length){
      list.innerHTML = `<p class="muted">Tidak ada data siswa untuk pilihan ini.</p>`;
      $('#bcpCheckAll').checked = false;
      updateBcpCount();
      return;
    }
    list.innerHTML = rows.map(s => `
      <label class="checkbox-pill bulk-item">
        <input type="checkbox" class="bcp-siswa-check" value="${s.ID}" checked />
        ${avatarHtmlFor(s, 24)}
        <span>${s.Nama||'-'} <span class="muted">· ${s.Kelas||'-'} · NIS ${s.NIS||'-'}</span></span>
      </label>`).join('');
    $('#bcpCheckAll').checked = true;
    updateBcpCount();
  }

  renderBcpList('');
  $('#bcpKelas').addEventListener('change', e => renderBcpList(e.target.value));
  $('#bcpCheckAll').addEventListener('change', e => {
    $all('.bcp-siswa-check').forEach(cb => cb.checked = e.target.checked);
    updateBcpCount();
  });
  $('#bcpSiswaList').addEventListener('change', e => {
    if (e.target.classList.contains('bcp-siswa-check')) updateBcpCount();
  });
  $('#bcpCancel').addEventListener('click', closeModal);

  $('#bcpSubmit').addEventListener('click', async () => {
    const ids = $all('.bcp-siswa-check:checked').map(cb => cb.value);
    if (!ids.length){ toast('Pilih minimal satu siswa terlebih dahulu.', 'error'); return; }
    const schoolName = $('#bcpSekolah').value.trim();
    const schoolYear = $('#bcpTahun').value.trim();
    localStorage.setItem('bk_school_name', schoolName);
    localStorage.setItem('bk_school_year', schoolYear);

    showLoading(true);
    try{
      const students = [];
      for (const id of ids){
        const s = siswaById(id);
        if (!s) continue;
        let code = (s.Barcode || '').toString().trim();
        if (!code){
          code = 'BK-' + (s.NIS || s.ID);
          try{
            const updated = await adapter.update('siswa', s.ID, { Barcode: code });
            Object.assign(s, updated || {}, { Barcode: code });
          }catch(e){ s.Barcode = code; }
        }
        students.push(s);
      }
      renderCurrentPage();
      closeModal();
      printBulkBarcodeCards(students, schoolName, schoolYear);
    }catch(err){
      toast(err.message, 'error');
    }finally{
      showLoading(false);
    }
  });

  openModal();
}
$('#btnBulkPrintBarcode').addEventListener('click', openBulkBarcodePrint);

function printBulkBarcodeCards(students, schoolName, schoolYear){
  if (!students.length){ toast('Tidak ada siswa untuk dicetak.', 'error'); return; }
  const w = window.open('', '_blank');
  if (!w){ toast('Popup diblokir browser. Izinkan popup untuk mencetak kartu.', 'error'); return; }
  const safe = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const cardsHtml = students.map((s, i) => `
    <div class="card">
      <div class="card-head">
        ${schoolName ? `<div class="card-school">${safe(schoolName)}</div>` : ''}
        <div class="card-title">KARTU PELAJAR &middot; ABSENSI QR</div>
      </div>
      <div class="card-body">
        <div class="card-photo">${s.FotoURL ? `<img src="${s.FotoURL}" />` : `<span>${safe(initials(s.Nama))}</span>`}</div>
        <div class="card-info">
          <div class="card-nama">${safe(s.Nama) || '-'}</div>
          <div class="card-meta">Kelas ${safe(s.Kelas) || '-'}</div>
          <div class="card-meta">NIS ${safe(s.NIS) || '-'}</div>
        </div>
        <img class="card-qr" id="bc-${i}" />
      </div>
      ${schoolYear ? `<div class="card-foot">Tahun Ajaran ${safe(schoolYear)}</div>` : ''}
    </div>`).join('');

  w.document.write(`<!DOCTYPE html><html><head><title>Cetak Kartu QR Siswa</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <style>
      @page{ size:A4; margin:8mm; }
      *{ box-sizing:border-box; }
      body{ font-family:Arial, Helvetica, sans-serif; margin:0; padding:0; background:#e9edf1; }
      .sheet{ display:flex; flex-wrap:wrap; gap:4mm; }
      .card{
        width:85.6mm; height:53.98mm; border:1px dashed #9aa5b1; border-radius:3mm; background:#fff;
        padding:3mm 4mm; display:flex; flex-direction:column; justify-content:space-between;
        page-break-inside:avoid; break-inside:avoid; overflow:hidden;
      }
      .card-head{ text-align:center; border-bottom:1.1px solid #2F6F63; padding-bottom:1.4mm; margin-bottom:1.4mm; }
      .card-school{ font-size:9.5px; font-weight:700; color:#2F6F63; text-transform:uppercase; line-height:1.15; }
      .card-title{ font-size:7px; font-weight:600; letter-spacing:.4px; color:#777; margin-top:.5mm; }
      .card-body{ display:flex; align-items:center; gap:2.5mm; flex:1; min-height:0; }
      .card-photo{
        width:13mm; height:13mm; border-radius:50%; background:#EAF3F1; border:1px solid #2F6F63;
        overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:700; color:#2F6F63;
      }
      .card-photo img{ width:100%; height:100%; object-fit:cover; }
      .card-info{ min-width:0; flex:1; }
      .card-nama{ font-size:11px; font-weight:800; color:#16211c; line-height:1.2; word-break:break-word; }
      .card-meta{ font-size:8.5px; color:#555; margin-top:.8mm; }
      .card-qr{ width:15mm; height:15mm; flex-shrink:0; }
      .card-foot{ text-align:center; font-size:7px; color:#888; }
      @media print{
        body{ background:#fff; }
        .card{ border:1px dashed #ccc; }
      }
    </style></head><body>
    <div class="sheet">${cardsHtml}</div>
    <script>
      window.onload = function(){
        var data = ${JSON.stringify(students.map(s => (s.Barcode || '').toString()))};
        Promise.all(data.map(function(code, i){
          return QRCode.toDataURL(code, { margin: 1, width: 140 }).then(function(url){
            var el = document.getElementById('bc-' + i);
            if (el) el.src = url;
          }).catch(function(){});
        })).then(function(){
          setTimeout(function(){ window.print(); }, 400);
        });
      };
    <\/script>
    </body></html>`);
  w.document.close();
}

/* ---------------- ABSEN MASSAL PER KELAS ----------------
   Fitur tambahan di halaman Absensi: centang beberapa siswa sekaligus (mis. satu
   kelas masuk semua), pilih satu status, lalu simpan sekaligus. Tidak mengubah
   tampilan/alur "Catat Absensi" satu-per-satu yang sudah ada — ini murni tombol
   tambahan di sebelahnya. */
function openBulkAbsensi(){
  $('#modalTitle').textContent = 'Absen Massal per Kelas';
  const today = new Date().toISOString().slice(0,10);
  const kelasOpts = uniqueClasses().map(c => `<option value="${c}">${c}</option>`).join('');

  $('#modalBody').innerHTML = `
    <form id="bulkAbsensiForm">
      <div class="form-grid">
        <div class="field"><label>Tanggal</label><input type="date" id="bulkTanggal" value="${today}" required /></div>
        <div class="field"><label>Kelas</label>
          <select id="bulkKelas" required><option value="">Pilih kelas...</option>${kelasOpts}</select>
        </div>
        <div class="field"><label>Status untuk siswa yang dicentang</label>
          <select id="bulkStatus" required>
            <option value="">Pilih...</option>
            <option value="Hadir">Hadir</option>
            <option value="Sakit">Sakit</option>
            <option value="Izin">Izin</option>
            <option value="Alpa">Alpa</option>
          </select>
        </div>
        <div class="field"><label>Keterangan (opsional, berlaku untuk semua yang dicentang)</label>
          <input type="text" id="bulkKeterangan" placeholder="Contoh: -" />
        </div>
      </div>
      <div class="bulk-list-head">
        <label class="checkbox-pill"><input type="checkbox" id="bulkCheckAll" /> Pilih Semua</label>
        <span class="muted" id="bulkCount">Pilih kelas dahulu untuk menampilkan daftar siswa.</span>
      </div>
      <div class="bulk-siswa-list" id="bulkSiswaList"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="bulkCancel">Batal</button>
        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Simpan Semua</button>
      </div>
    </form>`;

  function updateBulkCount(){
    const total = $all('.bulk-siswa-check').length;
    const checked = $all('.bulk-siswa-check:checked').length;
    $('#bulkCount').textContent = total ? `${checked} dari ${total} siswa dicentang` : 'Pilih kelas dahulu untuk menampilkan daftar siswa.';
  }
  function renderBulkList(kelas){
    const list = $('#bulkSiswaList');
    const siswaKelas = STATE.siswa.filter(s => s.Kelas === kelas).sort((a,b)=>(a.Nama||'').localeCompare(b.Nama||''));
    if (!siswaKelas.length){
      list.innerHTML = `<p class="muted">Tidak ada data siswa untuk kelas ini.</p>`;
      $('#bulkCheckAll').checked = false;
      updateBulkCount();
      return;
    }
    list.innerHTML = siswaKelas.map(s => `
      <label class="checkbox-pill bulk-item">
        <input type="checkbox" class="bulk-siswa-check" value="${s.ID}" checked />
        <span class="avatar-ring" style="width:24px;height:24px;font-size:9.5px;background:${colorFromString(s.Nama)}">${initials(s.Nama)}</span>
        <span>${s.Nama} <span class="muted">· NIS ${s.NIS||'-'}</span></span>
      </label>`).join('');
    $('#bulkCheckAll').checked = true;
    updateBulkCount();
  }

  $('#bulkKelas').addEventListener('change', e => renderBulkList(e.target.value));
  $('#bulkCheckAll').addEventListener('change', e => {
    $all('.bulk-siswa-check').forEach(cb => cb.checked = e.target.checked);
    updateBulkCount();
  });
  $('#bulkSiswaList').addEventListener('change', e => {
    if (e.target.classList.contains('bulk-siswa-check')) updateBulkCount();
  });
  $('#bulkCancel').addEventListener('click', closeModal);

  $('#bulkAbsensiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tanggal = $('#bulkTanggal').value;
    const kelas = $('#bulkKelas').value;
    const status = $('#bulkStatus').value;
    const keterangan = $('#bulkKeterangan').value || '';
    if (!tanggal || !kelas || !status){ toast('Tanggal, kelas, dan status wajib diisi.', 'error'); return; }
    const checkedIds = $all('.bulk-siswa-check:checked').map(cb => cb.value);
    if (!checkedIds.length){ toast('Centang minimal satu siswa.', 'error'); return; }

    showLoading(true);
    let saved = 0, skipped = 0;
    try{
      for (const id of checkedIds){
        const already = STATE.absensi.some(a => String(a.SiswaID)===String(id) && a.Tanggal===tanggal);
        if (already){ skipped++; continue; }
        const s = siswaById(id);
        const data = { Tanggal: tanggal, SiswaID: id, Nama: s?.Nama||'', Kelas: s?.Kelas||'', Status: status, Keterangan: keterangan };
        const created = await adapter.create('absensi', data);
        STATE.absensi.push({ ...data, ...created });
        saved++;
      }
      closeModal();
      populateClassFilters();
      renderCurrentPage();
      renderDashboard();
      toast(`${saved} siswa dicatat sebagai ${status}${skipped ? `, ${skipped} dilewati (sudah ada catatan absensi tanggal ini)` : ''}.`, 'success');
    }catch(err){
      toast(err.message, 'error');
    }finally{
      showLoading(false);
    }
  });

  openModal();
}
$('#btnBulkAbsensi').addEventListener('click', openBulkAbsensi);
$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', e => { if (e.target.id==='modalBackdrop') closeModal(); });

/* ---------------- KIOSK ABSENSI KAMERA (scan kartu QR) ----------------
   Alur: kamera nyala & standby menunggu kartu QR → siswa tunjukkan
   kartu ke kamera → sistem mencocokkan kode dengan kolom Barcode di data
   siswa → kalau cocok, foto & nama siswa ditampilkan beberapa detik dan
   absensi (default: Hadir) langsung tersimpan → otomatis kembali standby
   menunggu kartu berikutnya, tanpa perlu sentuh apa pun. */
let kioskScanner = null;
let kioskBusy = false;
let kioskHintTimer = null;
const KIOSK_RESULT_DELAY_OK = 3500;   // ms menampilkan hasil sebelum kembali standby
const KIOSK_RESULT_DELAY_INFO = 3000;
const KIOSK_RESULT_DELAY_ERR = 2200;
const KIOSK_HINT_DELAY = 8000;        // ms sebelum menampilkan tips kalau belum ada barcode terdeteksi

function showKioskHint(){
  const el = $('#kioskResult');
  // hanya timpa kalau masih standby (belum ada hasil scan lain yang sedang tampil)
  if (el && el.querySelector('.kiosk-standby')){
    el.innerHTML = `<div class="kiosk-standby"><i class="fa-solid fa-circle-info"></i>
      <p>Belum terdeteksi. Pastikan kode QR <b>tegak lurus &amp; utuh terlihat</b> di kamera, jarak sekitar 10–20&nbsp;cm, pencahayaan cukup, dan kartu tidak buram/silau/terlipat.
      Kalau kamera tetap susah membaca, ketik/tempel kode atau gunakan alat pemindai USB &amp; Bluetooth lewat kolom di bawah kamera.</p></div>`;
  }
}

function resetKioskStandby(){
  const el = $('#kioskResult');
  if (el) el.innerHTML = `<div class="kiosk-standby"><i class="fa-solid fa-id-card"></i><p>Kamera siap. Arahkan kartu QR siswa ke kamera untuk absen otomatis.</p></div>`;
  clearTimeout(kioskHintTimer);
  kioskHintTimer = setTimeout(showKioskHint, KIOSK_HINT_DELAY);
  const mi = $('#kioskManualInput');
  if (mi){ mi.value = ''; mi.focus(); }
}

function startKioskCamera(){
  if (typeof Html5Qrcode === 'undefined'){
    $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--error"><i class="fa-solid fa-triangle-exclamation"></i><p>Pustaka pemindai gagal dimuat. Periksa koneksi internet lalu buka kembali mode kamera ini. Kamu tetap bisa absen lewat kolom ketik/pemindai USB di bawah.</p></div>`;
    return;
  }
  // Kartu siswa sekarang pakai kode QR (lihat printBarcodeCard) — QR jauh lebih toleran
  // terhadap sudut/jarak/resolusi kamera seadanya dibanding barcode batang (CODE128).
  // Format 1D lama tetap disertakan supaya kartu barcode yang sudah lanjut dicetak sebelumnya masih terbaca.
  const formats = (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.ITF
  ] : undefined;

  kioskScanner = new Html5Qrcode('kioskReader', {
    formatsToSupport: formats,
    useBarCodeDetectorIfSupported: true, // pakai BarcodeDetector native browser kalau tersedia — lebih cepat & akurat
    verbose: false
  });

  kioskScanner.start(
    { facingMode: 'environment' },
    {
      fps: 10,
      // qrbox persegi (bukan memanjang) — cocok untuk kode QR, dan otomatis menyesuaikan
      // ke ukuran video supaya tidak error di kamera dengan resolusi kecil.
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
        return { width: Math.max(size, 150), height: Math.max(size, 150) };
      }
    },
    (decodedText) => handleKioskScan(decodedText),
    () => { /* frame tanpa kode terdeteksi — abaikan, ini normal & terus-menerus terjadi */ }
  ).catch(err => {
    toast('Tidak bisa mengakses kamera: ' + err, 'error');
    $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--error"><i class="fa-solid fa-video-slash"></i><p>Tidak bisa mengakses kamera. Pastikan browser diberi izin kamera, lalu coba lagi. Kamu tetap bisa absen lewat kolom ketik/pemindai USB di bawah.</p></div>`;
  });
}

function stopKioskCamera(){
  if (kioskScanner){
    const s = kioskScanner;
    kioskScanner = null;
    s.stop().then(() => s.clear()).catch(() => {});
  }
  kioskBusy = false;
  clearTimeout(kioskHintTimer);
}

async function handleKioskScan(code){
  if (kioskBusy) return;
  kioskBusy = true;
  const cleanCode = String(code || '').trim();
  const s = STATE.siswa.find(x => (x.Barcode || '').toString().trim() && String(x.Barcode).trim() === cleanCode);
  const status = $('#kioskStatusSelect').value || 'Hadir';

  if (!s){
    $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--error"><i class="fa-solid fa-circle-xmark"></i><p>Kode <b>${cleanCode}</b> tidak terdaftar sebagai barcode siswa manapun.</p></div>`;
    setTimeout(() => { resetKioskStandby(); kioskBusy = false; }, KIOSK_RESULT_DELAY_ERR);
    return;
  }

  const today = new Date().toISOString().slice(0,10);
  const already = STATE.absensi.find(a => String(a.SiswaID) === String(s.ID) && a.Tanggal === today);
  const photoHtml = avatarHtmlFor(s, 96).replace('avatar-ring', 'avatar-ring kiosk-photo');

  if (already){
    $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--warn">
        ${photoHtml}
        <div class="kiosk-name">${s.Nama}</div>
        <div class="kiosk-sub">${s.Kelas||'-'} · NIS ${s.NIS||'-'}</div>
        <div class="kiosk-msg"><i class="fa-solid fa-clock-rotate-left"></i> Sudah tercatat hari ini: <b>${already.Status}</b></div>
      </div>`;
    setTimeout(() => { resetKioskStandby(); kioskBusy = false; }, KIOSK_RESULT_DELAY_INFO);
    return;
  }

  $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--pending">
      ${photoHtml}
      <div class="kiosk-name">${s.Nama}</div>
      <div class="kiosk-sub">${s.Kelas||'-'} · NIS ${s.NIS||'-'}</div>
      <div class="kiosk-msg"><i class="fa-solid fa-spinner fa-spin"></i> Menyimpan absensi...</div>
    </div>`;
  try{
    const data = { Tanggal: today, SiswaID: s.ID, Nama: s.Nama, Kelas: s.Kelas, Status: status, Keterangan: 'Absen otomatis via kamera (barcode)' };
    const created = await adapter.create('absensi', data);
    STATE.absensi.push({ ...data, ...created });
    populateClassFilters();
    renderCurrentPage();
    renderDashboard();
    $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--ok">
        ${photoHtml}
        <div class="kiosk-name">${s.Nama}</div>
        <div class="kiosk-sub">${s.Kelas||'-'} · NIS ${s.NIS||'-'}</div>
        <div class="kiosk-msg"><i class="fa-solid fa-circle-check"></i> Absen berhasil — ${status}</div>
      </div>`;
  }catch(err){
    $('#kioskResult').innerHTML = `<div class="kiosk-card kiosk-card--error"><i class="fa-solid fa-circle-xmark"></i><p>Gagal menyimpan absensi: ${err.message}</p></div>`;
  }
  setTimeout(() => { resetKioskStandby(); kioskBusy = false; }, KIOSK_RESULT_DELAY_OK);
}

function openKiosk(){
  resetKioskStandby();
  $('#kioskOverlay').classList.add('open');
  startKioskCamera();
}
function closeKiosk(){
  $('#kioskOverlay').classList.remove('open');
  stopKioskCamera();
}
$('#btnKioskAbsensi').addEventListener('click', openKiosk);
$('#kioskCloseBtn').addEventListener('click', closeKiosk);

/* Kolom ketik manual + alat pemindai barcode USB/Bluetooth (mode "keyboard wedge"):
   alat-alat ini bekerja seperti mengetik cepat lalu menekan Enter, jadi kolom ini
   sengaja selalu difokuskan ulang supaya siap menerima scan berikutnya tanpa perlu klik. */
function submitKioskManual(){
  const input = $('#kioskManualInput');
  if (!input) return;
  const code = input.value.trim();
  if (!code) return;
  input.value = '';
  handleKioskScan(code);
}
const kioskManualBtn = $('#kioskManualBtn');
const kioskManualInput = $('#kioskManualInput');
if (kioskManualBtn) kioskManualBtn.addEventListener('click', submitKioskManual);
if (kioskManualInput) kioskManualInput.addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); submitKioskManual(); }
});

$('#btnAddSiswa').addEventListener('click', () => openForm('siswa'));
$('#btnAddAbsensi').addEventListener('click', () => openForm('absensi'));
$('#btnAddPelanggaran').addEventListener('click', () => openForm('pelanggaran'));
$('#btnAddKonseling').addEventListener('click', () => openForm('konseling'));
$('#btnAddKolaborasi').addEventListener('click', () => openForm('kolaborasi'));
$('#btnAddKebiasaan').addEventListener('click', () => openForm('kebiasaan'));

/* ---------------- LAPORAN / CETAK PDF ---------------- */
const REPORT_COLUMNS = {
  siswa: ['NIS','Nama','Kelas','JenisKelamin','NamaOrtu','NoHPOrtu'],
  absensi: ['Tanggal','Nama','Kelas','Status','Keterangan'],
  pelanggaran: ['Tanggal','Nama','Kelas','JenisPelanggaran','Poin','Penanganan'],
  konseling: ['Tanggal','Nama','Kelas','Topik','HasilKonseling','TindakLanjut'],
  kolaborasi: ['Tanggal','Nama','Kelas','Jenis','Tujuan','Hasil'],
  kebiasaan: ['Tanggal','Nama','Kelas','BangunPagiPukul','IbadahSholat','OlahragaJenis','BelajarMapel','IstirahatPukul']
};
const REPORT_TITLES = {
  siswa:'Data Siswa', absensi:'Rekap Absensi Siswa', pelanggaran:'Rekap Pelanggaran Siswa',
  konseling:'Rekap Sesi Konseling', kolaborasi:'Rekap Kolaborasi (Panggilan Ortu / Home Visit)',
  kebiasaan:'Rekap 7 Kebiasaan Anak Indonesia Hebat'
};

$('#reportPeriode').addEventListener('change', () => {
  const val = $('#reportPeriode').value;
  $('#reportTanggalField').classList.toggle('hidden', val !== 'harian');
  $('#reportBulanField').classList.toggle('hidden', val !== 'bulanan');
});
$('#reportType').addEventListener('change', () => {
  const isIndividu = $('#reportType').value === 'individu';
  $('#reportKelasField').classList.toggle('hidden', isIndividu);
  $('#reportSiswaField').classList.toggle('hidden', !isIndividu);
});
(function initReportDefaults(){
  const today = new Date();
  $('#reportTanggal').value = today.toISOString().slice(0,10);
  $('#reportBulan').value = today.toISOString().slice(0,7);
})();

function filterByPeriode(rows, type){
  const periode = $('#reportPeriode').value;
  if (!periode) return rows;
  if (!('Tanggal' in (rows[0]||{})) && !REPORT_COLUMNS[type].includes('Tanggal')) return rows;
  if (periode === 'harian'){
    const tgl = $('#reportTanggal').value;
    if (!tgl) return rows;
    return rows.filter(r => (r.Tanggal||'').slice(0,10) === tgl);
  }
  if (periode === 'bulanan'){
    const bln = $('#reportBulan').value; // yyyy-mm
    if (!bln) return rows;
    return rows.filter(r => (r.Tanggal||'').slice(0,7) === bln);
  }
  return rows;
}
function periodeLabel(){
  const periode = $('#reportPeriode').value;
  if (periode === 'harian'){
    const tgl = $('#reportTanggal').value;
    return tgl ? `Harian — ${fmtDate(tgl)}` : 'Harian';
  }
  if (periode === 'bulanan'){
    const bln = $('#reportBulan').value;
    if (!bln) return 'Bulanan';
    const [y,m] = bln.split('-');
    return `Bulanan — ${new Date(y, m-1, 1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})}`;
  }
  return 'Semua Tanggal';
}

$('#btnGenerateReport').addEventListener('click', () => {
  const type = $('#reportType').value;

  if (type === 'individu'){
    const siswaId = $('#reportSiswa').value;
    if (!siswaId){ toast('Pilih siswa terlebih dahulu.', 'error'); return; }
    const s = siswaById(siswaId);
    if (!s){ toast('Data siswa tidak ditemukan.', 'error'); return; }

    const mine = (type) => filterByPeriode((STATE[type]||[]).filter(r => String(r.SiswaID) === String(siswaId)), type)
      .slice().sort((a,b)=> new Date(a.Tanggal) - new Date(b.Tanggal));
    const absensi = mine('absensi');
    const pelanggaran = mine('pelanggaran');
    const konseling = mine('konseling');
    const kolaborasi = mine('kolaborasi');
    const kebiasaan = mine('kebiasaan');
    const today = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

    const section = (title, cols, rows, emptyMsg) => `
      <h3 style="margin-top:22px">${title}</h3>
      <table>
        <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => `<tr>${cols.map(c => `<td>${c==='Tanggal'?fmtDate(r[c]):(r[c] ?? '-')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" style="text-align:center;color:#999">${emptyMsg}</td></tr>`}
        </tbody>
      </table>`;

    const html = `
      <h2>Laporan Individu Siswa</h2>
      <div class="report-head-line"><span>Periode: ${periodeLabel()}</span><span>Dicetak: ${today}</span></div>
      <div class="report-summary">
        <div class="report-summary-item"><span class="label">Nama</span><span class="value" style="font-size:14px">${s.Nama}</span></div>
        <div class="report-summary-item"><span class="label">NIS</span><span class="value" style="font-size:14px">${s.NIS||'-'}</span></div>
        <div class="report-summary-item"><span class="label">Kelas</span><span class="value" style="font-size:14px">${s.Kelas||'-'}</span></div>
        <div class="report-summary-item"><span class="label">Jenis Kelamin</span><span class="value" style="font-size:14px">${s.JenisKelamin||'-'}</span></div>
        <div class="report-summary-item"><span class="label">Orang Tua/Wali</span><span class="value" style="font-size:14px">${s.NamaOrtu||'-'}</span></div>
        <div class="report-summary-item"><span class="label">No. HP Ortu</span><span class="value" style="font-size:14px">${s.NoHPOrtu||'-'}</span></div>
      </div>
      ${buildReportSummaryHtml('absensi', absensi)}
      ${section('Rekap Absensi', ['Tanggal','Status','Keterangan'], absensi, 'Tidak ada catatan absensi')}
      ${buildReportSummaryHtml('pelanggaran', pelanggaran)}
      ${section('Rekap Pelanggaran', ['Tanggal','JenisPelanggaran','Poin','Penanganan'], pelanggaran, 'Tidak ada catatan pelanggaran')}
      ${section('Rekap Konseling', ['Tanggal','Topik','HasilKonseling','TindakLanjut'], konseling, 'Tidak ada catatan konseling')}
      ${section('Rekap Kolaborasi (Panggilan Ortu / Home Visit)', ['Tanggal','Jenis','Tujuan','Hasil'], kolaborasi, 'Tidak ada catatan kolaborasi')}
      ${section('Rekap 7 Kebiasaan Anak Indonesia Hebat', ['Tanggal','BangunPagiPukul','IbadahSholat','OlahragaJenis','BelajarMapel','IstirahatPukul'], kebiasaan, 'Belum ada catatan kebiasaan harian')}
      ${s.Catatan ? `<h3 style="margin-top:22px">Catatan Tambahan</h3><p>${s.Catatan}</p>` : ''}
    `;
    $('#reportPreview').innerHTML = html;
    $('#reportPreviewCard').style.display = 'block';
    $('#reportPreviewCard').scrollIntoView({ behavior:'smooth' });
    setTimeout(() => window.print(), 400);
    return;
  }

  const kelas = $('#reportKelas').value;
  let rows = STATE[type] || [];
  if (kelas) rows = rows.filter(r => r.Kelas === kelas);
  rows = filterByPeriode(rows, type);
  if ('Tanggal' in (rows[0]||{}) || REPORT_COLUMNS[type].includes('Tanggal')){
    rows = rows.slice().sort((a,b)=> new Date(a.Tanggal)-new Date(b.Tanggal));
  }
  const cols = REPORT_COLUMNS[type];
  const today = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

  const html = `
    <h2>${REPORT_TITLES[type]}</h2>
    <div class="report-head-line"><span>Kelas: ${kelas || 'Semua Kelas'} &nbsp;|&nbsp; Periode: ${periodeLabel()}</span><span>Dicetak: ${today}</span></div>
    ${buildReportSummaryHtml(type, rows)}
    <table>
      <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.length ? rows.map(r => `<tr>${cols.map(c => `<td>${c==='Tanggal'?fmtDate(r[c]):(r[c] ?? '-')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" style="text-align:center;color:#999">Tidak ada data</td></tr>`}
      </tbody>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#999">Total data: ${rows.length}</p>
  `;
  $('#reportPreview').innerHTML = html;
  $('#reportPreviewCard').style.display = 'block';
  $('#reportPreviewCard').scrollIntoView({ behavior:'smooth' });
  setTimeout(() => window.print(), 400);
});

/* Ringkasan total absensi (Hadir/Sakit/Izin/Alpa) & total pelanggaran, ditampilkan di atas tabel laporan */
function buildReportSummaryHtml(type, rows){
  if (type === 'absensi'){
    const count = { Hadir:0, Sakit:0, Izin:0, Alpa:0 };
    rows.forEach(r => { if (count[r.Status] !== undefined) count[r.Status]++; });
    return `
      <div class="report-summary">
        <div class="report-summary-item"><span class="label">Total Hadir</span><span class="value">${count.Hadir}</span></div>
        <div class="report-summary-item"><span class="label">Total Sakit</span><span class="value">${count.Sakit}</span></div>
        <div class="report-summary-item"><span class="label">Total Izin</span><span class="value">${count.Izin}</span></div>
        <div class="report-summary-item"><span class="label">Total Alpa</span><span class="value">${count.Alpa}</span></div>
        <div class="report-summary-item"><span class="label">Total Keseluruhan</span><span class="value">${rows.length}</span></div>
      </div>`;
  }
  if (type === 'pelanggaran'){
    const totalPoin = rows.reduce((sum, r) => sum + (Number(r.Poin) || 0), 0);
    return `
      <div class="report-summary">
        <div class="report-summary-item"><span class="label">Total Kasus Pelanggaran</span><span class="value">${rows.length}</span></div>
        <div class="report-summary-item"><span class="label">Total Poin Pelanggaran</span><span class="value">${totalPoin}</span></div>
      </div>`;
  }
  return '';
}

/* ---------------- IMPORT DATA SISWA DARI EXCEL ----------------
   Import HANYA menambahkan siswa baru (dicocokkan lewat NIS).
   Siswa yang NIS-nya sudah ada di database TIDAK akan ditimpa —
   data yang sudah kamu input manual sebelumnya tetap aman. Input
   manual lewat tombol "Tambah Siswa" tetap berfungsi seperti biasa. */
const SISWA_TEMPLATE_COLUMNS = ['NIS','Nama','Kelas','JenisKelamin','TempatTglLahir','NamaOrtu','NoHPOrtu','Alamat','Catatan','Barcode'];

function downloadSiswaTemplate(){
  const contoh = { NIS:'2201099', Nama:'Contoh Nama Siswa', Kelas:'VII-A', JenisKelamin:'L',
    TempatTglLahir:'Kota, 01-01-2012', NamaOrtu:'Nama Orang Tua', NoHPOrtu:'0812xxxxxxx',
    Alamat:'Alamat lengkap', Catatan:'', Barcode:'BK-2201099 (opsional, isi kalau kartu sudah dicetak)' };
  const ws = XLSX.utils.json_to_sheet([contoh], { header: SISWA_TEMPLATE_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
  XLSX.writeFile(wb, 'Template_Import_Siswa_BKDigital.xlsx');
}
$('#btnDownloadTemplate').addEventListener('click', downloadSiswaTemplate);

$('#btnImportSiswa').addEventListener('click', () => $('#importSiswaFile').click());
$('#importSiswaFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showLoading(true);
  try{
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
    const cleaned = rows
      .map(r => {
        const o = {};
        SISWA_TEMPLATE_COLUMNS.forEach(c => { o[c] = (r[c] !== undefined ? String(r[c]).trim() : ''); });
        return o;
      })
      .filter(r => r.NIS && r.Nama); // baris tanpa NIS/Nama diabaikan
    if (!cleaned.length){ toast('Tidak ada baris valid (butuh minimal kolom NIS & Nama).', 'error'); return; }
    const result = await adapter.importBulk('siswa', cleaned, 'NIS');
    await loadAll();
    toast(`Import selesai: ${result.added} siswa baru ditambahkan, ${result.skipped} dilewati (NIS sudah ada).`, 'success');
  }catch(err){
    toast('Gagal mengimpor file: ' + err.message, 'error');
  }finally{
    showLoading(false);
    e.target.value = '';
  }
});

/* ---------------- SETUP SCREEN / API URL ---------------- */
function enterApp(){
  $('#setupScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  loadAll();
}
$('#apiUrlSave').addEventListener('click', () => {
  const val = $('#apiUrlInput').value.trim();
  const tokenVal = $('#apiTokenInput').value.trim();
  if (!val){ toast('Masukkan URL Web App terlebih dahulu.', 'error'); return; }
  API_URL = val; API_TOKEN = tokenVal;
  adapter = RealAdapter;
  localStorage.setItem('bk_api_url', API_URL);
  localStorage.setItem('bk_api_token', API_TOKEN);
  localStorage.removeItem('bk_demo_mode');
  enterApp();
});

/* demo mode link (added dynamically under the setup note) */
(function addDemoLink(){
  const note = document.querySelector('.setup-note');
  const a = document.createElement('a');
  a.href = '#'; a.textContent = 'Coba mode demo tanpa Google Sheets →';
  a.style.cssText = 'display:inline-block;margin-top:10px;color:var(--primary);font-weight:600;font-size:12.5px;';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    adapter = DemoAdapter;
    DemoAdapter.seedIfEmpty();
    localStorage.setItem('bk_demo_mode','1');
    enterApp();
  });
  note.after(a);
})();

/* Settings button lets user change/reset API URL */
function openSettings(){
  $('#modalTitle').textContent = 'Pengaturan Koneksi';
  $('#modalBody').innerHTML = `
    <div class="field full" style="margin-bottom:16px">
      <label>URL Web App Google Apps Script</label>
      <input type="url" id="settingsApiUrl" value="${API_URL}" placeholder="https://script.google.com/macros/s/xxxxx/exec" />
    </div>
    <div class="field full" style="margin-bottom:16px">
      <label>Token / Kata Sandi Akses</label>
      <input type="password" id="settingsApiToken" value="${API_TOKEN}" placeholder="Sesuai ACCESS_TOKEN di Script Properties" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="settingsDemoBtn" type="button">Gunakan Mode Demo</button>
      <button class="btn btn-primary" id="settingsSaveBtn" type="button"><i class="fa-solid fa-check"></i> Simpan &amp; Muat Ulang</button>
    </div>`;
  $('#settingsSaveBtn').addEventListener('click', () => {
    const val = $('#settingsApiUrl').value.trim();
    const tokenVal = $('#settingsApiToken').value.trim();
    if (!val){ toast('URL tidak boleh kosong.', 'error'); return; }
    API_URL = val; API_TOKEN = tokenVal; adapter = RealAdapter;
    localStorage.setItem('bk_api_url', API_URL);
    localStorage.setItem('bk_api_token', API_TOKEN);
    localStorage.removeItem('bk_demo_mode');
    closeModal(); loadAll(); toast('Pengaturan disimpan.', 'success');
  });
  $('#settingsDemoBtn').addEventListener('click', () => {
    adapter = DemoAdapter; DemoAdapter.seedIfEmpty();
    localStorage.setItem('bk_demo_mode','1');
    closeModal(); loadAll(); toast('Mode demo diaktifkan.', 'success');
  });
  openModal();
}
$('#settingsBtn').addEventListener('click', openSettings);
$('#settingsBtnMobile').addEventListener('click', () => { closeMoreSheet(); openSettings(); });

/* ---------------- MOBILE HAMBURGER (opens sidebar-equivalent: more sheet w/ full nav) ---------------- */
$('#hamburgerBtn').addEventListener('click', openMoreSheet);

/* ---------------- INIT ---------------- */
(function init(){
  if (localStorage.getItem('bk_demo_mode') === '1'){
    adapter = DemoAdapter; DemoAdapter.seedIfEmpty(); enterApp();
  } else if (API_URL){
    $('#apiUrlInput').value = API_URL;
    $('#apiTokenInput').value = API_TOKEN;
    adapter = RealAdapter; enterApp();
  }
})();
