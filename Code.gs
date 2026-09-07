/* ============================================================
   BK DIGITAL — BACKEND (Google Apps Script)
   ------------------------------------------------------------
   Cara pasang:
   1. Buka Google Sheet yang jadi database BK Digital kamu.
   2. Extensions > Apps Script.
   3. Ganti/isi file Code.gs dengan seluruh isi file ini.
   4. Buka Project Settings (ikon gerigi) > Script Properties >
      tambahkan property bernama  ACCESS_TOKEN  dengan nilai bebas
      (contoh: kata sandi acak yang cuma kamu & guru BK tahu).
      Token ini TIDAK ikut ter-commit ke GitHub, jadi lebih aman.
   5. Deploy > New deployment > Web app.
        - Execute as: Me
        - Who has access: Anyone
      (Kalau sekolah pakai Google Workspace, pilih "Anyone within
       [nama organisasi]" supaya hanya akun sekolah yang bisa akses —
       ini jauh lebih aman daripada "Anyone".)
   6. Salin URL Web App yang dihasilkan, tempel di layar login
      BK Digital bersama ACCESS_TOKEN yang kamu buat di langkah 4.

   Catatan keamanan:
   - Kode di GitHub bersifat publik dan TIDAK menyimpan data siswa
     sama sekali — data selalu hidup di Google Sheet ini.
   - ACCESS_TOKEN membuat siapapun yang tidak tahu token tidak bisa
     memanggil API ini walau tahu URL-nya.
   - Update kode di GitHub (frontend) tidak pernah menyentuh Sheet
     ini, jadi tidak akan pernah menghapus/mengubah data yang sudah
     tersimpan.
   ============================================================ */

var TYPE_SHEET = {
  siswa: 'Siswa',
  absensi: 'Absensi',
  pelanggaran: 'Pelanggaran',
  konseling: 'Konseling',
  kolaborasi: 'Kolaborasi',
  kebiasaan: 'Kebiasaan'
};

/* Header default per sheet — dipakai HANYA saat sheet belum ada / masih kosong,
   supaya sheet baru otomatis dibuat dengan kolom yang benar tanpa mengganggu
   sheet yang sudah berisi data (yang sudah ada headernya dipakai apa adanya). */
var DEFAULT_HEADERS = {
  Siswa: ['ID','NIS','Nama','Kelas','JenisKelamin','TempatTglLahir','Alamat','NamaOrtu','NoHPOrtu','Catatan','Barcode','FotoURL'],
  Absensi: ['ID','Tanggal','SiswaID','Nama','Kelas','Status','Keterangan'],
  Pelanggaran: ['ID','Tanggal','SiswaID','Nama','Kelas','JenisPelanggaran','Poin','Keterangan','Penanganan'],
  Konseling: ['ID','Tanggal','SiswaID','Nama','Kelas','Topik','Konselor','Masalah','HasilKonseling','TindakLanjut'],
  Kolaborasi: ['ID','Tanggal','SiswaID','Nama','Kelas','Jenis','Petugas','Tujuan','Hasil'],
  Kebiasaan: ['ID','Tanggal','SiswaID','Nama','Kelas','BangunPagiPukul','IbadahSholat','IbadahDhuha','IbadahTadarus',
    'IbadahLainnya','OlahragaJenis','OlahragaDurasi','BelajarMapel','MakanMenu','BermasyarakatKegiatan',
    'IstirahatPukul','ParafOrtu','ParafGuru','CatatanGuru']
};

var ID_PREFIX = { siswa:'SIS', absensi:'ABS', pelanggaran:'PEL', konseling:'KON', kolaborasi:'KOL', kebiasaan:'HAB' };

/* ---------------- ENTRY POINTS ---------------- */
function doGet(e){
  try{
    var params = e.parameter || {};
    checkToken(params.token);
    var action = params.action;
    if (action === 'getAll'){
      var type = params.type;
      return jsonOut({ ok:true, data: readSheet(type) });
    }
    return jsonOut({ ok:false, error:'Aksi GET tidak dikenal.' });
  }catch(err){
    return jsonOut({ ok:false, error: err.message });
  }
}

function doPost(e){
  try{
    var body = JSON.parse(e.postData.contents || '{}');
    checkToken(body.token);
    var action = body.action;
    var type = body.type;

    if (action === 'create'){
      var row = createRow(type, body.data || {});
      return jsonOut({ ok:true, data: row });
    }
    if (action === 'update'){
      var updated = updateRow(type, body.id, body.data || {});
      return jsonOut({ ok:true, data: updated });
    }
    if (action === 'delete'){
      deleteRow(type, body.id);
      return jsonOut({ ok:true });
    }
    if (action === 'importBulk'){
      var result = importBulk(type, body.rows || [], body.matchField || 'NIS');
      return jsonOut({ ok:true, data: result });
    }
    return jsonOut({ ok:false, error:'Aksi POST tidak dikenal.' });
  }catch(err){
    return jsonOut({ ok:false, error: err.message });
  }
}

/* ---------------- AUTH ---------------- */
function checkToken(token){
  var expected = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  if (!expected){
    // Belum diset sama sekali -> jangan blokir supaya tidak mengunci diri sendiri saat setup pertama,
    // tapi sangat disarankan untuk segera mengisi ACCESS_TOKEN di Script Properties.
    return;
  }
  if (!token || String(token) !== String(expected)){
    throw new Error('Token akses salah atau kosong. Periksa pengaturan koneksi di aplikasi.');
  }
}

