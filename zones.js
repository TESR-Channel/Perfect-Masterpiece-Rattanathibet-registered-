/* ===== โซนของหมู่บ้าน: แปลงบ้านเลขที่ → โซน (รายการบ้านทั้งหมดดูที่ houses.csv) ===== */
const ZONES = [
  { name: '11 ไร่',             from: 121, to: 155 },
  { name: '22 ไร่ (ป้อม6)',      from: 400, to: 437 },
  { name: '44 ไร่ (ป้อม8/1)',    from: 1,   to: 120 },
  { name: '74 ไร่ (เซ็นจูรี่)',   from: 156, to: 307 },
];
function zoneOf(house) {
  const m = /^112\/(\d{1,4})$/.exec(String(house || '').replace(/\s+/g, ''));
  if (!m) return 'ไม่ทราบโซน';
  const n = Number(m[1]), z = ZONES.find(z => n >= z.from && n <= z.to);
  return z ? z.name : 'ไม่ทราบโซน';
}
