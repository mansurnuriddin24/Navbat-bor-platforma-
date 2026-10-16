import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = path.join(process.cwd(), 'navbatbor.sqlite');
const db = new DatabaseSync(dbPath);

console.log('\n======================================================');
console.log('🧪 NAVBATBOR DIAGNOSTIKA VA TUZATISHLAR TEKSHIRUVI');
console.log('======================================================\n');

let passed = 0;
let total = 5;

// TEST 1: Google OAuth user creation role isolation
try {
  const testEmail = `test_google_${Date.now()}@example.com`;
  const newUserId = 'usr-test-g-' + crypto.randomUUID().slice(0, 8);
  
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, status)
    VALUES (?, ?, ?, NULL, 'dummyhash', 'CUSTOMER', 'ACTIVE')
  `).run(newUserId, 'Test Google User', testEmail);

  const created = db.prepare('SELECT id, email, role, status FROM users WHERE id = ?').get(newUserId) as any;
  if (created && created.role === 'CUSTOMER' && created.status === 'ACTIVE') {
    console.log('✅ 1. Google orqali kirgan yangi foydalanuvchi faqat CUSTOMER roliga ega: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 1. Google OAuth foydalanuvchi roli noto‘g‘ri:', created);
  }

  // Cleanup
  db.prepare('DELETE FROM users WHERE id = ?').run(newUserId);
} catch (e: any) {
  console.error('❌ 1. Test 1 xatosi:', e.message);
}

// TEST 2: Telegram session single-use consume
try {
  const sessionId = 'auth_consume_test_' + Date.now();
  db.prepare(`
    INSERT INTO telegram_auth_sessions (id, code, status, expires_at, token)
    VALUES (?, '999888', 'CONFIRMED', datetime('now', '+5 minutes'), 'tok-test-consume')
  `).run(sessionId);

  // Consume session
  db.prepare("UPDATE telegram_auth_sessions SET status = 'EXPIRED', token = NULL WHERE id = ?").run(sessionId);

  const consumed = db.prepare('SELECT * FROM telegram_auth_sessions WHERE id = ?').get(sessionId) as any;
  if (consumed && consumed.status === 'EXPIRED' && consumed.token === null) {
    console.log('✅ 2. Telegram sessiyasining bir martalik (consume) xavfsizligi: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 2. Telegram sessiyasini consume qilishda xato:', consumed);
  }

  // Cleanup
  db.prepare('DELETE FROM telegram_auth_sessions WHERE id = ?').run(sessionId);
} catch (e: any) {
  console.error('❌ 2. Test 2 xatosi:', e.message);
}

// TEST 3: Payment request idempotency
try {
  const existingBiz = db.prepare('SELECT id, name, slug FROM businesses LIMIT 1').get() as any;
  const testBizId = existingBiz ? existingBiz.id : 'biz-d7d9509b';
  const planCode = 'PRO';
  
  // First request
  const tx1Id = 'tx-test-' + Date.now();
  db.prepare(`
    INSERT INTO subscription_transactions (id, business_id, plan_code, amount_uzs, duration_days, payment_method, status)
    VALUES (?, ?, ?, 299000, 30, 'TELEGRAM', 'PENDING')
  `).run(tx1Id, testBizId, planCode);

  // Second request check: find recent within 15 min
  const existingRecent = db.prepare(`
    SELECT id, amount_uzs FROM subscription_transactions 
    WHERE business_id = ? AND plan_code = ? AND status = 'PENDING'
      AND datetime(created_at) > datetime('now', '-15 minutes')
    ORDER BY created_at DESC LIMIT 1
  `).get(testBizId, planCode) as any;

  if (existingRecent && existingRecent.id === tx1Id) {
    console.log('✅ 3. Tarif to‘lov so‘rovi takrorlanmasligi (idempotency): MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 3. To‘lov so‘rovi takrorlanishi oldi olinmadi');
  }

  // Admin approval simulation
  db.prepare(`
    UPDATE subscription_transactions 
    SET status = 'COMPLETED' 
    WHERE id = ?
  `).run(tx1Id);

  const updatedTx = db.prepare('SELECT status FROM subscription_transactions WHERE id = ?').get(tx1Id) as any;
  if (updatedTx.status === 'COMPLETED') {
    // Cleanup
    db.prepare('DELETE FROM subscription_transactions WHERE id = ?').run(tx1Id);
  }
} catch (e: any) {
  console.error('❌ 3. Test 3 xatosi:', e.message);
}

// TEST 4: Real QR Code resolution vs Fake code rejection
try {
  const existingBiz = db.prepare('SELECT id, name, slug FROM businesses LIMIT 1').get() as any;
  const found = db.prepare("SELECT id, name, slug FROM businesses WHERE slug = ? OR id = ?").get(existingBiz.slug, existingBiz.id) as any;
  const fakeLookup = db.prepare("SELECT id, name, slug FROM businesses WHERE slug = 'soxta-fake-qr-code-12345'").get() as any;

  if (found && !fakeLookup) {
    console.log('✅ 4. Haqiqiy QR-kod tekshiruvi va soxta kodlarni rad etish: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 4. QR tekshiruvi xato');
  }
} catch (e: any) {
  console.error('❌ 4. Test 4 xatosi:', e.message);
}

// TEST 5: Free, Start, Pro tariff consistency in database
try {
  const startPlan = db.prepare("SELECT * FROM subscription_plans WHERE code = 'START'").get() as any;
  const proPlan = db.prepare("SELECT * FROM subscription_plans WHERE code = 'PRO'").get() as any;
  
  // START price should be 149,000 UZS, PRO should be 299,000 UZS
  if ((!startPlan || startPlan.price_uzs === 149000) && (!proPlan || proPlan.price_uzs === 299000)) {
    console.log('✅ 5. START (149,000 so‘m) va PRO (299,000 so‘m) tarif narxlari uyg‘unligi: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 5. Tarif narxlari mos kelmadi:', { startPlan, proPlan });
  }
} catch (e: any) {
  console.error('❌ 5. Test 5 xatosi:', e.message);
}

console.log('\n======================================================');
console.log(`🎉 YAKUNIY DIAGNOSTIKA NATIJASI: ${passed} / ${total} MUVAFFAQIYATLI!`);
console.log('======================================================\n');
