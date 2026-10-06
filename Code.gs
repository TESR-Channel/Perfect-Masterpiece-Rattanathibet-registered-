/**
 * ระบบลงทะเบียน + ตั๋ว QR + เช็กอินหน้างาน
 * การประชุมใหญ่ลูกบ้าน ครั้งที่ 2/2569 — ป้อม 8 และป้อม 6
 *
 * ติดตั้ง: เปิด Google Sheets ไฟล์ปลายทาง → ส่วนขยาย → Apps Script → วางโค้ดนี้ทั้งหมด
 * (ระบุไฟล์ปลายทางด้วย SHEET_ID ด้านล่าง)
 *
 * แท็บที่ระบบสร้างให้อัตโนมัติ:
 *   ลงทะเบียน — รายชื่อผู้ลงทะเบียนล่วงหน้า + สถานะเข้างาน
 *   เข้างาน   — บันทึกการสแกน QR หน้างานทุกครั้ง
 *   สรุป      — ยอดรวม + แยก 4 โซน (เปอร์เซ็นต์ต่อโซน / สัดส่วนต่อทั้งหมด)
 *   บ้านทั้งหมด — รายชื่อบ้านทุกหลังพร้อมโซน และสถานะลงทะเบียน/เข้างาน
 */

const STAFF_PIN = '0000';     // ← ใส่รหัสเจ้าหน้าที่จริงใน Apps Script เท่านั้น (repo นี้เป็น public)
const FOLDER_ID = '';       // โฟลเดอร์ Drive เก็บไฟล์ลายเซ็น (เว้นว่างได้ — รูปลายเซ็นจะอยู่ในชีตอยู่แล้ว)
const REF_PREFIX = 'M2-';
const TZ = 'Asia/Bangkok';
// ID ของไฟล์ Google Sheets ปลายทาง (ใส่ใน Apps Script เท่านั้น — เว้นว่าง = ใช้ไฟล์ที่ผูกกับสคริปต์)
const SHEET_ID = '';

const SH_REG = 'ลงทะเบียน', SH_LOG = 'เข้างาน', SH_SUM = 'สรุป', SH_HOUSE = 'บ้านทั้งหมด';

/* ===== โซน: บ้านเลขที่ 112/เลขแปลง → โซน (ตรงกับ houses.csv / zones.js) ===== */
const ZONES = [
  { name: '11 ไร่',             from: 121, to: 155, skip: [130, 132] },
  { name: '22 ไร่ (ป้อม6)',      from: 400, to: 437, skip: [] },
  { name: '44 ไร่ (ป้อม8/1)',    from: 1,   to: 120, skip: [1, 2, 3, 4, 6, 10, 11, 12, 13, 23] },
  { name: '74 ไร่ (เซ็นจูรี่)',   from: 156, to: 307, skip: [] },
];
const ZONE_UNKNOWN = 'ไม่ทราบโซน';
function zoneOf_(house) {
  const m = /^112\/(\d{1,4})$/.exec(String(house || '').replace(/\s+/g, ''));
  if (!m) return ZONE_UNKNOWN;
  const n = Number(m[1]), z = ZONES.filter(z => n >= z.from && n <= z.to)[0];
  return z ? z.name : ZONE_UNKNOWN;
}
function allHouses_() {
  const out = [];
  ZONES.forEach(z => { for (let n = z.from; n <= z.to; n++) if (z.skip.indexOf(n) < 0) out.push([`112/${n}`, n, z.name]); });
  return out.sort((a, b) => a[1] - b[1]);
}
const ST_WAIT = 'ยังไม่เข้างาน', ST_IN = 'เข้างานแล้ว';

const REG_HEADERS = ['ลำดับ', 'วันเวลาที่ลงทะเบียน', 'รหัสลงทะเบียน', 'บ้านเลขที่', 'ชื่อ และนามสกุล',
  'เบอร์โทรศัพท์', 'จำนวนผู้เข้าร่วม', 'ลายเซ็น', 'สถานะเข้างาน', 'เวลาเข้างาน', 'โซน',
  'รหัส QR', 'ไฟล์ลายเซ็น (Drive)', 'อุปกรณ์'];
