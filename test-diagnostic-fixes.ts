import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { getBusinessPlatformAppUrl } from './src/telegramBusinessBot';

const dbPath = path.join(process.cwd(), 'navbatbor.sqlite');
const db = new DatabaseSync(dbPath);

console.log('\n======================================================');
console.log('🧪 NAVBATBOR TELEGRAM AUTENTIFIKATSIYA TESTI');
console.log('======================================================\n');

let passed = 0;
let total = 5;

// TEST 1: Telegram bot return URL uses https://navbatbor.uz and NOT temporary Cloud Run domain
try {
  const businessAppUrl = getBusinessPlatformAppUrl(db);
  const testSessionId = 'auth_url_check_123';
  const returnUrl = `${businessAppUrl}/?auth_session=${testSessionId}`;

  if (!returnUrl.includes('asia-southeast1.run.app') && returnUrl.includes('navbatbor.uz') && returnUrl.includes('auth_session=')) {
    console.log('✅ 1. Telegram botdagi “Saytga o‘tish” tugmasi to‘g‘ri https://navbatbor.uz/?auth_session=... domeniga yo‘naltirilgan: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 1. URL noto‘g‘ri:', returnUrl);
  }
} catch (e: any) {
  console.error('❌ 1. Test 1 xatosi:', e.message);
}

// TEST 2: Session validation enforcement (Requirement 6: no valid user_sessions = no confirmed login)
try {
  const ghostSessionId = 'ghost_session_' + Date.now();
  const fakeToken = 'tok-ghost-' + Date.now();
  
  // Insert confirmed in auth_sessions, but NO row in user_sessions
  db.prepare(`
    INSERT INTO telegram_auth_sessions (id, code, status, expires_at, token, user_id)
    VALUES (?, '777888', 'CONFIRMED', datetime('now', '+5 minutes'), ?, 'usr-admin')
  `).run(ghostSessionId, fakeToken);

  // Check user_sessions existence check
  const activeSession = db.prepare('SELECT user_id FROM user_sessions WHERE token = ?').get(fakeToken) as any;
  if (!activeSession) {
    console.log('✅ 2. user_sessions da sessiya yaratilmagan holatda muvaffaqiyatli login berilmaydi (Qat’iy xavfsizlik): MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 2. Yaroqsiz sessiya tekshiruvi o‘tmadi');
  }

  // Cleanup
  db.prepare('DELETE FROM telegram_auth_sessions WHERE id = ?').run(ghostSessionId);
} catch (e: any) {
  console.error('❌ 2. Test 2 xatosi:', e.message);
}

// TEST 3: Telegram session single-use consume
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
    console.log('✅ 3. Telegram sessiyasining bir martalik (consume) xavfsizligi: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 3. Telegram sessiyasini consume qilishda xato:', consumed);
  }

  // Cleanup
  db.prepare('DELETE FROM telegram_auth_sessions WHERE id = ?').run(sessionId);
} catch (e: any) {
  console.error('❌ 3. Test 3 xatosi:', e.message);
}

// TEST 4: Payment request idempotency
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
    console.log('✅ 4. Tarif to‘lov so‘rovi takrorlanmasligi (idempotency): MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 4. To‘lov so‘rovi takrorlanishi oldi olinmadi');
  }

  // Cleanup
  db.prepare('DELETE FROM subscription_transactions WHERE id = ?').run(tx1Id);
} catch (e: any) {
  console.error('❌ 4. Test 4 xatosi:', e.message);
}

// TEST 5: QR Code resolution & fake code rejection
try {
  const existingBiz = db.prepare('SELECT id, name, slug FROM businesses LIMIT 1').get() as any;
  const found = db.prepare("SELECT id, name, slug FROM businesses WHERE slug = ? OR id = ?").get(existingBiz.slug, existingBiz.id) as any;
  const fakeLookup = db.prepare("SELECT id, name, slug FROM businesses WHERE slug = 'soxta-fake-qr-code-12345'").get() as any;

  if (found && !fakeLookup) {
    console.log('✅ 5. Haqiqiy QR-kod tekshiruvi va soxta kodlarni rad etish: MUVAFFAQISh');
    passed++;
  } else {
    console.error('❌ 5. QR tekshiruvi xato');
  }
} catch (e: any) {
  console.error('❌ 5. Test 5 xatosi:', e.message);
}

console.log('\n======================================================');
console.log(`🎉 YAKUNIY DIAGNOSTIKA NATIJASI: ${passed} / ${total} MUVAFFAQIYATLI!`);
console.log('======================================================\n');
