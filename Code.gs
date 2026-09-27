/**
 * ระบบลงทะเบียนประชุมใหญ่ลูกบ้าน ครั้งที่ 2/2569 — ป้อม 8 และป้อม 6
 * วิธีติดตั้ง: เปิด Google Sheets ไฟล์ปลายทาง → ส่วนขยาย → Apps Script → วางโค้ดนี้
 * (ต้องสร้างจากในไฟล์ Sheets เท่านั้น ไม่งั้นข้อมูลจะไปลงผิดไฟล์)
 */

const SHEET_NAME = 'ลงทะเบียนประชุม 2-2569';
// โฟลเดอร์ Google Drive สำหรับเก็บไฟล์ลายเซ็น (เว้นว่าง = ไม่เก็บไฟล์ใน Drive, เก็บเป็นรูปในชีตอย่างเดียว)
const FOLDER_ID = '';
const REF_PREFIX = 'M2-';

const HEADERS = ['ลำดับ', 'วันเวลาที่ลงทะเบียน', 'รหัสลงทะเบียน', 'โซน', 'บ้านเลขที่',
  'ชื่อ และนามสกุล', 'เบอร์โทรศัพท์', 'จำนวนผู้เข้าร่วม', 'ลายเซ็น', 'ไฟล์ลายเซ็น (Drive)', 'อุปกรณ์'];
const COL = { zone: 4, house: 5, when: 2, sig: 9 };

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#0E2A5E').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.getRange('G:G').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('@');
    [60, 150, 90, 100, 90, 220, 120, 110, 200, 180, 200].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  }
  return sh;
}

const norm_ = s => String(s || '').replace(/\s+/g, '').trim();
const json_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const tz_ = () => Session.getScriptTimeZone() || 'Asia/Bangkok';

function findHouse_(sh, zone, house) {
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, COL.house).getValues();
  const z = norm_(zone), h = norm_(house);
  for (const r of vals) {
    if (norm_(r[COL.zone - 1]) === z && norm_(r[COL.house - 1]) === h) {
      const w = r[COL.when - 1];
      return { when: w instanceof Date ? Utilities.formatDate(w, tz_(), 'd/M/yyyy HH:mm') : String(w) };
    }
  }
  return null;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (p.debug) {
    const sh = getSheet_();
    return json_({ spreadsheet: ss.getName(), id: ss.getId(), url: ss.getUrl(), sheet: SHEET_NAME, rows: sh.getLastRow() - 1 });
  }
  if (p.action === 'check') {
    const hit = findHouse_(getSheet_(), p.zone, p.house);
    return json_({ exists: !!hit, when: hit ? hit.when : '' });
  }
  if (p.action === 'stats') {
    const sh = getSheet_(), last = sh.getLastRow();
    const people = last < 2 ? 0 : sh.getRange(2, 8, last - 1, 1).getValues().reduce((a, r) => a + (Number(r[0]) || 0), 0);
    return json_({ houses: Math.max(0, last - 1), people });
  }
  return json_({ ok: true });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    const zone = String(d.zone || '').trim();
    const house = norm_(d.house);
    const name = String(d.name || '').trim().replace(/\s+/g, ' ');
    const phone = String(d.phone || '').replace(/\D/g, '');
    const people = Math.min(10, Math.max(1, parseInt(d.people, 10) || 1));
    const sig = String(d.signature || '');

    if (!zone || !/^\d{1,4}(\/\d{1,4})?$/.test(house) || name.length < 3 || !/^0\d{9}$/.test(phone)
        || sig.indexOf('data:image/png;base64,') !== 0) {
      return json_({ ok: false, error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const sh = getSheet_();
    if (findHouse_(sh, zone, house)) return json_({ ok: false, duplicate: true });

    const now = new Date();
    const seq = sh.getLastRow(); // แถวถัดไป - 1 = ลำดับ
    const ref = REF_PREFIX + String(seq).padStart(3, '0');

    let fileUrl = '';
    if (FOLDER_ID) {
      const blob = Utilities.newBlob(Utilities.base64Decode(sig.split(',')[1]), 'image/png',
        `${ref}_${house.replace('/', '-')}_${name}.png`);
      fileUrl = DriveApp.getFolderById(FOLDER_ID).createFile(blob).getUrl();
    }

    sh.appendRow([seq, now, ref, zone, house, name, "'" + phone, people, '', fileUrl,
      String(d.ua || '').slice(0, 150)]);
    const row = sh.getLastRow();
    sh.getRange(row, COL.when).setNumberFormat('d/m/yyyy hh:mm');

    // ใส่รูปลายเซ็นลงในเซลล์
    try {
      const img = SpreadsheetApp.newCellImage().setSourceUrl(sig).setAltTextTitle(name).build();
      sh.getRange(row, COL.sig).setValue(img);
      sh.setRowHeight(row, 70);
    } catch (err) {
      sh.getRange(row, COL.sig).setValue(fileUrl ? 'ดูไฟล์ Drive' : 'บันทึกรูปไม่สำเร็จ');
    }

    return json_({ ok: true, ref, when: Utilities.formatDate(now, tz_(), 'd/M/yyyy HH:mm') });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** รันครั้งเดียวด้วยมือ เพื่ออนุญาตสิทธิ์ Sheets + Drive */
function authorize() {
  getSheet_();
  if (FOLDER_ID) DriveApp.getFolderById(FOLDER_ID).getName();
  else DriveApp.getRootFolder().getName();
}
