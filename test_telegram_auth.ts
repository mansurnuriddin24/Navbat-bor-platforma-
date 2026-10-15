import { DatabaseSync } from 'node:sqlite';

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  results.push({
    name,
    passed: !!condition,
    details
  });
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name} ${details ? `(${details})` : ''}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🤖 NAVBATBOR TELEGRAM CUSTOMER AUTHENTICATION TESTS');
  console.log('====================================================\n');

  const db = new DatabaseSync('navbatbor.sqlite');

  // TEST 1: Check Bot Info Endpoint
  console.log('--- TEST 1: /api/telegram/bot-info endpoint & @Navbat1Uzb_bot reference ---');
  const botInfoRes = await fetch(`${BASE_URL}/api/telegram/bot-info`);
  const botInfo = await botInfoRes.json() as any;
  assert(botInfoRes.status === 200, 'Bot info returns 200 OK');
  assert(botInfo.botUsername === 'Navbat1Uzb_bot', 'Bot username is Navbat1Uzb_bot', `Got: ${botInfo.botUsername}`);
  assert(botInfo.botUrl === 'https://t.me/Navbat1Uzb_bot', 'Bot URL points to https://t.me/Navbat1Uzb_bot', `Got: ${botInfo.botUrl}`);
  assert(botInfo.isConfigured === true, 'Bot is configured with real token');

  // TEST 2: Website Initiates Telegram Auth Session
  console.log('\n--- TEST 2: Website generates short-lived, single-use auth session ---');
  const sessionRes = await fetch(`${BASE_URL}/api/auth/telegram-session`, { method: 'POST' });
  assert(sessionRes.status === 200, 'POST /api/auth/telegram-session returns 200');
  const sessionData = await sessionRes.json() as any;
  assert(typeof sessionData.sessionId === 'string' && sessionData.sessionId.startsWith('auth_'), 'Session ID starts with auth_');
  assert(typeof sessionData.code === 'string' && /^\d{6}$/.test(sessionData.code), 'Generated 6-digit confirmation code');
  assert(sessionData.botUsername === 'Navbat1Uzb_bot', 'Session references @Navbat1Uzb_bot');
  assert(sessionData.deepLink === `https://t.me/Navbat1Uzb_bot?start=${sessionData.sessionId}`, 'Deep link correctly targets @Navbat1Uzb_bot with sessionId');
  assert(sessionData.tgDirect === `tg://resolve?domain=Navbat1Uzb_bot&start=${sessionData.sessionId}`, 'Native tgDirect link formatted properly');

  // Check TTL in DB is <= 5 minutes
  const dbSession = db.prepare('SELECT * FROM telegram_auth_sessions WHERE id = ?').get(sessionData.sessionId) as any;
  assert(dbSession && dbSession.status === 'PENDING', 'Session saved in DB with PENDING status');
  const expiryDiffMinutes = (new Date(dbSession.expires_at).getTime() - new Date(dbSession.created_at).getTime()) / (60 * 1000);
  assert(expiryDiffMinutes <= 6, 'Short-lived token TTL is 5 minutes', `Got diff: ${expiryDiffMinutes} mins`);

  // TEST 3: Website Polling while Pending
  console.log('\n--- TEST 3: Website polls session status while waiting ---');
  const pollRes1 = await fetch(`${BASE_URL}/api/auth/telegram-session/${sessionData.sessionId}`);
  const pollData1 = await pollRes1.json() as any;
  assert(pollRes1.status === 200, 'Polling returns 200');
  assert(pollData1.status === 'PENDING', 'Polling returns PENDING status before bot interaction');

  // TEST 4: Customer Clicks START in Telegram Bot (@Navbat1Uzb_bot)
  console.log('\n--- TEST 4: Customer clicks START in Telegram Bot (Deep Link /start auth_...) ---');
  const testTgUserId = 88991122;
  const testChatId = '88991122';
  const testFirstName = 'Temur';
  const testLastName = 'Normurodov';
  const testUsername = 'temur_norm';

  // Count existing users before registration
  const userCountBefore = (db.prepare('SELECT count(*) as c FROM users WHERE telegram_chat_id = ?').get(testChatId) as any).c;

  // Simulate Telegram Bot receiving /start from deep link via webhook / processor
  const baseUpdateId = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 900);
  const webhookRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: baseUpdateId + 1,
      message: {
        message_id: 101,
        from: {
          id: testTgUserId,
          is_bot: false,
          first_name: testFirstName,
          last_name: testLastName,
          username: testUsername
        },
        chat: {
          id: testTgUserId,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: `/start ${sessionData.sessionId}`
      }
    })
  });
  assert(webhookRes.status === 200, 'Webhook accepted update with 200 OK');

  // Verify DB session is now CONFIRMED
  const confirmedDbSession = db.prepare('SELECT * FROM telegram_auth_sessions WHERE id = ?').get(sessionData.sessionId) as any;
  assert(confirmedDbSession.status === 'CONFIRMED', 'Session status updated to CONFIRMED');
  assert(typeof confirmedDbSession.token === 'string' && confirmedDbSession.token.startsWith('tok-'), 'Session token generated and linked');
  assert(typeof confirmedDbSession.user_id === 'string', 'Session linked to created/found user ID');

  // Verify customer was created in users table with role CUSTOMER
  const createdCustomer = db.prepare('SELECT * FROM users WHERE id = ?').get(confirmedDbSession.user_id) as any;
  assert(createdCustomer && createdCustomer.role === 'CUSTOMER', 'New account created with role CUSTOMER');
  assert(createdCustomer.telegram_chat_id === testChatId, 'User has correct telegram_chat_id');
  assert(createdCustomer.telegram_user_id === String(testTgUserId), 'User has correct telegram_user_id');
  assert(createdCustomer.name.includes('Temur'), 'User full name saved correctly');

  // TEST 5: Website Polling picks up CONFIRMED state & establishes session
  console.log('\n--- TEST 5: Website polling completes login and receives user session ---');
  const pollRes2 = await fetch(`${BASE_URL}/api/auth/telegram-session/${sessionData.sessionId}`);
  const pollData2 = await pollRes2.json() as any;
  assert(pollData2.status === 'CONFIRMED', 'Website polling returns CONFIRMED');
  assert(typeof pollData2.token === 'string', 'Website receives valid session token');
  assert(pollData2.user && pollData2.user.id === createdCustomer.id, 'Website receives authenticated user payload');

  // Verify token authenticates the user on /api/auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${pollData2.token}` }
  });
  assert(meRes.status === 200, 'Bearer token is accepted on /api/auth/me');
  const meData = await meRes.json() as any;
  assert(meData.user.id === createdCustomer.id, 'Authenticated identity matches Telegram customer');

  // TEST 6: Single-use Consumption of Auth Token
  console.log('\n--- TEST 6: Single-use token consumption ---');
  const consumeRes = await fetch(`${BASE_URL}/api/auth/telegram-session/${sessionData.sessionId}/consume`, { method: 'POST' });
  assert(consumeRes.status === 200, 'Session consume endpoint returns 200');

  const pollRes3 = await fetch(`${BASE_URL}/api/auth/telegram-session/${sessionData.sessionId}`);
  const pollData3 = await pollRes3.json() as any;
  assert(pollData3.status === 'EXPIRED', 'Session is marked EXPIRED after consumption (cannot be reused)');

  // TEST 7: Returning Customer Login (Prevent duplicate accounts)
  console.log('\n--- TEST 7: Existing customer logging in again (no duplicate account) ---');
  const sessionRes2 = await fetch(`${BASE_URL}/api/auth/telegram-session`, { method: 'POST' });
  const sessionData2 = await sessionRes2.json() as any;

  const usersCountBeforeReturning = (db.prepare('SELECT count(*) as c FROM users WHERE telegram_chat_id = ?').get(testChatId) as any).c;

  // Returning user sends /start
  await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: baseUpdateId + 2,
      message: {
        message_id: 102,
        from: {
          id: testTgUserId,
          is_bot: false,
          first_name: testFirstName,
          last_name: testLastName,
          username: testUsername
        },
        chat: { id: testTgUserId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: `/start ${sessionData2.sessionId}`
      }
    })
  });

  const usersCountAfterReturning = (db.prepare('SELECT count(*) as c FROM users WHERE telegram_chat_id = ?').get(testChatId) as any).c;
  assert(usersCountBeforeReturning === usersCountAfterReturning, 'No duplicate user created for returning customer');

  const pollResReturning = await fetch(`${BASE_URL}/api/auth/telegram-session/${sessionData2.sessionId}`);
  const pollDataReturning = await pollResReturning.json() as any;
  assert(pollDataReturning.status === 'CONFIRMED', 'Returning customer session is CONFIRMED');
  assert(pollDataReturning.user.id === createdCustomer.id, 'Authenticated user matches existing user ID');

  // TEST 8: 6-Digit Code Verification Flow
  console.log('\n--- TEST 8: 6-digit verification code sent directly to bot ---');
  const sessionRes3 = await fetch(`${BASE_URL}/api/auth/telegram-session`, { method: 'POST' });
  const sessionData3 = await sessionRes3.json() as any;

  await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: baseUpdateId + 3,
      message: {
        message_id: 103,
        from: {
          id: testTgUserId,
          is_bot: false,
          first_name: testFirstName,
          last_name: testLastName,
          username: testUsername
        },
        chat: { id: testTgUserId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: sessionData3.code
      }
    })
  });

  const pollResCode = await fetch(`${BASE_URL}/api/auth/telegram-session/${sessionData3.sessionId}`);
  const pollDataCode = await pollResCode.json() as any;
  assert(pollDataCode.status === 'CONFIRMED', 'Session confirmed via 6-digit code');

  // TEST 9: Expired Token Handling
  console.log('\n--- TEST 9: Expired token rejection ---');
  const expiredSessionId = 'auth_expired_test_' + Date.now();
  const expiredDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
  db.prepare(`
    INSERT OR REPLACE INTO telegram_auth_sessions (id, code, status, expires_at)
    VALUES (?, '999888', 'PENDING', ?)
  `).run(expiredSessionId, expiredDate);

  // Poll expired session
  const pollExpired = await fetch(`${BASE_URL}/api/auth/telegram-session/${expiredSessionId}`);
  const pollExpiredData = await pollExpired.json() as any;
  assert(pollExpiredData.status === 'EXPIRED', 'Expired session returns EXPIRED status');

  // Attempting /start with expired session
  await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: baseUpdateId + 4,
      message: {
        message_id: 104,
        from: { id: testTgUserId, is_bot: false, first_name: 'Test' },
        chat: { id: testTgUserId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: `/start ${expiredSessionId}`
      }
    })
  });

  const checkExpiredAfterStart = db.prepare('SELECT status FROM telegram_auth_sessions WHERE id = ?').get(expiredSessionId) as any;
  assert(checkExpiredAfterStart.status === 'EXPIRED', 'Expired session remains EXPIRED and does not authenticate');

  // Cleanup test data
  try {
    db.prepare('DELETE FROM telegram_auth_sessions WHERE id LIKE "auth_%"').run();
    db.prepare('DELETE FROM users WHERE telegram_chat_id = ?').run(testChatId);
  } catch (e) {}

  console.log('\n====================================================');
  const failed = results.filter(r => !r.passed);
  if (failed.length === 0) {
    console.log(`🎉 ALL ${results.length} TELEGRAM AUTHENTICATION TESTS PASSED!`);
  } else {
    console.error(`⚠️ ${failed.length} of ${results.length} tests failed!`);
    process.exit(1);
  }
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
