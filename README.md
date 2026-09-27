# ลงทะเบียนประชุมใหญ่ลูกบ้าน ครั้งที่ 2/2569 — ป้อม 8 และป้อม 6

หน้าเว็บ: https://tesr-channel.github.io/Perfect-Masterpiece-Rattanathibet-registered-/

## ไฟล์
- `index.html` — หน้าลงทะเบียน (กรอกข้อมูล → เซ็นชื่อ → เสร็จสิ้น + รูปหลักฐาน PNG)
- `poster.jpg` — ภาพประกอบ / ภาพพรีวิวเวลาแชร์ใน LINE
- `Code.gs` — Google Apps Script (บันทึกลง Google Sheets + รูปลายเซ็นในเซลล์)
- `.nojekyll` — กัน GitHub Pages build พัง

## ติดตั้ง Backend
1. สร้าง Google Sheets ใหม่ → **ส่วนขยาย → Apps Script** (ต้องสร้างจากในไฟล์ Sheets)
2. วางโค้ด `Code.gs` (ถ้าต้องการเก็บไฟล์ลายเซ็นใน Drive ใส่ `FOLDER_ID`)
3. เลือกฟังก์ชัน `authorize` → Run → อนุญาตสิทธิ์
4. Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → คัดลอก URL `/exec`
5. นำ URL ไปใส่ `const API_URL = '...'` ใน `index.html`
6. ทดสอบ: เปิด `URL/exec?debug=1` ต้องเห็นชื่อไฟล์ Sheets ที่ถูกต้อง
7. แก้โค้ดครั้งใด ต้อง Deploy → Manage deployments → Edit → **New version** ทุกครั้ง

ดูยอดรวม: `URL/exec?action=stats` → จำนวนบ้าน / จำนวนคน (ใช้เตรียมเก้าอี้)

## เปิด GitHub Pages
Settings → Pages → Source: Deploy from branch → `main` / root
