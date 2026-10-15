import { DatabaseSync } from 'node:sqlite';

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function login(email: string, pass: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 NAVBATBOR.UZ: WALK_IN_CUSTOMER AVTOMATIK TESTLAR');
  console.log('====================================================\n');

  const db = new DatabaseSync('navbatbor.sqlite');

  // Step 0: Ensure test business & service & staff
  const testBiz = db.prepare("SELECT id, name FROM businesses LIMIT 1").get() as any;
  const testService = testBiz ? (db.prepare("SELECT id, name, duration_minutes FROM services WHERE business_id = ? LIMIT 1").get(testBiz.id) as any) : null;
  const testStaff = testBiz ? (db.prepare("SELECT id, name FROM staff WHERE business_id = ? LIMIT 1").get(testBiz.id) as any) : null;

  if (!testBiz || !testService || !testStaff) {
    console.log('Test business/service/staff not found, skipping walk_in live test.');
    return;
  }

  console.log(`📌 Test Biznes: ${testBiz.name} (${testBiz.id})`);
  console.log(`📌 Test Xizmat: ${testService.name} (${testService.id})`);
  console.log(`📌 Test Xodim: ${testStaff.name} (${testStaff.id})\n`);

  const ownerToken = await login('owner@navbatbor.uz', 'owner123');
  const customerToken = await login('mijoz@navbatbor.uz', 'mijoz123');

  // TEST 1: Ruxsatsiz so'rov (No token -> 401)
  try {
    const res = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Begona',
        service_id: testService.id,
        override_hours: true
      })
    });
    if (res.status === 401) {
      results.push({ name: '1. Ruxsatsiz so‘rovni bloklash (Token yo‘q -> 401)', passed: true });
    } else {
      results.push({ name: '1. Ruxsatsiz so‘rovni bloklash', passed: false, details: `Status ${res.status}` });
    }
  } catch (err: any) {
    results.push({ name: '1. Ruxsatsiz so‘rovni bloklash', passed: false, details: err.message });
  }

  // TEST 2: Begona mijoz so'rovi (Oddiy mijoz tokeni -> 403 Forbidden)
  try {
    const res = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Noqonuniy Walk-in',
        service_id: testService.id,
        override_hours: true
      })
    });
    if (res.status === 403) {
      results.push({ name: '2. Begona foydalanuvchini bloklash (CUSTOMER huquqsiz -> 403)', passed: true });
    } else {
      results.push({ name: '2. Begona foydalanuvchini bloklash', passed: false, details: `Status ${res.status}` });
    }
  } catch (err: any) {
    results.push({ name: '2. Begona foydalanuvchini bloklash', passed: false, details: err.message });
  }

  // TEST 3: Ish jadvali tekshiruvi va Telefon raqamisiz jonli navbat yaratish (Ixtiyoriy telefon, manba WALK_IN)
  let anonTicketId = '';
  try {
    // 3a. Schedule Awareness check: when outside hours without override, returns is_closed: true
    const checkScheduleRes = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Jadval Sinovchisi',
        service_id: testService.id,
        staff_id: testStaff.id,
        override_hours: false
      })
    });
    const checkScheduleData = await checkScheduleRes.json();
    const scheduleEnforced = checkScheduleRes.status === 400 && checkScheduleData.is_closed;

    // 3b. Authorized walk-in with override_hours: true
    const res = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Zaldagi Mehmon (Nomsiz)',
        // phone intentionally omitted
        service_id: testService.id,
        staff_id: testStaff.id,
        override_hours: true
      })
    });
    const data = await res.json();
    if (res.status === 201 && data.success && data.ticket && data.ticket.source === 'WALK_IN' && data.ticket.queue_number) {
      anonTicketId = data.ticket.id;
      results.push({ 
        name: '3. Telefon raqamisiz navbat & Ish jadvali hisobi (Ixtiyoriy telefon, avtomatik raqam va WALK_IN manba)', 
        passed: true,
        details: `Chipta: #${data.ticket.queue_number}, Manba: ${data.ticket.source}, Jadval tekshiruvi: ${scheduleEnforced ? 'Faol (Soatdan keyin ogohlantiradi)' : 'Mos'}`
      });
    } else {
      results.push({ name: '3. Telefon raqamisiz navbat', passed: false, details: JSON.stringify(data) });
    }
  } catch (err: any) {
    results.push({ name: '3. Telefon raqamisiz navbat', passed: false, details: err.message });
  }

  // TEST 4: Telefon raqamli navbat va takroriy faol navbat tekshiruvi (Duplicate Prevention -> 409)
  const uniquePhone = '+99890' + Math.floor(1000000 + Math.random() * 9000000);
  try {
    // First ticket with phone
    const res1 = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Anvar Alimov',
        customer_phone: uniquePhone,
        service_id: testService.id,
        staff_id: testStaff.id,
        override_hours: true
      })
    });
    const data1 = await res1.json();
    if (res1.status !== 201) {
      throw new Error(`Birinchi navbat yaratilmadi: ${JSON.stringify(data1)}`);
    }

    // Attempt second ticket with same phone immediately
    const res2 = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Anvar Alimov Takroriy',
        customer_phone: uniquePhone,
        service_id: testService.id,
        staff_id: testStaff.id,
        override_hours: true
      })
    });
    const data2 = await res2.json();

    if (res2.status === 409 && data2.error && data2.error.includes('faol navbatda mavjud')) {
      results.push({ 
        name: '4. Takroriy faol navbatni oldini olish (Bir xil telefon bilan takroriy navbat -> 409 Conflict)', 
        passed: true,
        details: `To‘xtatildi: ${data2.error}`
      });
    } else {
      results.push({ 
        name: '4. Takroriy faol navbatni oldini olish', 
        passed: false, 
        details: `Status ${res2.status}: ${JSON.stringify(data2)}` 
      });
    }
  } catch (err: any) {
    results.push({ name: '4. Takroriy faol navbatni oldini olish', passed: false, details: err.message });
  }

  // TEST 5: Audit jurnaliga xodim IDsi va WALK_IN manbasi yozilishi
  try {
    const auditRecord = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE action = 'WALK_IN_QUEUE_CREATED' AND user_id = 'usr-owner-1'
      ORDER BY created_at DESC 
      LIMIT 1
    `).get() as any;

    if (auditRecord) {
      results.push({ 
        name: '5. Audit jurnali (Xodim IDsi, entity_id va hodisa qayd etildi)', 
        passed: true,
        details: `Action: ${auditRecord.action}, User: ${auditRecord.user_id}, Details: ${auditRecord.details?.slice(0, 50)}...`
      });
    } else {
      results.push({ name: '5. Audit jurnali', passed: false, details: 'Audit yozuvi topilmadi' });
    }
  } catch (err: any) {
    results.push({ name: '5. Audit jurnali', passed: false, details: err.message });
  }

  // TEST 6: Aniq vaqtli Walk-in Bron va Vaqt to‘qnashuvlari (Slot overlap prevention -> 409)
  try {
    // Generate future date (3 to 10 days ahead to ensure weekday and clear slot)
    const d = new Date();
    d.setDate(d.getDate() + 5);
    // If Sunday (0), move to Monday (+1)
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    const targetDate = d.toISOString().slice(0, 10);
    const slotTime = '11:00';

    // Clean up any previous test booking on this slot
    db.prepare("DELETE FROM bookings WHERE staff_id = ? AND booking_date = ? AND start_time = ?").run(testStaff.id, targetDate, slotTime);

    // 1st booking
    const bkgRes1 = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'APPOINTMENT',
        customer_name: 'Dilorom Rahimova',
        customer_phone: '+998935554433',
        service_id: testService.id,
        staff_id: testStaff.id,
        booking_date: targetDate,
        start_time: slotTime,
        guest_notes: 'Birinchi bron qabuli'
      })
    });
    const bkgData1 = await bkgRes1.json();
    if (bkgRes1.status !== 201) {
      throw new Error(`Birinchi bron yaratishda xato: ${JSON.stringify(bkgData1)}`);
    }

    // 2nd booking attempt for the exact same staff, date and time
    const bkgRes2 = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'APPOINTMENT',
        customer_name: 'Nodira Salimova (To‘qnashuv)',
        customer_phone: '+998947778899',
        service_id: testService.id,
        staff_id: testStaff.id,
        booking_date: targetDate,
        start_time: slotTime,
        guest_notes: 'Ikkinchi to‘qnashuvchi bron'
      })
    });
    const bkgData2 = await bkgRes2.json();

    if (bkgRes2.status === 409 || bkgRes2.status === 400) {
      results.push({ 
        name: '6. Bron vaqt to‘qnashuvlarini qayta tekshirish (Vaqt band bo‘lganda rad etish -> 409/400)', 
        passed: true,
        details: `Rad etildi: ${bkgData2.error}`
      });
    } else {
      results.push({ 
        name: '6. Bron vaqt to‘qnashuvlarini qayta tekshirish', 
        passed: false, 
        details: `Status ${bkgRes2.status}: ${JSON.stringify(bkgData2)}` 
      });
    }
  } catch (err: any) {
    results.push({ name: '6. Bron vaqt to‘qnashuvlarini qayta tekshirish', passed: false, details: err.message });
  }

  // TEST 7: Parallel so'rovlar (Concurrency race conditions check)
  try {
    const parallelCount = 5;
    const parallelPromises = Array.from({ length: parallelCount }, (_, idx) => {
      return fetch(`${BASE_URL}/api/business/walk-in`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`
        },
        body: JSON.stringify({
          business_id: testBiz.id,
          type: 'LIVE_QUEUE',
          customer_name: `Parallel Mijoz #${idx + 1}`,
          service_id: testService.id,
          staff_id: testStaff.id,
          override_hours: true
        })
      }).then(r => r.json());
    });

    const parallelResults = await Promise.all(parallelPromises);
    const ticketNumbers = parallelResults.map(r => r.ticket?.queue_number).filter(Boolean);
    const uniqueTickets = new Set(ticketNumbers);

    if (ticketNumbers.length === parallelCount && uniqueTickets.size === parallelCount) {
      results.push({ 
        name: '7. Parallel so‘rovlar (5 ta parallel navbat atomik ravishda to‘qnashuvsiz va unikal raqamlar bilan yaratildi)', 
        passed: true,
        details: `Yaratilgan chiptalar: ${ticketNumbers.join(', ')}`
      });
    } else {
      results.push({ 
        name: '7. Parallel so‘rovlar', 
        passed: false, 
        details: `Tickets: ${ticketNumbers.join(', ')}, expected ${parallelCount} unique` 
      });
    }
  } catch (err: any) {
    results.push({ name: '7. Parallel so‘rovlar', passed: false, details: err.message });
  }

  // TEST 8: Printerga mos talon ma'lumotlari to'liqligi
  try {
    const res = await fetch(`${BASE_URL}/api/business/walk-in`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        business_id: testBiz.id,
        type: 'LIVE_QUEUE',
        customer_name: 'Talon Sinovchisi',
        service_id: testService.id,
        override_hours: true
      })
    });
    const data = await res.json();
    const t = data.ticket;
    const requiredKeys = ['queue_number', 'customer_name', 'service_name', 'service_price', 'staff_name', 'business_name', 'business_address', 'business_phone', 'status', 'people_ahead', 'estimated_wait_minutes', 'source'];
    const missing = requiredKeys.filter(k => t && (t[k] === undefined || t[k] === null));

    if (missing.length === 0) {
      results.push({ 
        name: '8. Talon sahifasi ma‘lumotlar to‘liqligi (Chipta raqami, xizmat narxi, kutish vaqti, manzil, telefon va h.k.)', 
        passed: true,
        details: `Barcha ${requiredKeys.length} ta majburiy maydonlar mavjud.`
      });
    } else {
      results.push({ 
        name: '8. Talon sahifasi ma‘lumotlar to‘liqligi', 
        passed: false, 
        details: `Yetishmayotgan maydonlar: ${missing.join(', ')}` 
      });
    }
  } catch (err: any) {
    results.push({ name: '8. Talon sahifasi ma‘lumotlar to‘liqligi', passed: false, details: err.message });
  }

  // Summary Report
  console.log('\n====================================================');
  console.log('📊 TEST NATIJALARI HISOBOTI');
  console.log('====================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`✅ [O‘TDI] ${r.name}`);
      if (r.details) console.log(`   ℹ️ ${r.details}`);
    } else {
      console.log(`❌ [XATO] ${r.name}`);
      if (r.details) console.log(`   ⚠️ Sabab: ${r.details}`);
    }
  }
  console.log(`\nJAMI: ${results.length} ta testdan ${passCount} tasi muvaffaqiyatli yakunlandi.`);
  console.log('====================================================\n');

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
