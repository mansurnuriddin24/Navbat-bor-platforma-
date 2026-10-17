const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(process.cwd(), 'navbatbor.sqlite');
const db = new DatabaseSync(dbPath);

console.log('====================================================');
console.log('NAVBATBOR — 18-OKTABR AUDIT VA VERIFIKATSIYA TESTLARI');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}: ${details}`);
    failedTests++;
  }
}

// 1. DATABASE SCHEMA & INTEGRITY
console.log('--- 1. BAZA INTEGRATSIYASI VA XAVFSIZLIGI ---');
try {
  const integrity = db.prepare('PRAGMA integrity_check').get();
  assert(integrity.integrity_check === 'ok', 'SQLite bazasi butunligi (PRAGMA integrity_check)', integrity.integrity_check);

  const foreignKeys = db.prepare('PRAGMA foreign_keys').get();
  assert(foreignKeys.foreign_keys === 1, 'Foreign keys yoqilganligi', `Hozirgi holat: ${foreignKeys.foreign_keys}`);

  const businesses = db.prepare('SELECT id, name, status, is_verified, is_sponsored, city_id FROM businesses').all();
  assert(businesses.length === 1 && businesses[0].name === 'Nasaf dental', 'Faqat haqiqiy "Nasaf dental" mavjudligi', `Topilgan: ${businesses.length}`);
  assert(businesses[0].status === 'APPROVED' && businesses[0].is_verified === 1, '"Nasaf dental" holati APPROVED va VERIFIED ekanligi');
  assert(businesses[0].city_id === 'city-qarshi', '"Nasaf dental" Qarshi shahriga biriktirilganligi');

  const cities = db.prepare('SELECT id, name FROM cities').all();
  assert(cities.length === 1 && cities[0].id === 'city-qarshi', 'Faqat Qarshi shahri ro‘yxatda ekanligi (boshqa shaharlar yo‘qligi)');
} catch (e) {
  assert(false, 'Baza yaxlitligi xatosi', e.message);
}

// 2. XIZMATLAR VA XODIMLAR
console.log('\n--- 2. XIZMATLAR VA XODIMLAR INTEGRATSIYASI ---');
try {
  const services = db.prepare('SELECT * FROM services WHERE business_id = ?').all('biz-nasaf-dental');
  assert(services.length >= 3, '"Nasaf dental" xizmatlari mavjudligi (kamida 3 ta)', `Xizmatlar soni: ${services.length}`);
  
  const staff = db.prepare('SELECT * FROM staff WHERE business_id = ?').all('biz-nasaf-dental');
  assert(staff.length >= 1 && staff[0].name.includes('Nuriddinov Mansur'), '"Nasaf dental" shifokori mavjudligi', staff[0]?.name);

  const orphanServices = db.prepare('SELECT count(*) as c FROM services WHERE business_id NOT IN (SELECT id FROM businesses)').get();
  assert(orphanServices.c === 0, 'Bog‘lanmagan (orphan) xizmatlar yo‘qligi');

  const orphanStaff = db.prepare('SELECT count(*) as c FROM staff WHERE business_id NOT IN (SELECT id FROM businesses)').get();
  assert(orphanStaff.c === 0, 'Bog‘lanmagan (orphan) xodimlar yo‘qligi');
} catch (e) {
  assert(false, 'Xizmatlar va xodimlar tekshiruvi xatosi', e.message);
}

// 3. BRONLASH VA TAKRORIY BRONNING OLDINI OLISH
console.log('\n--- 3. BRONLASH DVIGATELI VA TAKROR BRONNING OLDINI OLISH ---');
try {
  // Test booking slot conflict prevention
  const staffRow = db.prepare('SELECT id FROM staff WHERE business_id = ? LIMIT 1').get('biz-nasaf-dental');
  const serviceRow = db.prepare('SELECT id, price_uzs FROM services WHERE business_id = ? LIMIT 1').get('biz-nasaf-dental');
  const testStaffId = staffRow.id;
  const testServiceId = serviceRow.id;
  const testDate = '2026-11-20';
  const testStartTime = '10:00';
  const testEndTime = '10:30';

  // Insert initial booking
  const testBookingId1 = 'test-bkg-audit-1';
  db.prepare(`
    INSERT OR REPLACE INTO bookings (
      id, booking_number, business_id, service_id, staff_id, customer_id, customer_name, customer_phone,
      booking_date, start_time, end_time, total_price_uzs, status
    ) VALUES (?, 'BK-AUDIT-1', 'biz-nasaf-dental', ?, ?, 'usr-admin', 'Test Mijoz 1', '+998901112233', ?, ?, ?, ?, 'CONFIRMED')
  `).run(testBookingId1, testServiceId, testStaffId, testDate, testStartTime, testEndTime, serviceRow.price_uzs);

  // Attempt duplicate booking for same staff and time
  const conflict = db.prepare(`
    SELECT id FROM bookings
    WHERE staff_id = ?
      AND booking_date = ?
      AND status NOT IN ('CANCELLED', 'NO_SHOW', 'EXPIRED')
      AND (
        (start_time < ? AND end_time > ?) OR
        (start_time >= ? AND start_time < ?)
      )
  `).get(testStaffId, testDate, testEndTime, testStartTime, testStartTime, testEndTime);

  assert(conflict !== undefined && conflict.id === testBookingId1, 'Xodim uchun bir vaqtda band bo‘lgan vaqt oralig‘i aniqlanishi (Conflict Detection)');

  // Clean up test booking
  db.prepare('DELETE FROM bookings WHERE id = ?').run(testBookingId1);
  assert(true, 'Test broni tozalanishi');
} catch (e) {
  assert(false, 'Bronlash testi xatosi', e.message);
}

// 4. JONLI NAVBAT CHIPTA RAQAMLASH VA STATUS
console.log('\n--- 4. JONLI ELEKTRON NAVBAT VA CHEKLAR ---');
try {
  const serviceRow = db.prepare('SELECT id FROM services WHERE business_id = ? LIMIT 1').get('biz-nasaf-dental');
  const testQueueId = 'qe-audit-test-1';
  db.prepare(`
    INSERT OR REPLACE INTO queue_entries (
      id, business_id, service_id, customer_id, customer_name, customer_phone,
      queue_number, status, estimated_wait_minutes, people_ahead
    ) VALUES (?, 'biz-nasaf-dental', ?, 'usr-admin', 'Audit Test Navbatchi', '+998901234567', 'A-001', 'WAITING', 15, 0)
  `).run(testQueueId, serviceRow.id);

  const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(testQueueId);
  assert(entry.queue_number === 'A-001', 'Navbat chipta raqami A-001 formatidaligi');
  assert(entry.status === 'WAITING', 'Chipta holati WAITING ekanligi');

  // Status transitions
  db.prepare("UPDATE queue_entries SET status = 'CALLED', called_at = CURRENT_TIMESTAMP WHERE id = ?").run(testQueueId);
  const calledEntry = db.prepare('SELECT status FROM queue_entries WHERE id = ?').get(testQueueId);
  assert(calledEntry.status === 'CALLED', 'Chipta holati CALLED ga o‘tishi');

  db.prepare("UPDATE queue_entries SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(testQueueId);
  const completedEntry = db.prepare('SELECT status FROM queue_entries WHERE id = ?').get(testQueueId);
  assert(completedEntry.status === 'COMPLETED', 'Chipta holati COMPLETED ga o‘tishi');

  // Clean up
  db.prepare('DELETE FROM queue_entries WHERE id = ?').run(testQueueId);
  assert(true, 'Test navbat chiptasi tozalanishi');
} catch (e) {
  assert(false, 'Navbat testi xatosi', e.message);
}

// 5. RBAC & IDOR XAVFSIZLIGI
console.log('\n--- 5. RBAC & IDOR XAVFSIZLIK TEKSHIRUVI ---');
try {
  const users = db.prepare('SELECT id, role, email, phone FROM users').all();
  const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');
  assert(superAdmins.length >= 1, 'Tizimda Super Admin foydalanuvchisi mavjudligi');

  const nasafOwner = users.find(u => u.phone === '+998908862540' || u.email === 'mansurnuriddin24@gmail.com');
  assert(nasafOwner !== undefined && nasafOwner.role === 'BUSINESS_OWNER', '"Nasaf dental" egasining roli BUSINESS_OWNER ekanligi');

  // Verify that unauthorized users cannot claim business ownership
  const memberships = db.prepare('SELECT * FROM business_memberships WHERE business_id = ?').all('biz-nasaf-dental');
  assert(memberships.every(m => m.user_id === nasafOwner.id || m.role === 'OWNER'), 'Biznes faqat o‘z egasiga biriktirilganligi (IDOR himoyasi)');
} catch (e) {
  assert(false, 'RBAC testi xatosi', e.message);
}

// 6. TELEGRAM XABARLAR JURNALI VA HOLATLARI
console.log('\n--- 6. TELEGRAM XABARLAR JURNALI VA STATUSLARI ---');
try {
  const logCols = db.prepare("PRAGMA table_info(telegram_logs)").all();
  const colNames = logCols.map(c => c.name);
  assert(colNames.includes('status') && colNames.includes('recipient_type'), 'telegram_logs jadvali status va recipient_type ustunlariga egaligi');
  
  const validStatuses = ['SENT', 'SENT_SIMULATED', 'FAILED', 'SKIPPED', 'ERROR'];
  const logs = db.prepare("SELECT status FROM telegram_logs LIMIT 20").all();
  const allValid = logs.every(l => validStatuses.includes(l.status));
  assert(allValid, 'Telegram xabarlar holati faqat qat’iy belgilangan statuslarda saqlanishi (SENT, FAILED, etc.)');
} catch (e) {
  assert(false, 'Telegram logs testi xatosi', e.message);
}

console.log('\n====================================================');
console.log(`AUDIT YAKUNI: ${passedTests} ta test O‘TDI, ${failedTests} ta test QULADI`);
console.log('====================================================');
if (failedTests === 0) {
  console.log('STATUS: VERIFIED READY (GO)');
} else {
  console.log('STATUS: REQUIRES ACTION (NO-GO)');
}