const C = { seq: 1, when: 2, ref: 3, house: 4, name: 5, phone: 6, people: 7, sig: 8,
  status: 9, inAt: 10, zone: 11, token: 12, file: 13, ua: 14 };
const LOG_HEADERS = ['เวลาสแกน', 'รหัสลงทะเบียน', 'บ้านเลขที่', 'ชื่อ และนามสกุล',
  'จำนวนผู้เข้าร่วม', 'ผลการสแกน', 'อุปกรณ์เจ้าหน้าที่'];

/* ---------- Setup ---------- */
function styleHeader_(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0E2A5E').setFontColor('#FFFFFF').setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 36);
}

/* เปิดไฟล์ด้วย ID + หาแท็บด้วย getSheets() (เลี่ยงบั๊ก "Sheet 0 not found" ของ getSheetByName) */
const ss_ = () => SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
const tab_ = (ss, name) => ss.getSheets().filter(s => s.getName() === name)[0] || null;
function newTab_(ss, name, pos) {
  const sh = ss.insertSheet(name);
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(pos); } catch (e) {}
  return sh;
}

function setup_() {
  const ss = ss_();
  let reg = tab_(ss, SH_REG);
  if (!reg) {
    reg = newTab_(ss, SH_REG, 1);
    styleHeader_(reg, REG_HEADERS);
    reg.getRange('D:D').setNumberFormat('@');
    reg.getRange('F:F').setNumberFormat('@');
    [60, 150, 110, 100, 220, 120, 110, 200, 130, 150, 90, 140, 170, 200].forEach((w, i) => reg.setColumnWidth(i + 1, w));
    const rule1 = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(ST_IN)
      .setBackground('#E3F5EA').setFontColor('#15803D').setBold(true).setRanges([reg.getRange('I2:I')]).build();
    const rule2 = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(ST_WAIT)
      .setFontColor('#9A6700').setRanges([reg.getRange('I2:I')]).build();
    reg.setConditionalFormatRules([rule1, rule2]);
  }
  let log = tab_(ss, SH_LOG);
  if (!log) {
    log = newTab_(ss, SH_LOG, 2);
    styleHeader_(log, LOG_HEADERS);
    log.getRange('C:C').setNumberFormat('@');
    [150, 110, 100, 220, 110, 140, 200].forEach((w, i) => log.setColumnWidth(i + 1, w));
  }
  let house = tab_(ss, SH_HOUSE);
  if (!house) { house = newTab_(ss, SH_HOUSE, 4); buildHouses_(house); }
  let sum = tab_(ss, SH_SUM);
  if (!sum) sum = newTab_(ss, SH_SUM, 3);
  if (sum.getRange('A4').getValue() !== 'โซน') { backfillZones_(reg); buildSummary_(sum); }
  const def = tab_(ss, 'Sheet1') || tab_(ss, 'ชีต1') || tab_(ss, 'แผ่นงา๙1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 3) { try { ss.deleteSheet(def); } catch (e) {} }
  try { ss.setActiveSheet(reg); } catch (e) {}
  return { reg, log, sum };
}

/* แท็บ บ้านทั้งหมด: บ้านทุกหลัง + โซน + สถานะ (สูตรอัปเดตเอง) */
function buildHouses_(sh) {
  const R = `'${SH_REG}'`, list = allHouses_();
  styleHeader_(sh, ['บ้านเลขที่', 'เลขแปลง', 'โซน', 'สถานะลงทะเบียน', 'สถานะเข้างาน']);
  sh.getRange('A:A').setNumberFormat('@');
  const rows = list.map((h, i) => {
    const r = i + 2;
    return [h[0], h[1], h[2],
      `=IF(COUNTIF(${R}!D:D,A${r}),"ลงทะเบียนแล้ว","ยังไม่ลงทะเบียน")`,
      `=IFERROR(INDEX(${R}!I:I,MATCH(A${r},${R}!D:D,0)),"")`];
  });
  sh.getRange(2, 1, rows.length, 5).setValues(rows);
  [110, 80, 170, 150, 130].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  const rng = sh.getRange(2, 4, rows.length, 2);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ลงทะเบียนแล้ว').setBackground('#E3F5EA').setFontColor('#15803D').setRanges([rng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(ST_IN).setBackground('#E3F5EA').setFontColor('#15803D').setBold(true).setRanges([rng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ยังไม่ลงทะเบียน').setFontColor('#9AA7BA').setRanges([rng]).build(),
  ]);
  sh.setFrozenRows(1);
}

