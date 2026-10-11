/* ============================================================
   BK DIGITAL — HALAMAN GURU PIKET (Absensi QR)
   ------------------------------------------------------------
   Halaman mandiri, terpisah dari aplikasi utama. Login memakai akun
   Guru Piket (1 akun bersama; diatur Admin di Script Properties
   PIKET_USERNAME / PIKET_PASSWORD — lihat Code.gs). Akun ini hanya bisa
   memanggil aksi "piketScan" & "piketToday": server yang mencocokkan kode
   QR ke siswa, menentukan tanggal/jam, dan mencegah absen ganda. Halaman
   ini tidak pernah menerima daftar siswa.
   ============================================================ */

/* URL Web App — HARUS sama dengan DEFAULT_API_URL di script.js. */
const API_URL = 'https://script.google.com/macros/s/AKfycbzy7zvyVxqgdTyYVyaHvs4I0E1h7YldvVKDDAJFRhfeBKcR8-GUAbFt2KWxfrakZCz2/exec';

const LS_TOKEN = 'bk_piket_token';
const LS_NAMA = 'bk_piket_nama';
const $ = (s) => document.querySelector(s);
const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

let TOKEN = localStorage.getItem(LS_TOKEN) || '';
let scanner = null, facingMode = 'environment', camOn = false, camBusy = false;
let busy = false, lastCode = '', lastTime = 0, standbyTimer = null, wakeLock = null;

const DELAY = { ok: 2500, already: 3200, notfound: 2500, error: 3200 };

/* ---------------- API ---------------- */
async function api(action, payload){
  const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: TOKEN }, payload || {})) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Permintaan gagal');
  return json.data;
}
function isSessionError(msg){
  return /Sesi login|Akun Guru Piket|belum diatur|Hanya Admin atau Guru Piket/i.test(String(msg || ''));
}

/* ---------------- LOGIN / LOGOUT ---------------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn'), err = $('#loginError');
  err.textContent = '';
  btn.disabled = true;
  try{
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({
      action: 'loginPiket', username: $('#loginUser').value.trim(), password: $('#loginPass').value }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Login gagal');
    TOKEN = json.data.sessionToken;
    localStorage.setItem(LS_TOKEN, TOKEN);
    localStorage.setItem(LS_NAMA, json.data.nama || 'Guru Piket');
    $('#loginPass').value = '';
    enterApp();
  }catch(ex){
    err.textContent = (ex instanceof TypeError) ? 'Tidak bisa terhubung ke server. Periksa koneksi internet.' : ex.message;
  }finally{
    btn.disabled = false;
  }
});

function logout(message){
  TOKEN = '';
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_NAMA);
  stopCamera();
  releaseWakeLock();
  clearTimeout(standbyTimer);
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
  $('#loginError').textContent = message || '';
}
$('#logoutBtn').addEventListener('click', () => logout(''));

/* ---------------- MASUK APLIKASI ---------------- */
function enterApp(){
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  busy = false; lastCode = '';
  resetStandby('Menyalakan kamera...');
  startCamera();
  loadSchoolProfile();
  refreshToday();
  requestWakeLock();
}

async function loadSchoolProfile(){
  try{
    const s = await api('getSettings');
    if (s && s.NamaSekolah) $('#schoolName').textContent = s.NamaSekolah;
    if (s && s.LogoSekolah && String(s.LogoSekolah).startsWith('data:image/')) $('#schoolLogo').src = s.LogoSekolah;
  }catch(e){ if (isSessionError(e.message)) logout(e.message); }
}

/* ---------------- JAM & TANGGAL ---------------- */
function tickClock(){
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' }).replace(/\./g, ':');
  $('#todayDate').textContent = d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
tickClock(); setInterval(tickClock, 1000);

/* ---------------- LAYAR TETAP MENYALA (tablet/HP piket) ---------------- */
async function requestWakeLock(){
  try{ if ('wakeLock' in navigator && TOKEN) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){ /* tidak didukung — abaikan */ }
}
function releaseWakeLock(){ try{ if (wakeLock) wakeLock.release(); }catch(e){} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && TOKEN){ requestWakeLock(); refreshToday(); }
});