/* ---------------- SHEET HELPERS ---------------- */
function getSheet(type){
  var name = TYPE_SHEET[type];
  if (!name) throw new Error('Tipe data tidak dikenal: ' + type);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet){
    sheet = ss.insertSheet(name);
    var headers = DEFAULT_HEADERS[name] || ['ID'];
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders(sheet, DEFAULT_HEADERS[name]);
  }
  return sheet;
}

/* Menambahkan kolom baru ke sheet yang SUDAH ADA jika kolom tersebut belum
   punya header (misalnya kolom Barcode & FotoURL yang ditambahkan di update
   fitur absensi barcode ini). Kolom baru SELALU ditambahkan di ujung kanan
   sheet, jadi kolom & data lama tidak pernah bergeser atau tersentuh sama
   sekali. Aman dijalankan berkali-kali. */
function ensureHeaders(sheet, defaultHeaders){
  if (!defaultHeaders || !defaultHeaders.length) return;
  var current = getHeaders(sheet);
  var missing = defaultHeaders.filter(function(h){ return current.indexOf(h) === -1; });
  if (!missing.length) return;
  var startCol = Math.max(sheet.getLastColumn(), current.length) + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
}

function getHeaders(sheet){
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1,1,1,lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
}

function readSheet(type){
  var sheet = getSheet(type);
  var headers = getHeaders(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2,1,lastRow-1, headers.length).getValues();
  var out = [];
  for (var i=0;i<values.length;i++){
    var row = values[i];
    var isEmpty = row.every(function(c){ return c === '' || c === null; });
    if (isEmpty) continue;
    var obj = {};
    for (var c=0;c<headers.length;c++){
      if (!headers[c]) continue;
      var val = row[c];
      if (val instanceof Date){
        val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
      }
      obj[headers[c]] = val;
    }
    obj._row = i + 2; // internal, not required by frontend but harmless if ignored
    out.push(obj);
  }
  return out;
}

function findRowIndexById(sheet, headers, id){
  var idCol = headers.indexOf('ID');
  if (idCol === -1) throw new Error('Kolom ID tidak ditemukan di sheet.');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, idCol+1, lastRow-1, 1).getValues();
  for (var i=0;i<ids.length;i++){
    if (String(ids[i][0]) === String(id)) return i+2;
  }
  return -1;
}

function createRow(type, data){
  var sheet = getSheet(type);
  var headers = getHeaders(sheet);
  if (!data.ID){
    data.ID = (ID_PREFIX[type] || 'ID') + '-' + Date.now().toString(36).toUpperCase();
  }
  var rowValues = headers.map(function(h){ return (data[h] !== undefined && data[h] !== null) ? data[h] : ''; });
  sheet.appendRow(rowValues);
  return data;
}

/* Update HANYA mengubah kolom yang dikirim; kolom lain & baris lain tidak tersentuh sama sekali. */
function updateRow(type, id, data){
  var sheet = getSheet(type);
  var headers = getHeaders(sheet);
  var rowIdx = findRowIndexById(sheet, headers, id);
  if (rowIdx === -1) throw new Error('Data dengan ID ' + id + ' tidak ditemukan.');
  Object.keys(data).forEach(function(key){
    var col = headers.indexOf(key);
    if (col === -1) return; // kolom tidak dikenal, lewati (tidak menambah kolom liar)
    sheet.getRange(rowIdx, col+1).setValue(data[key]);
  });
  var current = {};
  var rowValues = sheet.getRange(rowIdx,1,1,headers.length).getValues()[0];
  headers.forEach(function(h,i){ current[h] = rowValues[i]; });
  return current;
}

function deleteRow(type, id){
  var sheet = getSheet(type);
  var headers = getHeaders(sheet);
  var rowIdx = findRowIndexById(sheet, headers, id);
  if (rowIdx === -1) throw new Error('Data dengan ID ' + id + ' tidak ditemukan.');
  sheet.deleteRow(rowIdx);
}

/* Import massal dari Excel/CSV: HANYA menambahkan baris baru.
   Baris yang matchField-nya (misal NIS) sudah ada di sheet akan DILEWATI,
   bukan ditimpa — data lama dijamin tidak berubah. */
function importBulk(type, rows, matchField){
  var sheet = getSheet(type);
  var headers = getHeaders(sheet);
  var matchCol = headers.indexOf(matchField);
  var existingKeys = {};
  if (matchCol !== -1){
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2){
      var vals = sheet.getRange(2, matchCol+1, lastRow-1, 1).getValues();
      vals.forEach(function(v){
        var k = String(v[0]).trim().toLowerCase();
        if (k) existingKeys[k] = true;
      });
    }
  }
  var added = 0, skipped = 0, skippedRows = [];
  rows.forEach(function(r){
    var keyVal = matchCol !== -1 ? String(r[matchField] || '').trim().toLowerCase() : '';
    if (matchCol !== -1 && keyVal && existingKeys[keyVal]){
      skipped++; skippedRows.push(r[matchField]);
      return;
    }
    if (!r.ID){ r.ID = (ID_PREFIX[type] || 'ID') + '-' + Date.now().toString(36).toUpperCase() + '-' + added; }
    var rowValues = headers.map(function(h){ return (r[h] !== undefined && r[h] !== null) ? r[h] : ''; });
    sheet.appendRow(rowValues);
    if (matchCol !== -1 && keyVal) existingKeys[keyVal] = true;
    added++;
  });
  return { added: added, skipped: skipped, skippedKeys: skippedRows };
}

/* ---------------- OUTPUT ---------------- */
function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