/* ใส่โซนให้แถวเก่าที่ยังไม่มีโซน */
function backfillZones_(reg) {
  const last = reg.getLastRow();
  if (last < 2) return;
  const vals = reg.getRange(2, 1, last - 1, C.zone).getValues();
  const zones = vals.map(r => [r[C.zone - 1] || zoneOf_(r[C.house - 1])]);
  reg.getRange(2, C.zone, zones.length, 1).setValues(zones);
}

/* แท็บ สรุป: ภาพรวม + แยก 4 โซน */
function buildSummary_(sh) {
  sh.clear(); sh.getCharts().forEach(c => sh.removeChart(c));
  const R = `'${SH_REG}'`, H = `'${SH_HOUSE}'`;
  sh.getRange('A1').setValue('สรุปการประชุมใหญ่ลูกบ้าน ครั้งที่ 2/2569').setFontSize(16).setFontWeight('bold').setFontColor('#0E2A5E');
  sh.getRange('A2').setValue('อัปเดตอัตโนมัติจากแท็บ ลงทะเบียน และ บ้านทั้งหมด').setFontColor('#4A5568');
  const head = ['โซน', 'บ้านทั้งหมด', 'ลงทะเบียน (บ้าน)', '% ลงทะเบียนของโซน', 'ผู้เข้าร่วมที่แจ้ง (คน)',
    'สัดส่วนของผู้ลงทะเบียนทั้งหมด', 'มาเข้างาน (บ้าน)', '% มาเข้างานของโซน', 'มาเข้างาน (คน)'];
  sh.getRange(4, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#0E2A5E').setFontColor('#FFFFFF').setWrap(true).setVerticalAlignment('middle');
  const names = ZONES.map(z => z.name).concat([ZONE_UNKNOWN]);
  const first = 5, tot = first + names.length;
  const rows = names.map((n, i) => {
    const r = first + i;
    return [n,
      n === ZONE_UNKNOWN ? 0 : `=COUNTIF(${H}!C2:C,A${r})`,
      `=COUNTIF(${R}!K2:K,A${r})`,
      `=IFERROR(C${r}/B${r},0)`,
      `=SUMIF(${R}!K2:K,A${r},${R}!G2:G)`,
      `=IFERROR(C${r}/C$${tot},0)`,
      `=COUNTIFS(${R}!K2:K,A${r},${R}!I2:I,"${ST_IN}")`,
      `=IFERROR(G${r}/B${r},0)`,
      `=SUMIFS(${R}!G2:G,${R}!K2:K,A${r},${R}!I2:I,"${ST_IN}")`];
  });
  rows.push(['รวมทั้งหมด', `=SUM(B${first}:B${tot - 1})`, `=SUM(C${first}:C${tot - 1})`, `=IFERROR(C${tot}/B${tot},0)`,
    `=SUM(E${first}:E${tot - 1})`, `=IFERROR(C${tot}/C${tot},0)`, `=SUM(G${first}:G${tot - 1})`, `=IFERROR(G${tot}/B${tot},0)`, `=SUM(I${first}:I${tot - 1})`]);
  sh.getRange(first, 1, rows.length, head.length).setValues(rows).setFontSize(12).setVerticalAlignment('middle');
  sh.getRange(first, 2, rows.length, head.length - 1).setHorizontalAlignment('center');
  [`D${first}:D${tot}`, `F${first}:F${tot}`, `H${first}:H${tot}`].forEach(a => sh.getRange(a).setNumberFormat('0.0%'));
  sh.getRange(tot, 1, 1, head.length).setFontWeight('bold').setBackground('#FFF4D1');
  sh.getRange(first + names.length - 1, 1, 1, head.length).setFontColor('#9AA7BA');
  sh.setColumnWidth(1, 190); for (let c = 2; c <= head.length; c++) sh.setColumnWidth(c, 125);
  sh.setRowHeight(4, 48); sh.setFrozenRows(4);
  try {
    sh.insertChart(sh.newChart().setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange(`A4:A${first + ZONES.length - 1}`)).addRange(sh.getRange(`D4:D${first + ZONES.length - 1}`))
      .setNumHeaders(1).setPosition(tot + 2, 1, 0, 0)
      .setOption('title', '% ลงทะเบียนของแต่ละโซน').setOption('legend', { position: 'none' })
      .setOption('vAxis', { format: 'percent', minValue: 0, maxValue: 1 }).setOption('colors', ['#0E2A5E']).build());
  } catch (e) {}
}