/* ---------------- KAMERA ---------------- */
function resetStandby(text){
  $('#result').innerHTML = `<div class="pk-standby"><i class="fa-solid fa-id-card"></i><p>${escapeHtml(text || 'Kamera siap. Arahkan kartu QR siswa ke kamera.')}</p></div>`;
  clearTimeout(standbyTimer);
  standbyTimer = setTimeout(() => {
    const el = $('#result');
    if (el && el.querySelector('.pk-standby') && camOn){
      el.innerHTML = `<div class="pk-standby"><i class="fa-solid fa-circle-info"></i><p>Belum terdeteksi. Pastikan QR utuh & tegak lurus, jarak 10–20&nbsp;cm, cahaya cukup. Bisa juga ketik kode di kolom bawah.</p></div>`;
    }
  }, 9000);
}

function startCamera(){
  if (camBusy || camOn) return Promise.resolve();
  camBusy = true;
  return new Promise((resolve, reject) => {
    if (typeof Html5Qrcode === 'undefined'){ reject(new Error('Pustaka pemindai belum termuat')); return; }
    const formats = (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [Html5QrcodeSupportedFormats.QR_CODE] : undefined;
    scanner = new Html5Qrcode('reader', { formatsToSupport: formats, useBarCodeDetectorIfSupported: true, verbose: false });
    scanner.start(
      { facingMode },
      { fps: 10, qrbox: (vw, vh) => { const s = Math.floor(Math.min(vw, vh) * 0.7); return { width: Math.max(s, 150), height: Math.max(s, 150) }; } },
      (text) => handleScan(text),
      () => {}
    ).then(resolve).catch(reject);
  }).then(() => {
    camOn = true; camBusy = false; updateCamButton();
    resetStandby();
  }).catch((err) => {
    camOn = false; camBusy = false; scanner = null; updateCamButton();
    $('#result').innerHTML = `<div class="pk-card-res pk-card-res--err"><i class="fa-solid fa-video-slash"></i><p>Tidak bisa mengakses kamera. Izinkan akses kamera di browser (butuh HTTPS), lalu tekan tombol kamera. Kamu tetap bisa mengetik kode di kolom bawah.</p></div>`;
    console.warn('Kamera gagal:', err);
  });
}

function stopCamera(){
  camOn = false; camBusy = false;
  const s = scanner; scanner = null;
  updateCamButton();
  if (!s) return Promise.resolve();
  return s.stop().then(() => s.clear()).catch(() => {});
}
function updateCamButton(){
  const b = $('#camToggleBtn');
  if (b) b.innerHTML = camOn ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
}
$('#camToggleBtn').addEventListener('click', async () => {
  if (camOn){ await stopCamera(); resetStandby('Kamera dimatikan. Tekan tombol kamera untuk menyalakan.'); }
  else { resetStandby('Menyalakan kamera...'); startCamera(); }
});
$('#camSwitchBtn').addEventListener('click', async () => {
  const prev = facingMode;
  facingMode = prev === 'environment' ? 'user' : 'environment';
  await stopCamera();
  resetStandby('Mengganti kamera...');
  await startCamera();
  if (!camOn){ facingMode = prev; await startCamera(); }
});

/* ---------------- BEEP ---------------- */
function beep(kind){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
    const bad = kind !== 'ok';
    osc.frequency.value = bad ? 220 : 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(bad ? 0.18 : 0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (bad ? 0.35 : 0.22));
    osc.start(); osc.stop(ctx.currentTime + (bad ? 0.35 : 0.22));
    osc.onended = () => ctx.close();
  }catch(e){}
}

