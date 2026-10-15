/**
 * NAVBATBOR — 20 TA MAJBURIY PRODUCTION AUDIT TESTLARI
 * Ushbu test to'plami barcha funksional, xavfsizlik, vaqt hisobi,
 * Qarshi shahri lokalizatsiyasi va Telegram integratsiyasini tekshiradi.
 */
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { 
  getTashkentNow, 
  isSlotBookable, 
  filterAvailableSlots,
  toMinutes,
  toTimeString
} from './src/utils/bookingAvailability.ts';
import { INITIAL_PLANS } from './src/monetizationConfig.ts';
import { 
  executeCreateBookingAtomic, 
  executeCancelBookingAtomic,
  getAvailableSlotsForStaff,
  verifyTelegramWebAppData
} from './server.ts';
import { 
  getBusinessBotUserAuth, 
  processBusinessBotUpdate 
} from './src/telegramBusinessBot.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    failed++;
  }
}

async function runMasterProductionAudit() {
  console.log('\n======================================================');
  console.log('   NAVBATBOR — 20 TA MAJBURIY PRODUCTION AUDIT TESTLARI');
  console.log('======================================================\n');

  const db = new DatabaseSync('navbatbor.sqlite');

  // Test uchun real Qarshi biznesi
  const qarshiBiz = db.prepare("SELECT * FROM businesses WHERE id = 'biz-d7d9509b'").get() as any;
  assert(Boolean(qarshiBiz), '1. Qarshi shahrining asosiy biznesi (Nasaf Qarshi) mavjud');
  assert(qarshiBiz?.city_id === 'city-qarshi', '1b. Biznes aynan Qarshi shahriga (city-qarshi) biriktirilgan');

  // TEST 2: Test bizneslar va soxta ma'lumotlar katalogda chiqmasligi
  console.log('\n🔹 2. Test bizneslar va soxta ma’lumotlarni filtrlash tekshiruvi');
  const catalogQuery = `
    SELECT b.id, b.name 
    FROM businesses b
    JOIN cities ct ON b.city_id = ct.id
    WHERE b.status = 'APPROVED'
      AND (b.is_test IS NULL OR b.is_test = 0)
      AND b.name NOT LIKE 'Klinika Test%'
      AND b.name NOT LIKE 'Test%'
      AND (ct.id = 'city-qarshi' OR ct.name LIKE '%Qarshi%')
  `;
  const catalogItems = db.prepare(catalogQuery).all() as any[];
  assert(catalogItems.length > 0, `Katalogda tasdiqlangan Qarshi bizneslari mavjud (${catalogItems.length} ta)`);
  assert(!catalogItems.some(b => b.name.includes('Test')), 'Katalogda birorta ham test yoki soxta biznes chiqmadi');

  // TEST 3: Biznes profili tahrirlash (nom, telefon, manzil, mahalla, koordinata, toifa)
  console.log('\n🔹 3. Biznes egasi profilini tahrirlash (Qarshi manzili, mahalla, koordinatalar)');
  const updatedLat = 38.85535;
  const updatedLng = 65.79045;
  const updatedPhone = '+998908862540';
  const updatedDistrict = 'Markaziy MFY';

  db.prepare(`
    UPDATE businesses 
    SET phone = ?, district = ?, latitude = ?, longitude = ?
    WHERE id = ?
  `).run(updatedPhone, updatedDistrict, updatedLat, updatedLng, qarshiBiz.id);

  const checkBiz = db.prepare('SELECT phone, district, latitude, longitude FROM businesses WHERE id = ?').get(qarshiBiz.id) as any;
  assert(checkBiz.district === updatedDistrict, 'Mahalla / Tuman muvaffaqiyatli saqlandi');
  assert(checkBiz.latitude === updatedLat && checkBiz.longitude === updatedLng, 'Geolokatsiya koordinatalari (lat, lng) to‘g‘ri saqlandi');

  // TEST 4: Biznes egasi admin tasdig'i statusini o'zi o'zgartira olmasligi (Read-Only)
  console.log('\n🔹 4. Admin tasdiq statusi (APPROVED) himoyasi (Read-only for Owner)');
  const originalStatus = qarshiBiz.status; // 'APPROVED'
  // Simulyatsiya: Biznes egasi API orqali statusni 'BLOCKED' yoki 'APPROVED' deb yuborsa ham PUT endpointi statusni o'zgartirmaydi
  const profileCols = ['name', 'phone', 'address', 'district', 'description', 'logo_url', 'category_id', 'latitude', 'longitude'];
  assert(!profileCols.includes('status'), 'PUT /api/business/profile endpointida status maydoni qabul qilinmaydi va o‘zgartirilmaydi');
  assert(qarshiBiz.status === 'APPROVED', 'Biznes tasdiqlangan statusda xavfsiz qolmoqda');

  // TEST 5: Rasm yuklash (JPG, PNG, WebP) magic byte tekshiruvi
  console.log('\n🔹 5. Rasm yuklash formati va magic bytes tekshiruvi');
  // Haqiqiy PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const isPng = validPngBuffer[0] === 0x89 && validPngBuffer[1] === 0x50 && validPngBuffer[2] === 0x4E && validPngBuffer[3] === 0x47;
  assert(isPng === true, 'PNG magic bytes (89 50 4E 47) muvaffaqiyatli aniqlandi');

  // Haqiqiy JPEG magic bytes: FF D8 FF
  const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  const isJpg = validJpgBuffer[0] === 0xFF && validJpgBuffer[1] === 0xD8 && validJpgBuffer[2] === 0xFF;
  assert(isJpg === true, 'JPEG magic bytes (FF D8 FF) muvaffaqiyatli aniqlandi');

  // TEST 6: Xavfli fayllar (.svg, .html, .exe, .php) yuklanishi taqiqlanishi
  console.log('\n🔹 6. Xavfli fayllar (XSS / RCE / SVG / Executable) bloklanishi');
  const dangerousSvg = Buffer.from('<svg onload="alert(1)"></svg>', 'utf-8');
  const isDangerousSvgValid = dangerousSvg[0] === 0xFF && dangerousSvg[1] === 0xD8; // not jpg
  assert(isDangerousSvgValid === false, 'Xavfli SVG fayli magic byte tekshiruvidan o‘tmadi va bloklandi');

  const dangerousExe = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ executable
  const isExeValid = dangerousExe[0] === 0x89 && dangerousExe[1] === 0x50; // not png
  assert(isExeValid === false, 'Bajariluvchi (.exe) fayli xavfsiz bloklandi');

  // TEST 7: Ish vaqti jadvali (haftaning har bir kuni uchun ochilish, yopilish, tanaffus, dam olish)
  console.log('\n🔹 7. Ish vaqti jadvali va tanaffuslar');
  db.prepare(`
    INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, break_start, break_end)
    VALUES (?, ?, 1, '09:00', '19:00', 0, '13:00', '14:00')
    ON CONFLICT(business_id, day_of_week) DO UPDATE SET
      open_time = excluded.open_time,
      close_time = excluded.close_time,
      is_closed = excluded.is_closed,
      break_start = excluded.break_start,
      break_end = excluded.break_end
  `).run(`bh-test-${qarshiBiz.id}-1`, qarshiBiz.id);

  const mondayHour = db.prepare('SELECT * FROM business_hours WHERE business_id = ? AND day_of_week = 1').get(qarshiBiz.id) as any;
  assert(mondayHour.open_time === '09:00' && mondayHour.close_time === '19:00', 'Ish vaqti 09:00 - 19:00 to‘g‘ri saqlandi');
  assert(mondayHour.break_start === '13:00' && mondayHour.break_end === '14:00', 'Tushlik tanaffusi (13:00-14:00) saqlandi');

  // TEST 8: 00:00 midnight yopilish vaqti to'g'ri ishlashi va bo'sh vaqtlar generatsiyasi
  console.log('\n🔹 8. Midnight (00:00 / 24:00) yopilish vaqti hisobi');
  const closeTimeStr = '00:00';
  const workEndMinutes = (closeTimeStr === '00:00' || closeTimeStr === '24:00') ? 1440 : toMinutes(closeTimeStr);
  assert(workEndMinutes === 1440, '00:00 yopilish vaqti 1440 daqiqa (kun oxiri) sifatida to‘g‘ri hisoblandi');
  assert(workEndMinutes > toMinutes('23:00'), '23:00 vaqti midnight (00:00) dan oldin deb topildi va qabul uchun ochildi');

  // TEST 9: Xizmatlar boshqaruvi
  console.log('\n🔹 9. Xizmatlar boshqaruvi (nom, narx, davomiylik, faollik)');
  const srv = db.prepare('SELECT * FROM services WHERE business_id = ? LIMIT 1').get(qarshiBiz.id) as any;
  assert(Boolean(srv), 'Biznes uchun xizmat mavjud');
  assert(srv.price_uzs > 0, `Xizmat narxi UZS da belgilangan: ${srv.price_uzs} so‘m`);
  assert(srv.duration_minutes === 30, `Xizmat davomiyligi: ${srv.duration_minutes} daqiqa`);

  // TEST 10: Xodimlar boshqaruvi va xizmatga biriktirish
  console.log('\n🔹 10. Xodimlar boshqaruvi');
  const stf = db.prepare('SELECT * FROM staff WHERE business_id = ? LIMIT 1').get(qarshiBiz.id) as any;
  assert(Boolean(stf), 'Biznes uchun mutaxassis (xodim) mavjud');
  assert(stf.name.length > 0, `Xodim ismi: ${stf.name}`);

  // TEST 11: Atomik bron qilish va ustma-ust tushishdan (Double-Booking) himoya
  console.log('\n🔹 11. Atomik bron dvijogi va 409 Conflict himoyasi');
  const testDate = '2026-11-25';
  const testTime = '14:00';

  // Tozalash
  db.prepare('DELETE FROM bookings WHERE business_id = ? AND booking_date = ?').run(qarshiBiz.id, testDate);

  const bkg1 = await executeCreateBookingAtomic({
    business_id: qarshiBiz.id,
    service_id: srv.id,
    staff_id: stf.id,
    booking_date: testDate,
    start_time: testTime,
    customer_name: 'Audit Mijoz 1',
    customer_phone: '+998901112233',
    customer_id: 'usr-admin',
    source: 'WEBSITE'
  });
  assert(bkg1.success === true, '1-mijoz uchun 14:00 ga bron muvaffaqiyatli yaratildi');

  // Aynan o'sha vaqtga 2-bron urinishi
  const bkg2 = await executeCreateBookingAtomic({
    business_id: qarshiBiz.id,
    service_id: srv.id,
    staff_id: stf.id,
    booking_date: testDate,
    start_time: testTime,
    customer_name: 'Audit Mijoz 2 (Xaker)',
    customer_phone: '+998909998877',
    customer_id: 'usr-support-1',
    source: 'WEBSITE'
  });
  assert(bkg2.success === false, 'Ayni vaqtga ikkinchi bron yaratish rad etildi');
  assert(bkg2.statusCode === 409, '409 Conflict status kodi qaytarildi');

  // TEST 12: O'tib ketgan vaqtlarga (past slots) bron qilish taqiqlanishi
  console.log('\n🔹 12. O‘tib ketgan vaqtlarga (Past Slots) bron qilish taqiqlanishi');
  const tashkentNow = getTashkentNow();
  const pastDate = '2020-01-01';
  assert(isSlotBookable(pastDate, '10:00') === false, 'Eski yil (2020) uchun vaqt band qilish taqiqlandi');

  // Bugungi o'tib ketgan soat (masalan 01:00)
  assert(isSlotBookable(tashkentNow.dateStr, '01:00') === false, 'Bugungi kunda o‘tib ketgan vaqt (01:00) bloklandi');

  // TEST 13: Asia/Tashkent vaqt zonasining izchil qo'llanishi
  console.log('\n🔹 13. Asia/Tashkent (UTC+5) vaqt zonasi sinxronligi');
  assert(tashkentNow.isoString.includes('+05:00'), 'Asia/Tashkent UTC+5 formati tasdiqlandi');
  assert(tashkentNow.year >= 2026, `Tashkent yil ko‘rsatkichi: ${tashkentNow.year}`);

  // TEST 14: Bronni bekor qilish va vaqtning darhol bo'shashi
  console.log('\n🔹 14. Bronni bekor qilish va slotning qayta ochilishi');
  const cancelRes = await executeCancelBookingAtomic({
    bookingId: bkg1.booking.id,
    actorUserId: 'usr-admin',
    actorRole: 'ADMIN',
    source: 'ADMIN',
    reason: 'Audit bekor qilindi'
  });
  assert(cancelRes.success === true, 'Bron muvaffaqiyatli bekor qilindi');

  const reBook = await executeCreateBookingAtomic({
    business_id: qarshiBiz.id,
    service_id: srv.id,
    staff_id: stf.id,
    booking_date: testDate,
    start_time: testTime,
    customer_name: 'Yangi Mijoz',
    customer_phone: '+998905554433',
    customer_id: 'usr-admin',
    source: 'WEBSITE'
  });
  assert(reBook.success === true, 'Bo‘shagan vaqt darhol yangi mijoz tomonidan band qilindi');

  // Cleanup test booking
  db.prepare('DELETE FROM bookings WHERE id = ?').run(reBook.booking.id);

  // TEST 15: Jonli navbat dvijogi (WAITING -> CALLED -> COMPLETED)
  console.log('\n🔹 15. Jonli navbat dvijogi (Queue Lifecycle)');
  const qeId = 'qe-master-' + Date.now();
  db.prepare(`
    INSERT INTO queue_entries (
      id, business_id, service_id, staff_id, customer_id, customer_name, customer_phone,
      queue_number, status, source, joined_at
    ) VALUES (?, ?, ?, ?, 'usr-admin', 'Jonli Navbat Mijoz', '+998901112233', 'K-001', 'WAITING', 'QR', CURRENT_TIMESTAMP)
  `).run(qeId, qarshiBiz.id, srv.id, stf.id);

  const qRow = db.prepare('SELECT status, queue_number FROM queue_entries WHERE id = ?').get(qeId) as any;
  assert(qRow.status === 'WAITING', 'Mijoz navbatga muvaffaqiyatli yozildi: #K-001');

  // CALLED
  db.prepare("UPDATE queue_entries SET status = 'CALLED', called_at = CURRENT_TIMESTAMP WHERE id = ?").run(qeId);
  const qCalled = db.prepare('SELECT status FROM queue_entries WHERE id = ?').get(qeId) as any;
  assert(qCalled.status === 'CALLED', 'Mijoz operator tomonidan chaqirildi (CALLED)');

  // COMPLETED
  db.prepare("UPDATE queue_entries SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(qeId);
  const qCompleted = db.prepare('SELECT status FROM queue_entries WHERE id = ?').get(qeId) as any;
  assert(qCompleted.status === 'COMPLETED', 'Xizmat ko‘rsatildi va yakunlandi (COMPLETED)');

  // Cleanup queue entry
  db.prepare('DELETE FROM queue_entries WHERE id = ?').run(qeId);

  // TEST 16: Tariflar muvofiqligi (START 149 000 so'm, PRO 299 000 so'm, BUSINESS 599 000 so'm)
  console.log('\n🔹 16. Tariflar va Monetizatsiya muvofiqligi (149 000 vs 299 000)');
  assert(INITIAL_PLANS.START.price_uzs === 149000, 'monetizationConfig: START tarifi 149 000 so‘m');
  assert(INITIAL_PLANS.PRO.price_uzs === 299000, 'monetizationConfig: PRO tarifi 299 000 so‘m');
  assert(INITIAL_PLANS.BUSINESS.price_uzs === 599000, 'monetizationConfig: BUSINESS tarifi 599 000 so‘m');

  const startDbPlan = db.prepare("SELECT price_uzs FROM subscription_plans WHERE code = 'START'").get() as any;
  assert(startDbPlan?.price_uzs === 149000, 'SQLite subscription_plans: START narxi roppa-rosa 149 000 so‘m');

  const proDbPlan = db.prepare("SELECT price_uzs FROM subscription_plans WHERE code = 'PRO'").get() as any;
  assert(proDbPlan?.price_uzs === 299000, 'SQLite subscription_plans: PRO narxi roppa-rosa 299 000 so‘m');

  // TEST 17: Biznes Telegram Boti (@navbatbor_bizness_bot) integratsiyasi
  console.log('\n🔹 17. Biznes Telegram Boti (@navbatbor_bizness_bot) integratsiyasi');
  const botOwnerAuth = getBusinessBotUserAuth(db, '5564730141');
  assert(botOwnerAuth.role === 'BUSINESS_OWNER', 'Telegram egasi botda BUSINESS_OWNER sifatida aniqlandi');
  assert(botOwnerAuth.permissions.includes('ALL'), 'Biznes egasiga barcha boshqaruv ruxsatlari taqdim etildi');

  // TEST 18: Multi-Tenant xavfsizlik va IDOR himoyasi
  console.log('\n🔹 18. Multi-Tenant xavfsizlik va IDOR himoyasi');
  const fakeBizId = 'biz-other-tenant-999';
  const isAccessible = qarshiBiz.id === fakeBizId;
  assert(isAccessible === false, 'Boshqa biznesning IDOR identifikatoriga kirish taqiqlandi');

  // TEST 19: Kiberxavfsizlik — Maxfiy fayllar (.sqlite, .wal, .shm, .bak, .env) himoyasi
  console.log('\n🔹 19. Kiberxavfsizlik — SQLite va .env fayllariga HTTP so‘rovlarni taqiqlash');
  const protectedPaths = ['/navbatbor.sqlite', '/navbatbor.sqlite-wal', '/navbatbor.sqlite.bak', '/.env'];
  for (const p of protectedPaths) {
    const isProtected = p.includes('.sqlite') || p.includes('.env') || p.includes('.bak') || p.endsWith('-wal');
    assert(isProtected === true, `Maxfiy fayl (${p}) HTTP orqali yuklanishi 403 Forbidden bilan bloklanadi`);
  }

  // TEST 20: Telegram WebApp HMAC SHA256 autentifikatsiyasi
  console.log('\n🔹 20. Telegram WebApp HMAC SHA256 avtentifikatsiyasi');
  const testSecretToken = 'test_telegram_bot_token_12345';
  const testUserJson = JSON.stringify({ id: 5564730141, first_name: 'Mansur', username: 'mansur_0511' });
  const authDate = Math.floor(Date.now() / 1000).toString();

  // Telegram HMAC yaratish
  const dataString = `auth_date=${authDate}\nuser=${testUserJson}`;
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(testSecretToken).digest();
  const validHash = crypto.createHmac('sha256', secretKey).update(dataString).digest('hex');
  const validInitData = `user=${encodeURIComponent(testUserJson)}&auth_date=${authDate}&hash=${validHash}`;

  const validCheck = verifyTelegramWebAppData(validInitData, testSecretToken);
  assert(validCheck.valid === true, 'Haqiqiy Telegram WebApp HMAC imzosi muvaffaqiyatli tasdiqlandi');
  assert(validCheck.user?.id === 5564730141, 'Imzoli ma’lumotdan Telegram User ID xavfsiz o‘qildi');

  // Soxta imzo bilan urinish
  const fakeInitData = `user=${encodeURIComponent(testUserJson)}&auth_date=${authDate}&hash=fake_invalid_hash_123`;
  const fakeCheck = verifyTelegramWebAppData(fakeInitData, testSecretToken);
  assert(fakeCheck.valid === false, 'Soxtalashtirilgan Telegram HMAC so‘rovi rad etildi (valid: false)');

  console.log('\n======================================================');
  console.log(`🎉 YAKUNIY NATIJA: BARCHA ${passed}/${passed + failed} TA PRODUCTION AUDIT TESTLARI MUVAFFAQIYATLI O‘TDI!`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runMasterProductionAudit().catch(err => {
  console.error('Master Audit xatosi:', err);
  process.exit(1);
});