/* ---------- Helpers ---------- */
const norm_ = s => String(s || '').replace(/\s+/g, '').trim();
const digits_ = s => String(s || '').replace(/\D/g, '');
const json_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const fmt_ = d => d instanceof Date ? Utilities.formatDate(d, TZ, 'd/M/yyyy HH:mm') : String(d || '');

function rows_(reg) {
  const last = reg.getLastRow();
  return last < 2 ? [] : reg.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
}
function find_(reg, col, value) {
  const v = norm_(value);
  if (!v) return null;
  const rs = rows_(reg);
  for (let i = 0; i < rs.length; i++) if (norm_(rs[i][col - 1]) === v) return { row: i + 2, r: rs[i] };
  return null;
}
function info_(r) {
  return { ref: r[C.ref - 1], house: String(r[C.house - 1]), name: r[C.name - 1],
    people: Number(r[C.people - 1]) || 1, status: r[C.status - 1], inAt: fmt_(r[C.inAt - 1]),
    zone: r[C.zone - 1] || zoneOf_(r[C.house - 1]) };
}
function stats_(reg) {
  const rs = rows_(reg);
  const s = { houses: rs.length, people: 0, inHouses: 0, inPeople: 0 };
  rs.forEach(r => { const n = Number(r[C.people - 1]) || 0; s.people += n;
    if (r[C.status - 1] === ST_IN) { s.inHouses++; s.inPeople += n; } });
  return s;
}

