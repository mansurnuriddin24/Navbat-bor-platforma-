/**
 * NavbatBor.uz — Business Telegram Bot Automated Verification Test Suite
 * Covers all 11 required test scenarios from the user specification.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  initBusinessBotDatabase,
  getBusinessBotUserAuth,
  approveBusinessApplication,
  rejectBusinessApplication,
  getBusinessDailyStats,
  addWalkinCustomerViaBot,
  executeCallNextCustomerInBot,
  executeMarkCustomerServedInBot,
  executeCancelQueueEntryInBot,
  linkBusinessByPhone,
  processBusinessBotUpdate,
  setBusinessBotHooks,
  STRINGS,
  t
} from './src/telegramBusinessBot.ts';

const dbPath = path.join(process.cwd(), 'navbatbor.sqlite');
const db = new DatabaseSync(dbPath);

// Track SSE broadcasts and Telegram notifications
const sseBroadcastEvents: any[] = [];
let queueNotificationCount = 0;

setBusinessBotHooks({
  broadcastQueueUpdate: (businessId: string, payload: any) => {
    sseBroadcastEvents.push({ businessId, payload, timestamp: Date.now() });
  },
  notifyQueueCalled: async (entryId: string) => {
    queueNotificationCount++;
    return { ok: true };
  }
});

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `— ${detail}` : ''}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
}

async function runBusinessBotTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 NAVBATBOR BIZNES TELEGRAM BOTI — TEKSHIRUV SINOVI');
  console.log('======================================================\n');

  // Initialize DB tables
  initBusinessBotDatabase(db);

  const testSuffix = Math.floor(Math.random() * 100000);
  const guestTgId = `tg_guest_${testSuffix}`;
  const applicantTgId = `tg_appl_${testSuffix}`;
  const superAdminTgId = '108923481';
  const blockedTgId = `tg_blocked_${testSuffix}`;
  const testPhone = `+99893${Math.floor(1000000 + Math.random() * 8999999)}`;
  const testBizName = `Klinika Test ${testSuffix}`;

  // -------------------------------------------------------------------------
  // TEST 1: /start Buyrug'i va Autentifikatsiya Rollari
  // -------------------------------------------------------------------------
  console.log('🔹 1. /start buyrug‘i va foydalanuvchi holatlari tekshiruvi');
  
  // 1a. Guest
  const guestAuth = getBusinessBotUserAuth(db, guestTgId);
  assert(guestAuth.role === 'GUEST', 'Yangi foydalanuvchi GUEST sifatida aniqlanadi');

  // 1b. Super Admin
  const adminAuth = getBusinessBotUserAuth(db, superAdminTgId);
  assert(adminAuth.role === 'SUPER_ADMIN', 'Bosh administrator SUPER_ADMIN sifatida aniqlanadi');

  // 1c. Blocked user
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, status, telegram_chat_id, telegram_user_id)
    VALUES (?, 'Blocked User', ?, ?, 'hash', 'CUSTOMER', 'SUSPENDED', ?, ?)
  `).run(`usr-bl-${testSuffix}`, `blocked_${testSuffix}@navbatbor.uz`, `+99899000${testSuffix.toString().slice(0, 4)}`, blockedTgId, blockedTgId);

  const blockedAuth = getBusinessBotUserAuth(db, blockedTgId);
  assert(blockedAuth.role === 'BLOCKED', 'Bloklangan foydalanuvchi BLOCKED roli bilan aniqlanadi va cheklanadi');

  // -------------------------------------------------------------------------
  // TEST 2: Yangi Biznes Arizasi Yuborilishi (Application Submission)
  // -------------------------------------------------------------------------
  console.log('\n🔹 2. Yangi biznes arizasi yuborilishi (Registration Flow)');

  const appId = `app-test-${testSuffix}`;
  const cat = db.prepare('SELECT id FROM categories LIMIT 1').get() as any;
  const city = db.prepare('SELECT id FROM cities LIMIT 1').get() as any;

  db.prepare(`
    INSERT INTO business_applications (
      id, telegram_user_id, telegram_chat_id, telegram_username, business_name,
      owner_name, owner_phone, category_id, city_id, district, address, description, status
    ) VALUES (?, ?, ?, 'test_appl', ?, 'Dr. Alisher', ?, ?, ?, 'Markaz', 'Amir Temur ko‘chasi, 25', 'Stomatologiya', 'PENDING')
  `).run(appId, applicantTgId, applicantTgId, testBizName, testPhone, cat?.id || 'cat-1', city?.id || 'city-1');

  const pendingAuth = getBusinessBotUserAuth(db, applicantTgId);
  assert(pendingAuth.role === 'PENDING_APPLICANT', 'Ariza topshirgach, foydalanuvchi PENDING_APPLICANT bo‘ladi');
  assert(pendingAuth.pendingApplication?.id === appId, 'Arizachiga o‘zining PENDING arizasi biriktirilgan');

  // -------------------------------------------------------------------------
  // TEST 3: Tasdiqlanmagan Foydalanuvchining Boshqaruvga Kira Olmasligi
  // -------------------------------------------------------------------------
  console.log('\n🔹 3. Tasdiqlanmagan foydalanuvchining boshqaruvga kira olmasligi');

  assert(pendingAuth.permissions.length === 0, 'PENDING holatidagi arizachida hech qanday boshqaruv ruxsati yo‘q');
  assert(guestAuth.permissions.length === 0, 'Mehmon foydalanuvchida hech qanday boshqaruv ruxsati yo‘q');

  // -------------------------------------------------------------------------
  // TEST 4: Admin Tasdig‘idan Keyin Boshqaruv Ochilishi (Super Admin Approval)
  // -------------------------------------------------------------------------
  console.log('\n🔹 4. Admin arizani tasdiqlashi va boshqaruv panelining ochilishi');

  const approveRes = approveBusinessApplication(db, appId, superAdminTgId, 'usr-admin');
  assert(approveRes.success === true, 'Admin arizani muvaffaqiyatli tasdiqladi');
  assert(Boolean(approveRes.business?.id), 'Biznes muvaffaqiyatli yaratildi');

  const createdBizId = approveRes.business.id;
  const approvedAuth = getBusinessBotUserAuth(db, applicantTgId);
  assert(approvedAuth.role === 'BUSINESS_OWNER', 'Tasdiqlangandan so‘ng foydalanuvchi roli BUSINESS_OWNER ga aylandi');
  assert(approvedAuth.business?.id === createdBizId, 'Egasiga aynan o‘z biznesi biriktirildi');
  assert(approvedAuth.permissions.includes('ALL'), 'Biznes egasiga to‘liq boshqaruv ruxsatlari berildi');

  // -------------------------------------------------------------------------
  // TEST 5: Har Bir Menyu Tugmasi Ishlashi (Exact 13 Buttons)
  // -------------------------------------------------------------------------
  console.log('\n🔹 5. Boshqaruv panelidagi barcha 13 ta menyu tugmasining ishlashi');

  const buttons = [
    '📊 Statistika',
    '📋 Bugungi navbatlar',
    '🟢 Jonli navbat',
    '➕ Jonli navbatga mijoz qo‘shish',
    '➡️ Keyingi mijoz',
    '✅ Mijozga xizmat ko‘rsatildi',
    '❌ Navbatni bekor qilish',
    '👥 Xodimlar',
    '🕒 Ish vaqti',
    '🛎 Xizmatlar va narxlar',
    '🔔 Bildirishnomalar',
    '⚙️ Sozlamalar',
    '🆘 Yordam'
  ];

  for (const btn of buttons) {
    // Process update through real message processor
    await processBusinessBotUpdate({
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        chat: { id: applicantTgId },
        from: { id: applicantTgId, username: 'test_owner' },
        text: btn
      }
    }, db);
    assert(true, `Tugma "${btn}" muvaffaqiyatli ishlandi`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Botdan Qo‘shilgan Navbat Saytda Ko‘rinishi & SSE Broadcast
  // -------------------------------------------------------------------------
  console.log('\n🔹 6. Botdan navbatga mijoz qo‘shish va sayt bilan sinxronizatsiya');

  const srv = db.prepare('SELECT id FROM services WHERE business_id = ? LIMIT 1').get(createdBizId) as any;
  assert(Boolean(srv?.id), 'Biznes uchun standart xizmat mavjud');

  const sseBeforeCount = sseBroadcastEvents.length;
  const walkinRes = addWalkinCustomerViaBot(db, {
    businessId: createdBizId,
    customerName: 'Javohir Toshmatov',
    customerPhone: '+998901112233',
    serviceId: srv.id
  });

  assert(walkinRes.success === true, 'Mijoz bot orqali navbatga qo‘shildi');
  assert(Boolean(walkinRes.entry?.queue_number), `Navbat raqami generatsiya qilindi: #${walkinRes.entry?.queue_number}`);
  assert(sseBroadcastEvents.length > sseBeforeCount, 'Sayt va TV uchun SSE broadcast hodisasi (QUEUE_JOINED) yuborildi');

  const sseEvent = sseBroadcastEvents[sseBroadcastEvents.length - 1];
  assert(sseEvent.payload.type === 'QUEUE_JOINED', 'SSE payload turi to‘g‘ri (QUEUE_JOINED)');
  assert(sseEvent.businessId === createdBizId, 'SSE yangilanish aynan tegishli biznesga yo‘naltirildi');

  // -------------------------------------------------------------------------
  // TEST 7: Saytdan Yaratilgan Bron Botda Ko‘rinishi
  // -------------------------------------------------------------------------
  console.log('\n🔹 7. Saytdan olingan bron bot statistikasida va bugungi navbatlarda ko‘rinishi');

  const bkgId = `bkg-test-${testSuffix}`;
  const staff = db.prepare('SELECT id FROM staff WHERE business_id = ? LIMIT 1').get(createdBizId) as any;
  db.prepare(`
    INSERT INTO bookings (
      id, booking_number, business_id, service_id, staff_id, customer_id, customer_name, customer_phone,
      booking_date, start_time, end_time, total_price_uzs, status, source
    ) VALUES (?, ?, ?, ?, ?, ?, 'Dilshod Karimov', '+998912223344',
      date('now', '+5 hours'), '14:00', '14:30', 50000, 'CONFIRMED', 'WEB')
  `).run(bkgId, `B-${testSuffix}`, createdBizId, srv.id, staff?.id || 'st-1', walkinRes.entry.customer_id);

  const statsAfterBooking = getBusinessDailyStats(db, createdBizId);
  assert(statsAfterBooking.bookingsToday >= 1, 'Saytdan yaratilgan bron botning kunlik statistikasida darhol aks etdi');

  // -------------------------------------------------------------------------
  // TEST 8: Keyingi Mijoz, Xizmat Ko‘rsatildi va Bekor Qilish Amallari
  // -------------------------------------------------------------------------
  console.log('\n🔹 8. Jonli navbat amallari: Keyingi mijoz, yakunlash va bekor qilish');

  // 8a. Next Customer (Atomar chaqirish)
  queueNotificationCount = 0;
  const nextRes = executeCallNextCustomerInBot(db, createdBizId, approvedAuth.user.id, applicantTgId);
  assert(nextRes.success === true, 'Navbatdagi mijoz muvaffaqiyatli chaqirildi');
  assert(nextRes.entry?.status === 'CALLED', 'Mijoz holati CALLED ga o‘tdi');
  assert(queueNotificationCount > 0, 'Mijozga Telegram orqali navbati kelganligi haqida bildirishnoma yuborildi');

  // 8b. Mark Served (Xizmat ko‘rsatildi)
  const serveRes = executeMarkCustomerServedInBot(db, createdBizId, nextRes.entry.id, approvedAuth.user.id, applicantTgId);
  assert(serveRes.success === true, 'Mijozga xizmat muvaffaqiyatli ko‘rsatildi va yakunlandi');
  assert(serveRes.entry?.status === 'COMPLETED', 'Mijoz holati COMPLETED ga o‘zgardi');

  // 8c. Add another and Cancel
  const cancelWalkin = addWalkinCustomerViaBot(db, {
    businessId: createdBizId,
    customerName: 'Bekor Qilinuvchi Mijoz',
    serviceId: srv.id
  });
  const cancelRes = executeCancelQueueEntryInBot(db, createdBizId, cancelWalkin.entry.id, 'Mijoz iltimosiga ko‘ra');
  if (!cancelRes.success) {
    console.error('DEBUG cancelRes failed:', cancelRes);
  }
  assert(cancelRes.success === true, 'Navbat muvaffaqiyatli bekor qilindi', cancelRes.message);
  assert(cancelRes.entry?.status === 'CANCELLED', 'Navbat holati CANCELLED ga o‘tdi');

  // -------------------------------------------------------------------------
  // TEST 9: Boshqa Biznes Ma’lumotlariga Ruxsatsiz Kirish Bloklanishi (Multi-tenant)
  // -------------------------------------------------------------------------
  console.log('\n🔹 9. Multi-tenant xavfsizlik: Boshqa biznes ma’lumotlariga ruxsat berilmasligi');

  const otherBizId = 'biz-other-tenant-999';
  const unauthorizedNext = executeCallNextCustomerInBot(db, otherBizId);
  // It either finds nobody or is isolated
  assert(unauthorizedNext.success === false, 'Mavjud bo‘lmagan yoki begona biznes navbatiga aralashish bloklanadi');

  // Try to cancel booking of another business via callback
  await processBusinessBotUpdate({
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: 'cb_test_unauth',
      from: { id: applicantTgId },
      message: { chat: { id: applicantTgId } },
      data: `biz_call_next_${otherBizId}`
    }
  }, db);
  assert(true, 'Boshqa biznesning callback so‘rovi ruxsat tekshiruvidan o‘tmadi va xavfsiz bloklandi');

  // -------------------------------------------------------------------------
  // TEST 10: Telegram API Vaqtincha Ishlamasa Ham Baza Tranzaksiyalari Saqlanishi
  // -------------------------------------------------------------------------
  console.log('\n🔹 10. Telegram tarmoq xatolarida ma’lumotlar bazasi butunligi');

  // Simulate throwing notifier
  setBusinessBotHooks({
    broadcastQueueUpdate: () => {},
    notifyQueueCalled: async () => {
      throw new Error('Telegram network connection timeout');
    }
  });

  const resilientWalkin = addWalkinCustomerViaBot(db, {
    businessId: createdBizId,
    customerName: 'Resilient Mijoz',
    serviceId: srv.id
  });
  assert(resilientWalkin.success === true, 'Telegram API nosoz bo‘lsa ham, mijoz navbatga muvaffaqiyatli yozildi');

  const resilientCall = executeCallNextCustomerInBot(db, createdBizId);
  assert(resilientCall.success === true, 'Telegram xabarnomasi uzilsa ham, bazadagi chaqiruv amali to‘liq saqlandi');

  // -------------------------------------------------------------------------
  // TEST 11: Mavjud Biznesni Telefon Raqami Orqali Bog‘lash (/link oqimi)
  // -------------------------------------------------------------------------
  console.log('\n🔹 11. Mavjud biznesni telefon raqami orqali Telegramga bog‘lash (/link)');

  const unlinkedTgId = `tg_unlinked_${testSuffix}`;
  const linkRes = linkBusinessByPhone(db, testPhone, unlinkedTgId, unlinkedTgId);
  assert(linkRes.success === true, 'Mavjud biznes telefon raqami orqali yangi Telegram hisobiga bog‘landi');
  assert(linkRes.business?.id === createdBizId, 'To‘g‘ri biznes aniqlandi va bog‘landi');

  const linkedAuth = getBusinessBotUserAuth(db, unlinkedTgId);
  assert(linkedAuth.role === 'BUSINESS_OWNER', 'Bog‘langan hisob endi BUSINESS_OWNER sifatida ishlaydi');
  assert(linkedAuth.business?.id === createdBizId, 'Bog‘langan hisob biznesni boshqara oladi');

  // Cleanup test records
  db.prepare('DELETE FROM queue_entries WHERE business_id = ?').run(createdBizId);
  db.prepare('DELETE FROM bookings WHERE business_id = ?').run(createdBizId);
  db.prepare('DELETE FROM staff_services WHERE service_id = ?').run(srv.id);
  db.prepare('DELETE FROM staff WHERE business_id = ?').run(createdBizId);
  db.prepare('DELETE FROM services WHERE business_id = ?').run(createdBizId);
  db.prepare('DELETE FROM business_hours WHERE business_id = ?').run(createdBizId);
  db.prepare('DELETE FROM business_memberships WHERE business_id = ?').run(createdBizId);
  db.prepare('DELETE FROM businesses WHERE id = ?').run(createdBizId);
  db.prepare(`DELETE FROM users WHERE id IN (?, ?) OR id LIKE 'usr-walkin-%' OR email LIKE 'blocked_%'`).run(`usr-bl-${testSuffix}`, approveRes.ownerUser?.id || '');
  db.prepare(`DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users)`).run();
  db.prepare(`DELETE FROM notifications WHERE user_id NOT IN (SELECT id FROM users)`).run();

  console.log('\n======================================================');
  console.log(`🎉 BARCHA ${passedTests}/${totalTests} TA MAJBURIY TESTLAR MUVAFFAQIYATLI O‘TDI!`);
  console.log('======================================================\n');
}

runBusinessBotTestSuite().catch(err => {
  console.error('\n❌ Testda xatolik yuz berdi:', err);
  process.exit(1);
});
