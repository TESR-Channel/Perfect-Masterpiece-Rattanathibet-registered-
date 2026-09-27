# ลงทะเบียน + ตั๋ว QR + เช็กอินหน้างาน — ประชุมใหญ่ลูกบ้าน ครั้งที่ 2/2569 (ป้อม 8 และป้อม 6)

- หน้าลงทะเบียน: https://tesr-channel.github.io/Perfect-Masterpiece-Rattanathibet-registered-/
- หน้าเช็กอิน (เจ้าหน้าที่): https://tesr-channel.github.io/Perfect-Masterpiece-Rattanathibet-registered-/checkin.html

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | ลูกบ้านกรอกข้อมูล → เซ็นชื่อ → ได้รูป "ตั๋วเข้างาน" มี QR Code |
| `checkin.html` | เจ้าหน้าที่สแกน QR (กล้องในหน้าเว็บ หรือแอปกล้องมือถือ) → บันทึกเข้างาน / ค้นด้วยบ้านเลขที่ |
| `config.js` | ใส่ `API_URL` ที่เดียว ใช้ทั้งสองหน้า |
| `Code.gs` | Google Apps Script (Sheets backend) |
| (CDN) | ไลบรารีสร้าง/อ่าน QR (qrcode-generator, jsQR) โหลดจาก jsDelivr |
| `poster.jpg`, `.nojekyll` | ภาพประกอบ/พรีวิว LINE, กัน Pages build พัง |

## แท็บใน Google Sheets (สร้างอัตโนมัติ)
- **ลงทะเบียน** — ข้อมูลลงทะเบียนล่วงหน้า + รูปลายเซ็น + สถานะเข้างาน + คอลัมน์ "โซน" (เว้นไว้สำหรับแบ่งโซนภายหลัง)
- **เข้างาน** — บันทึกการสแกนทุกครั้ง (รวมสแกนซ้ำ)
- **สรุป** — ยอดบ้าน/คน ที่ลงทะเบียน มาแล้ว และยังไม่มา

## ติดตั้ง
1. สร้าง Google Sheets ใหม่ → **ส่วนขยาย → Apps Script** (ต้องสร้างจากในไฟล์ Sheets)
2. วาง `Code.gs` → แก้ `STAFF_PIN` เป็นรหัสเจ้าหน้าที่ของจริง
3. เลือกฟังก์ชัน `authorize` → Run → อนุญาตสิทธิ์ (จะสร้าง 3 แท็บให้)
4. Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone** → คัดลอก URL `/exec`
5. ใส่ URL ใน `config.js` (แก้ในหน้า GitHub ได้เลย) → Commit
6. ทดสอบ `URL/exec?debug=1` ต้องเห็นชื่อไฟล์ Sheets ที่ถูกต้อง
7. แก้ `Code.gs` ครั้งใด ต้อง Deploy → Manage deployments → Edit → **New version**

## วันงาน (เจ้าหน้าที่)
เปิด `checkin.html` → กรอกรหัสเจ้าหน้าที่ครั้งแรกครั้งเดียว → กด "สแกน QR Code"
หรือใช้แอปกล้องมือถือสแกนตั๋วก็ได้ ระบบบันทึกเข้างานทันที สแกนซ้ำจะขึ้นสีส้ม "เข้างานไปแล้ว"
ถ้าลูกบ้านสแกนตั๋วเอง จะขอรหัสเจ้าหน้าที่ จึงเช็กอินเองไม่ได้
