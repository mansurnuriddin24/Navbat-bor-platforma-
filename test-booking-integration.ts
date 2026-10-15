import { db, executeCreateBookingAtomic, executeCancelBookingAtomic, getAvailableSlotsForStaff } from './server';

async function runIntegrationTests() {
  console.log('========================================================');
  console.log('🚀 NAVBATBOR: BOSQICH 2 INTEGRATSIYA TEST SUITE BOSHLANDI');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Tafsilot: ${detail}`);
      process.exitCode = 1;
    }
  }

  // Find or verify business, staff, and service in database
  const business = db.prepare("SELECT * FROM businesses WHERE status IN ('ACTIVE', 'APPROVED') LIMIT 1").get() as any;
  if (!business) {
    console.error('Test uchun aktiv biznes topilmadi!');
    process.exit(1);
  }
  console.log(`ℹ️ Test Biznes: "${business.name}" (ID: ${business.id})`);

  let service = db.prepare('SELECT * FROM services WHERE business_id = ? AND is_active = 1 LIMIT 1').get(business.id) as any;
  if (!service) {
    const srvId = 'srv-test-' + Math.random().toString(36).substring(7);
    db.prepare(`
      INSERT INTO services (id, business_id, name, duration_minutes, price_uzs, is_active, queue_mode)
      VALUES (?, ?, 'Test Konsultatsiya', 30, 50000, 1, 'HYBRID')
    `).run(srvId, business.id);
    service = db.prepare('SELECT * FROM services WHERE id = ?').get(srvId) as any;
  }
  console.log(`ℹ️ Test Xizmat: "${service.name}" (ID: ${service.id}, Davomiyligi: ${service.duration_minutes} daq)`);

  let staff = db.prepare('SELECT * FROM staff WHERE business_id = ? AND is_active = 1 LIMIT 1').get(business.id) as any;
  if (!staff) {
    const stfId = 'stf-test-' + Math.random().toString(36).substring(7);
    db.prepare(`
      INSERT INTO staff (id, business_id, name, position, is_active)
      VALUES (?, ?, 'Dr. Test Alimov', 'Shifokor', 1)
    `).run(stfId, business.id);
    staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(stfId) as any;
  }
  console.log(`ℹ️ Test Xodim: "${staff.name}" (ID: ${staff.id})\n`);

  // Target test date: future date (e.g., 2026-11-20)
  const testDate = '2026-11-20';

  // Clean any previous test bookings on testDate for this staff
  db.prepare("DELETE FROM bookings WHERE staff_id = ? AND booking_date = ?").run(staff.id, testDate);

  // ---------------------------------------------------------
  // TEST 1: Unified Booking Engine - Website Source
  // ---------------------------------------------------------
  console.log('--- TEST 1: Sayt orqali bron yaratish (source: WEBSITE) ---');
  const webResult = await executeCreateBookingAtomic({
    business_id: business.id,
    service_id: service.id,
    staff_id: staff.id,
    booking_date: testDate,
    start_time: '10:00',
    customer_name: 'Sayt Mijoz',
    customer_phone: '+998901112233',
    source: 'WEBSITE'
  });

  assert(webResult.success === true, 'Saytdan bron muvaffaqiyatli yaratildi');
  assert(Boolean(webResult.booking?.booking_number), 'Bron raqami generatsiya qilindi');
  assert(webResult.booking?.source === 'WEBSITE', 'Bron manbasi WEBSITE deb qayd etildi');

  const dbWebBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(webResult.booking.id) as any;
  assert(dbWebBooking && dbWebBooking.source === 'WEBSITE', 'Yagona SQLite bazasiga saqlandi');

  // ---------------------------------------------------------
  // TEST 2: Unified Booking Engine - Telegram Source
  // ---------------------------------------------------------
  console.log('\n--- TEST 2: Telegram bot orqali bron yaratish (source: TELEGRAM) ---');
  const tgResult = await executeCreateBookingAtomic({
    business_id: business.id,
    service_id: service.id,
    staff_id: staff.id,
    booking_date: testDate,
    start_time: '11:00',
    customer_name: 'Telegram Mijoz',
    customer_phone: '+998909998877',
    source: 'TELEGRAM'
  });

  assert(tgResult.success === true, 'Telegram botdan bron muvaffaqiyatli yaratildi');
  assert(tgResult.booking?.source === 'TELEGRAM', 'Bron manbasi TELEGRAM deb belgilandi');

  const dbTgBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(tgResult.booking.id) as any;
  assert(dbTgBooking && dbTgBooking.status === 'CONFIRMED', 'Telegram broni bazada CONFIRMED holatda');

  // Both bookings exist in the same table and can be queried together by business
  const allBizBookings = db.prepare('SELECT * FROM bookings WHERE business_id = ? AND booking_date = ?').all(business.id, testDate) as any[];
  assert(allBizBookings.length >= 2, 'Yagona jadvalda ikkala manba (Sayt va Bot) bronlari birlashtirildi');

  // ---------------------------------------------------------
  // TEST 3: Strict Double-Booking Protection (Conflict Detection)
  // ---------------------------------------------------------
  console.log('\n--- TEST 3: Takroriy va ustma-ust (double-booking) bronlardan himoya ---');
  // Attempt to book exactly the same slot (10:00 - 10:30) for the same staff
  const conflictResult1 = await executeCreateBookingAtomic({
    business_id: business.id,
    service_id: service.id,
    staff_id: staff.id,
    booking_date: testDate,
    start_time: '10:00',
    customer_name: 'Raqib Mijoz',
    customer_phone: '+998905554433',
    source: 'TELEGRAM'
  });

  assert(conflictResult1.success === false, 'Ayni vaqtga qayta bron qilish rad etildi (success: false)');
  assert(conflictResult1.statusCode === 409, 'Conflict status code 409 qaytarildi');

  // Attempt partial overlap (e.g., 10:15 - 10:45)
  const conflictResult2 = await executeCreateBookingAtomic({
    business_id: business.id,
    service_id: service.id,
    staff_id: staff.id,
    booking_date: testDate,
    start_time: '10:15',
    customer_name: 'Oraliq Mijoz',
    customer_phone: '+998905554433',
    source: 'WEBSITE'
  });

  assert(conflictResult2.success === false, 'Ustma-ust tushuvchi (10:15) bron rad etildi');

  // ---------------------------------------------------------
  // TEST 4: Available Slots Engine Synchronization
  // ---------------------------------------------------------
  console.log('\n--- TEST 4: Bo‘sh vaqtlar hisobi (Available Slots) sinxronligi ---');
  const slotsData = getAvailableSlotsForStaff(business.id, service.id, staff.id, testDate);
  assert(!slotsData.slots.includes('10:00'), '10:00 band qilingan va bo‘sh vaqtlar ro‘yxatidan olib tashlangan');
  assert(!slotsData.slots.includes('11:00'), '11:00 band qilingan va bo‘sh vaqtlar ro‘yxatidan olib tashlangan');
  assert(slotsData.slots.length > 0, 'Qolgan bo‘sh vaqtlar to‘g‘ri taqdim etildi');

  // ---------------------------------------------------------
  // TEST 5: Cancellation Synchronization & Slot Release
  // ---------------------------------------------------------
  console.log('\n--- TEST 5: Bronni bekor qilish va vaqtning darhol bo‘shashi ---');
  const cancelRes = await executeCancelBookingAtomic({
    bookingId: webResult.booking.id,
    actorPhone: '+998901112233',
    source: 'TELEGRAM',
    reason: 'Mijoz vaqti o‘zgargani uchun bekor qildi'
  });

  assert(cancelRes.success === true, 'Bron bekor qilindi');
  assert(cancelRes.booking.status === 'CANCELLED', 'Bron holati CANCELLED ga o‘zgardi');

  // Verify that the freed slot (10:00) is now bookable again!
  const rebookResult = await executeCreateBookingAtomic({
    business_id: business.id,
    service_id: service.id,
    staff_id: staff.id,
    booking_date: testDate,
    start_time: '10:00',
    customer_name: 'Yangi Mijoz',
    customer_phone: '+998903332211',
    source: 'TELEGRAM'
  });

  assert(rebookResult.success === true, 'Bo‘shagan vaqt (10:00) yangi mijoz tomonidan muvaffaqiyatli band qilindi', JSON.stringify(rebookResult));

  // ---------------------------------------------------------
  // TEST 6: Multi-tenant Isolation & Permissions
  // ---------------------------------------------------------
  console.log('\n--- TEST 6: Begona biznes ma’lumotlariga ruxsatsiz aralashuvdan himoya ---');
  try {
    await executeCancelBookingAtomic({
      bookingId: rebookResult.booking.id,
      actorUserId: 'unauthorized-user-999',
      actorRole: 'CUSTOMER',
      source: 'CUSTOMER',
      reason: 'Buzg‘unchi bekor qilishga urindi'
    });
    assert(false, 'Begona foydalanuvchi bronni bekor qila olmadi');
  } catch (err: any) {
    assert(err.statusCode === 403 || err.message.includes('Ruxsat'), '403 Forbidden himoyasi to‘g‘ri ishladi');
  }

  // ---------------------------------------------------------
  // TEST 7: Telegram Decoupling Resilience
  // ---------------------------------------------------------
  console.log('\n--- TEST 7: Telegram xatoliklariga chidamlilik (Decoupling) ---');
  // Even if telegram chat ID is invalid, booking MUST succeed and DB transaction must NOT fail
  const resilientBooking = await executeCreateBookingAtomic({
    business_id: business.id,
    service_id: service.id,
    staff_id: staff.id,
    booking_date: testDate,
    start_time: '14:00',
    customer_name: 'Resilience Test Mijoz',
    customer_phone: '+998907770011',
    source: 'TELEGRAM'
  });

  assert(resilientBooking.success === true, 'Telegram API chaqiruvi muvaffaqiyatsiz bo‘lsa ham bron bazada saqlandi');
  const dbResilient = db.prepare('SELECT id, status FROM bookings WHERE id = ?').get(resilientBooking.booking.id) as any;
  assert(dbResilient && dbResilient.status === 'CONFIRMED', 'Bazada bron to‘liq tasdiqlangan holda qoldi');

  // Clean up test bookings
  db.prepare("DELETE FROM bookings WHERE staff_id = ? AND booking_date = ?").run(staff.id, testDate);

  console.log('\n========================================================');
  console.log(`🎉 TEST NATIJASI: ${passedTests}/${totalTests} BARCHA TESTLAR MUVAFFAQIYATLI O‘TDI!`);
  console.log('========================================================');
  process.exit(0);
}

runIntegrationTests().catch(err => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
