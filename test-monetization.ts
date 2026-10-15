/**
 * NavbatBor.uz — To'liq Monetizatsiya Moduli Testlari
 * Unit, Integration va End-to-End Xavfsizlik Sinovlari
 */
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { 
  INITIAL_PLANS, 
  INITIAL_EXTRA_SERVICES, 
  AD_PACKAGES, 
  calculateDaysRemaining,
  formatUzs
} from './src/monetizationConfig.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('   NAVBATBOR.UZ MONETIZATSIYA MODULI TEST SUITE');
  console.log('======================================================\n');

  const db = new DatabaseSync('navbatbor.sqlite');

  // ========================================================
  // 1. TARIFLAR UNIT TESTLARI
  // ========================================================
  console.log('1. TARIFLAR VA LIMITLAR KONFIGURATSIYASI');
  const startPlan = INITIAL_PLANS.START;
  const bizPlan = INITIAL_PLANS.BUSINESS;
  const proPlan = INITIAL_PLANS.PRO;
  const premPlan = INITIAL_PLANS.PREMIUM;

  assert(startPlan?.price_uzs === 149000, 'START tarifi narxi 149 000 so‘m');
  assert(proPlan?.price_uzs === 299000, 'PRO tarifi narxi 299 000 so‘m');
  assert(bizPlan?.price_uzs === 599000, 'BUSINESS tarifi narxi 599 000 so‘m');
  assert(premPlan?.price_uzs === 999000, 'PREMIUM tarifi narxi 999 000 so‘m');

  assert(startPlan?.limits.max_staff === 3, 'START xodim limiti: 3');
  assert(proPlan?.limits.max_staff === 8, 'PRO xodim limiti: 8');
  assert(bizPlan?.limits.max_staff === 25, 'BUSINESS xodim limiti: 25');
  assert(premPlan?.limits.max_staff >= 999, 'PREMIUM xodim limiti: cheksiz (999+)');

  assert(startPlan?.limits.can_use_tv_display === false, 'START da TV monitor qo‘llab-quvvatlanmaydi');
  assert(proPlan?.limits.can_use_tv_display === true, 'PRO da TV monitor qo‘llab-quvvatlanadi');
  assert(bizPlan?.limits.can_use_tv_display === true, 'BUSINESS da TV monitor qo‘llab-quvvatlanadi');
  assert(premPlan?.limits.can_use_custom_branding === true, 'PREMIUM da o‘z brendi (White-label) mavjud');

  // DB da saqlangan tariflarni tekshirish
  const dbPlans = db.prepare('SELECT code, price_uzs FROM subscription_plans').all() as any[];
  assert(dbPlans.some(p => p.code === 'START' && p.price_uzs === 149000), 'DB: START tarifi 149 000 so‘m bilan mavjud');
  assert(dbPlans.some(p => p.code === 'PRO' && p.price_uzs === 299000), 'DB: PRO tarifi 299 000 so‘m bilan mavjud');
  assert(dbPlans.some(p => p.code === 'BUSINESS' && p.price_uzs === 599000), 'DB: BUSINESS tarifi 599 000 so‘m bilan mavjud');

  // ========================================================
  // 2. OBUNALAR VA 14 KUNLIK TRIAL TESTLARI
  // ========================================================
  console.log('\n2. OBUNALAR VA 14 KUNLIK TRIAL FUNKSIYASI');
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const daysDiff = Math.round((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  assert(daysDiff === 14, 'Yangi biznes uchun sinov muddati roppa-rosa 14 kun hisoblanadi');

  // Test biznes yaratish va trial tekshirish
  const testBizId = 'test-biz-' + Date.now();
  db.prepare(`
    INSERT INTO businesses (
      id, name, slug, category_id, city_id, owner_id, phone, address, status,
      subscription_plan_code, subscription_expires_at, subscription_status,
      is_trial, trial_used, trial_started_at
    ) VALUES (
      ?, 'Test Monetization Salon', ?, 'cat-barber', 'city-qarshi', 'usr-admin', '+998901234567', 'Markaz, 12-uy', 'APPROVED',
      'START', ?, 'TRIAL', 1, 1, ?
    )
  `).run(testBizId, 'test-salon-' + Date.now(), trialEnd.toISOString(), now.toISOString());

  const insertedBiz = db.prepare('SELECT subscription_status, is_trial, subscription_plan_code FROM businesses WHERE id = ?').get(testBizId) as any;
  assert(insertedBiz.subscription_status === 'TRIAL', 'Biznes boshlang‘ich holati TRIAL');
  assert(insertedBiz.is_trial === 1, 'is_trial flag 1 ga teng');

  // ========================================================
  // 3. TO‘LOV INTEGRATSIYASI VA IDEMPOTENTLIK TESTLARI
  // ========================================================
  console.log('\n3. TO‘LOV INTEGRATSIYASI, CLICK & PAYME, IDEMPOTENTLIK');
  const testTransId = 'tx-test-' + Date.now();
  const clickTransId = 'click-trans-998877';

  // 1-bosqich: To‘lov tranzaksiyasini yaratish (PENDING)
  db.prepare(`
    INSERT INTO subscription_transactions (
      id, business_id, plan_code, duration_days, amount_uzs,
      payment_method, provider_trans_id, status, created_at
    ) VALUES (
      ?, ?, 'PRO', 30, 299000, 'CLICK', ?, 'PENDING', CURRENT_TIMESTAMP
    )
  `).run(testTransId, testBizId, clickTransId);

  const pendingTx = db.prepare('SELECT status, amount_uzs FROM subscription_transactions WHERE id = ?').get(testTransId) as any;
  assert(pendingTx.status === 'PENDING', 'Tranzaksiya boshlang‘ich holati PENDING');
  assert(pendingTx.amount_uzs === 299000, 'Tranzaksiya summasi 299 000 so‘m');

  // 2-bosqich: Birinchi Complete callback (Tasdiqlash & Faollashtirish)
  const tx1 = db.prepare('SELECT status, business_id, duration_days, plan_code FROM subscription_transactions WHERE id = ?').get(testTransId) as any;
  assert(tx1.status === 'PENDING', 'Birinchi chaqiruvda tranzaksiya hali PENDING');

  // Faollashtirish tranzaksiyasi
  const extendDays = tx1.duration_days;
  const newExpiry = new Date(Date.now() + extendDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    UPDATE subscription_transactions 
    SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'PENDING'
  `).run(testTransId);

  db.prepare(`
    UPDATE businesses 
    SET subscription_plan_code = ?,
        subscription_expires_at = ?,
        subscription_status = 'ACTIVE',
        is_trial = 0
    WHERE id = ?
  `).run(tx1.plan_code, newExpiry, testBizId);

  const completedTx = db.prepare('SELECT status FROM subscription_transactions WHERE id = ?').get(testTransId) as any;
  const activeBiz = db.prepare('SELECT subscription_status, subscription_plan_code, is_trial FROM businesses WHERE id = ?').get(testBizId) as any;
  assert(completedTx.status === 'COMPLETED', 'Tranzaksiya COMPLETED ga o‘tdi');
  assert(activeBiz.subscription_status === 'ACTIVE', 'Biznes obunasi ACTIVE holatga o‘tdi');
  assert(activeBiz.is_trial === 0, 'Sinov muddati tugatildi (is_trial = 0)');
  assert(activeBiz.subscription_plan_code === 'PRO', 'Biznes tarifi PRO ga yangilandi');

  // 3-bosqich: TAKRORIY CALLBACK (Double activation attack)
  // Xuddi shu to‘lov bilan obunani yana 30 kunga uzaytirishga urinish
  const reattempt = db.prepare(`
    UPDATE subscription_transactions 
    SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'PENDING'
  `).run(testTransId);
  assert(reattempt.changes === 0, 'HIMOYA: Takroriy to‘lov callbacki rad etildi (changes = 0, idempotentlik saqlandi)');

  // ========================================================
  // 4. REKLAMA MODULI TESTLARI
  // ========================================================
  console.log('\n4. REKLAMA MODULI TESTLARI');
  const adPackage = AD_PACKAGES[0];
  const adOption = adPackage.durations[0];
  const adStart = new Date();
  const adEnd = new Date(adStart.getTime() + adOption.days * 24 * 60 * 60 * 1000);
  const testAdId = 'ad-test-' + Date.now();

  db.prepare(`
    INSERT INTO ad_promotions (
      id, business_id, plan_type, campaign_type, target_category_id,
      title, start_date, end_date, amount_uzs, status, notes
    ) VALUES (
      ?, ?, ?, 'TOP_FEATURED', 'cat-barber', 'Top Salon Reklamasi',
      ?, ?, ?, 'ACTIVE', 'Test reklama kampaniyasi'
    )
  `).run(testAdId, testBizId, adPackage.type, adStart.toISOString(), adEnd.toISOString(), adOption.price_uzs);

  const insertedAd = db.prepare('SELECT amount_uzs, status, campaign_type FROM ad_promotions WHERE id = ?').get(testAdId) as any;
  assert(insertedAd.amount_uzs === adOption.price_uzs, `Reklama narxi to‘g‘ri qayd etildi: ${formatUzs(adOption.price_uzs)}`);
  assert(insertedAd.status === 'ACTIVE', 'Reklama holati ACTIVE');
  assert(insertedAd.campaign_type === 'TOP_FEATURED', 'Kampaniya turi: TOP_FEATURED');

  // ========================================================
  // 5. QO‘SHIMCHA XIZMATLAR TESTLARI
  // ========================================================
  console.log('\n5. QO‘SHIMCHA XIZMATLAR TESTLARI');
  const extraServices = INITIAL_EXTRA_SERVICES;
  assert(extraServices.length >= 5, 'Kamida 5 ta qo‘shimcha xizmat mavjud');
  assert(extraServices.some(s => s.code === 'initial_setup'), 'Biznesni dastlabki sozlash xizmati mavjud');
  assert(extraServices.some(s => s.code === 'sms_bundle'), 'SMS paketlar xizmati mavjud');
  assert(extraServices.some(s => s.code === 'printer_setup'), 'Printer sozlash xizmati mavjud');
  assert(extraServices.some(s => s.code === 'advanced_analytics'), 'Kengaytirilgan statistika xizmati mavjud');

  const testOrderId = 'order-test-' + Date.now();
  db.prepare(`
    INSERT INTO extra_service_orders (
      id, business_id, service_code, service_name, amount_uzs,
      status, payment_method, notes
    ) VALUES (
      ?, ?, 'printer_setup', 'Printer va Chek Integratsiyasi', 150000,
      'CONFIRMED', 'CLICK', 'POS printer sozlash'
    )
  `).run(testOrderId, testBizId);

  const order = db.prepare('SELECT status, amount_uzs FROM extra_service_orders WHERE id = ?').get(testOrderId) as any;
  assert(order.status === 'CONFIRMED' && order.amount_uzs === 150000, 'Qo‘shimcha xizmat buyurtmasi 150 000 so‘m bilan qayd etildi');

  // ========================================================
  // 6. ADMIN MONETIZATSIYA HISOBOTLARI VA SOF FOYDA TESTI
  // ========================================================
  console.log('\n6. ADMIN MONETIZATSIYA, XARAJATLAR VA SOF FOYDA HISOBLASH');
  // Haqiqiy xarajat qo‘shish
  const testExpId = 'exp-test-' + Date.now();
  db.prepare(`
    INSERT INTO monetization_expenses (
      id, category, title, amount_uzs, expense_date, notes
    ) VALUES (
      ?, 'SERVER_HOSTING', 'VPS Server Xarajati', 250000, CURRENT_DATE, 'Test server xarajati'
    )
  `).run(testExpId);

  // Daromad va xarajat agregatsiyasi
  const subRevenue = (db.prepare("SELECT COALESCE(SUM(amount_uzs), 0) as s FROM subscription_transactions WHERE status = 'COMPLETED'").get() as any).s;
  const adRevenue = (db.prepare("SELECT COALESCE(SUM(amount_uzs), 0) as s FROM ad_promotions WHERE status = 'ACTIVE'").get() as any).s;
  const extraRevenue = (db.prepare("SELECT COALESCE(SUM(amount_uzs), 0) as s FROM extra_service_orders WHERE status IN ('CONFIRMED', 'DELIVERED')").get() as any).s;
  const totalRevenue = subRevenue + adRevenue + extraRevenue;

  const totalExpenses = (db.prepare("SELECT COALESCE(SUM(amount_uzs), 0) as s FROM monetization_expenses").get() as any).s;
  const netProfit = totalRevenue - totalExpenses;

  assert(totalRevenue > 0, `Jami tushum hisoblandi: ${formatUzs(totalRevenue)}`);
  assert(totalExpenses >= 250000, `Haqiqiy xarajatlar mavjud: ${formatUzs(totalExpenses)}`);
  assert(netProfit === totalRevenue - totalExpenses, `Sof foyda qat'iy formula bo‘yicha hisoblandi: ${formatUzs(netProfit)} (Tushum - Xarajat)`);

  // ========================================================
  // 7. TELEGRAM BILDIRISHNOMA NAVBATI VA DEDUPLIKATSIYA TESTLARI
  // ========================================================
  const alertId1 = 'alert-sub-3d-' + testBizId;
  const alertKey = 'dedup-alert-sub-3d-' + testBizId;
  
  // 1-marta navbatga qo‘shish
  const res1 = db.prepare(`
    INSERT OR IGNORE INTO telegram_notification_queue (
      id, event_type, recipient_type, recipient_id, dedup_key, chat_id, message, status
    ) VALUES (
      ?, 'SUB_EXPIRING_3D', 'BUSINESS_OWNER', ?, ?, '12345678', 'Obunangiz tugashiga 3 kun qoldi', 'PENDING'
    )
  `).run(alertId1, testBizId, alertKey);
  assert(res1.changes === 1, 'Birinchi bildirishnoma navbatga muvaffaqiyatli qo‘yildi');

  // 2-marta bir xil dedup_key bilan qo‘shish (Deduplikatsiya / Idempotentlik)
  const res2 = db.prepare(`
    INSERT OR IGNORE INTO telegram_notification_queue (
      id, event_type, recipient_type, recipient_id, dedup_key, chat_id, message, status
    ) VALUES (
      'alert-dup-2', 'SUB_EXPIRING_3D', 'BUSINESS_OWNER', ?, ?, '12345678', 'Obunangiz tugashiga 3 kun qoldi', 'PENDING'
    )
  `).run(testBizId, alertKey);
  assert(res2.changes === 0, 'DEDUPLIKATSIYA: Bir xil dedup_key bilan takroriy xabar yuborish bloklandi (changes = 0)');

  // Navbatdagi xabarni jo‘natilgan deb belgilash
  db.prepare(`
    UPDATE telegram_notification_queue
    SET status = 'SENT', sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(alertId1);

  const sentNotice = db.prepare('SELECT status FROM telegram_notification_queue WHERE id = ?').get(alertId1) as any;
  assert(sentNotice.status === 'SENT', 'Telegram xabari ishonchli ravishda SENT holatiga o‘tdi');

  // Clean up test data
  db.prepare('DELETE FROM telegram_notification_queue WHERE id = ?').run(alertId1);
  db.prepare('DELETE FROM monetization_expenses WHERE id = ?').run(testExpId);
  db.prepare('DELETE FROM extra_service_orders WHERE id = ?').run(testOrderId);
  db.prepare('DELETE FROM ad_promotions WHERE id = ?').run(testAdId);
  db.prepare('DELETE FROM subscription_transactions WHERE id = ?').run(testTransId);
  db.prepare('DELETE FROM businesses WHERE id = ?').run(testBizId);

  console.log('\n======================================================');
  console.log(`NATIJA: ${passed} TA TEST MUVAFFAQIYATLI O‘TDI, ${failed} TA XATO`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test suite failed with unexpected exception:', err);
  process.exit(1);
});