/* ---------------- PROSES SCAN ---------------- */
function showCard(cls, icon, bodyHtml){
  $('#result').innerHTML = `<div class="pk-card-res pk-card-res--${cls}"><i class="fa-solid ${icon}"></i>${bodyHtml}</div>`;
}
const personHtml = (r) => `<div class="pk-name">${escapeHtml(r.nama)}</div><div class="pk-sub">${escapeHtml(r.kelas || '-')} · NIS ${escapeHtml(r.nis || '-')}</div>`;

async function handleScan(raw){
  const code = String(raw || '').trim();
  if (!code || busy) return;
  if (code === lastCode && Date.now() - lastTime < 4000) return; // kartu yang sama masih di depan kamera
  busy = true; lastCode = code; lastTime = Date.now();
  showCard('pending', 'fa-spinner fa-spin', '<p>Memeriksa kartu...</p>');
  let delay = DELAY.error;
  try{
    const r = await api('piketScan', { code, status: $('#statusSelect').value });
    if (r.result === 'ok'){
      beep('ok'); delay = DELAY.ok;
      showCard('ok', 'fa-circle-check', personHtml(r) + `<div class="pk-msg">Absen berhasil — ${escapeHtml(r.status)}</div>`);
      refreshToday();
    } else if (r.result === 'already'){
      beep('bad'); delay = DELAY.already;
      showCard('warn', 'fa-clock-rotate-left', personHtml(r) + `<div class="pk-msg">Sudah absen hari ini: ${escapeHtml(r.status)}</div>`);
    } else {
      beep('bad'); delay = DELAY.notfound;
      showCard('err', 'fa-circle-xmark', `<p>Kode <b>${escapeHtml(r.code || code)}</b> tidak terdaftar sebagai kartu siswa.</p>`);
    }
  }catch(ex){
    beep('bad');
    if (isSessionError(ex.message)){ busy = false; logout(ex.message); return; }
    const msg = (ex instanceof TypeError) ? 'Tidak bisa terhubung ke server. Periksa koneksi internet, lalu pindai ulang.' : ex.message;
    showCard('err', 'fa-triangle-exclamation', `<p>${escapeHtml(msg)}</p>`);
    lastCode = ''; // izinkan scan ulang segera setelah gagal
  }
  setTimeout(() => { busy = false; if (TOKEN) resetStandby(); const mi = $('#manualInput'); if (mi) mi.focus(); }, delay);
}

$('#manualForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#manualInput'), code = input.value.trim();
  if (!code) return;
  input.value = '';
  lastCode = ''; // input manual selalu diproses
  handleScan(code);
});

/* ---------------- REKAP HARI INI ---------------- */
async function refreshToday(){
  if (!TOKEN) return;
  try{
    const d = await api('piketToday');
    $('#cHadir').textContent = d.counts.Hadir || 0;
    $('#cSakit').textContent = d.counts.Sakit || 0;
    $('#cIzin').textContent = d.counts.Izin || 0;
    $('#cTotal').textContent = d.total || 0;
    const list = $('#recentList');
    if (!d.recent.length){ list.innerHTML = '<li class="pk-empty">Belum ada absensi hari ini.</li>'; return; }
    list.innerHTML = d.recent.map(r => {
      const jam = (String(r.Keterangan || '').match(/\((\d{2}:\d{2})\)/) || [])[1];
      const st = escapeHtml(r.Status);
      return `<li><div class="pk-who"><b>${escapeHtml(r.Nama)}</b><small>${escapeHtml(r.Kelas || '-')}${jam ? ' · ' + jam : ''}</small></div><span class="pk-chip pk-chip--${st}">${st || '-'}</span></li>`;
    }).join('');
  }catch(e){ if (isSessionError(e.message)) logout(e.message); }
}
$('#refreshBtn').addEventListener('click', refreshToday);
setInterval(refreshToday, 60000);

/* ---------------- INIT ---------------- */
if (TOKEN){ enterApp(); } else { $('#loginUser').focus(); }