/* ---------- GET ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const { reg } = setup_();
  const ss = ss_();

  if (p.debug) return json_({ spreadsheet: ss.getName(), url: ss.getUrl(), rows: reg.getLastRow() - 1 });

  // ตรวจบ้านซ้ำก่อนเซ็น
  if (p.action === 'check') {
    const hit = find_(reg, C.house, p.house);
    return json_({ exists: !!hit, when: hit ? fmt_(hit.r[C.when - 1]) : '' });
  }
  // ขอตั๋วคืน (บ้านเลขที่ + เบอร์โทรต้องตรงกัน)
  if (p.action === 'ticket') {
    const hit = find_(reg, C.house, p.house);
    if (!hit || digits_(hit.r[C.phone - 1]).slice(-9) !== digits_(p.phone).slice(-9)) return json_({ ok: false });
    return json_(Object.assign({ ok: true, token: hit.r[C.token - 1] }, info_(hit.r)));
  }
  // ดูข้อมูลจากรหัส QR (ไม่เปลี่ยนสถานะ)
  if (p.action === 'lookup') {
    const hit = find_(reg, C.token, p.t);
    return json_(hit ? Object.assign({ ok: true }, info_(hit.r)) : { ok: false, notFound: true });
  }
  // เจ้าหน้าที่ค้นด้วยบ้านเลขที่ (กรณีลูกบ้านไม่มีตั๋ว)
  if (p.action === 'findHouse') {
    if (String(p.pin) !== STAFF_PIN) return json_({ ok: false, badPin: true });
    const hit = find_(reg, C.house, p.house);
    return json_(hit ? Object.assign({ ok: true, token: hit.r[C.token - 1] }, info_(hit.r)) : { ok: false, notFound: true });
  }
  if (p.action === 'stats') return json_(stats_(reg));
  return json_({ ok: true });
}

/* ---------- POST ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    const sheets = setup_();
    if (d.action === 'checkin') return json_(checkin_(sheets, d));
    return json_(register_(sheets, d));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function register_({ reg }, d) {
  const house = norm_(d.house);
  const name = String(d.name || '').trim().replace(/\s+/g, ' ');
  const phone = digits_(d.phone);
  const people = Math.min(10, Math.max(1, parseInt(d.people, 10) || 1));
  const sig = String(d.signature || '');
  if (!/^\d{1,4}(\/\d{1,4})?$/.test(house) || name.length < 3 || !/^0\d{9}$/.test(phone)
      || sig.indexOf('data:image/png;base64,') !== 0) return { ok: false, error: 'ข้อมูลไม่ครบถ้วน' };

  if (find_(reg, C.house, house)) return { ok: false, duplicate: true };

  const now = new Date();
  const seq = reg.getLastRow();
  const ref = REF_PREFIX + String(seq).padStart(3, '0');
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 16);

  let fileUrl = '';
  if (FOLDER_ID) {
    const blob = Utilities.newBlob(Utilities.base64Decode(sig.split(',')[1]), 'image/png',
      `${ref}_${house.replace('/', '-')}_${name}.png`);
    fileUrl = DriveApp.getFolderById(FOLDER_ID).createFile(blob).getUrl();
  }

  const zone = zoneOf_(house);
  reg.appendRow([seq, now, ref, house, name, phone, people, '', ST_WAIT, '', zone, token, fileUrl,
    String(d.ua || '').slice(0, 150)]);
  const row = reg.getLastRow();
  reg.getRange(row, C.when).setNumberFormat('d/m/yyyy hh:mm');
  try {
    reg.getRange(row, C.sig).setValue(SpreadsheetApp.newCellImage().setSourceUrl(sig).setAltTextTitle(name).build());
    reg.setRowHeight(row, 70);
  } catch (err) {
    reg.getRange(row, C.sig).setValue(fileUrl ? 'ดูไฟล์ Drive' : 'บันทึกรูปไม่สำเร็จ');
  }
  return { ok: true, ref, token, zone, when: fmt_(now) };
}

function checkin_({ reg, log }, d) {
  if (String(d.pin) !== STAFF_PIN) return { ok: false, badPin: true };
  const hit = find_(reg, C.token, d.t);
  if (!hit) return { ok: false, notFound: true };

  const now = new Date(), inf = info_(hit.r), ua = String(d.ua || '').slice(0, 150);
  if (inf.status === ST_IN) {
    log.appendRow([now, inf.ref, inf.house, inf.name, inf.people, 'สแกนซ้ำ', ua]);
    log.getRange(log.getLastRow(), 1).setNumberFormat('d/m/yyyy hh:mm:ss');
    return Object.assign({ ok: true, already: true }, inf, { stats: stats_(reg) });
  }
  reg.getRange(hit.row, C.status, 1, 2).setValues([[ST_IN, now]]);
  reg.getRange(hit.row, C.inAt).setNumberFormat('d/m/yyyy hh:mm');
  log.appendRow([now, inf.ref, inf.house, inf.name, inf.people, 'เข้างานสำเร็จ', ua]);
  log.getRange(log.getLastRow(), 1).setNumberFormat('d/m/yyyy hh:mm:ss');
  return Object.assign({ ok: true, already: false }, inf, { status: ST_IN, inAt: fmt_(now), stats: stats_(reg) });
}

/** รันครั้งเดียวด้วยมือ: สร้างแท็บทั้งหมด + ขอสิทธิ์ Sheets/Drive */
function authorize() {
  const t = setup_();
  backfillZones_(t.reg); buildSummary_(t.sum);
  Logger.log('พร้อมใช้งาน: ' + ss_().getSheets().map(s => s.getName()).join(', '));
  if (FOLDER_ID) DriveApp.getFolderById(FOLDER_ID).getName();
  else DriveApp.getRootFolder().getName();
}
