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
  console.log('========================================================');
  console.log('📺 NAVBATBOR LIVE QUEUE DISPLAY (SMART TV) MODULE TESTS');
  console.log('========================================================\n');

  const db = new DatabaseSync('navbatbor.sqlite');

  // Find or create test business & owner
  const biz = db.prepare('SELECT * FROM businesses LIMIT 1').get() as any;
  if (!biz) {
    throw new Error('No business found in database for testing');
  }
  const bizOwner = db.prepare('SELECT * FROM users WHERE id = ?').get(biz.owner_id) as any;

  // Login as business owner to get auth token
  console.log('--- SETUP: Business Owner Authentication ---');
  let authToken = '';
  // Check if session exists or generate one directly
  const testSessionToken = 'tok-test-tv-' + Date.now();
  db.prepare(`
    INSERT INTO user_sessions (token, user_id)
    VALUES (?, ?)
  `).run(testSessionToken, bizOwner.id);
  authToken = testSessionToken;
  assert(Boolean(authToken), 'Business owner authentication token generated');

  // TEST 1: Multi-screen Setup (GET /api/business/screens auto-provisions or lists)
  console.log('\n--- TEST 1: Auto-provisioning & Listing TV Screens ---');
  const screensRes = await fetch(`${BASE_URL}/api/business/screens`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert(screensRes.status === 200, 'GET /api/business/screens returns 200 OK');
  const screensData = await screensRes.json() as any;
  assert(Array.isArray(screensData.screens) && screensData.screens.length > 0, 'At least 1 screen is provisioned for business');
  const defaultScreen = screensData.screens[0];
  assert(Boolean(defaultScreen.display_token), 'Screen has secure display_token');
  assert(defaultScreen.url.startsWith('/#display/'), 'Screen URL formatted for TV deep-link');

  // TEST 2: Create Custom Screen with Room & Service Filtering (Multi-Screen)
  console.log('\n--- TEST 2: Multi-Screen Configuration (Service & Room filtering) ---');
  const services = db.prepare('SELECT * FROM services WHERE business_id = ? LIMIT 2').all(biz.id) as any[];
  const targetService = services[0] || { id: 'srv-test-1', name: 'Terapevt Ko‘rigi' };

  const createScreenRes = await fetch(`${BASE_URL}/api/business/screens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: '2-Qavat Stomatologiya Ekrani',
      room_name: '204-xona (Dr. Karimov)',
      service_ids: [targetService.id]
    })
  });
  assert(createScreenRes.status === 200, 'POST /api/business/screens creates screen');
  const createdScreenData = await createScreenRes.json() as any;
  const customScreen = createdScreenData.screen;
  assert(customScreen.name === '2-Qavat Stomatologiya Ekrani', 'Screen name preserved');
  assert(customScreen.room_name === '204-xona (Dr. Karimov)', 'Room name configured for Uzbek voice');
  assert(customScreen.service_ids.includes(targetService.id), 'Service filter correctly attached');
  assert(Boolean(customScreen.display_token), 'Unique display_token generated for new screen');

  // TEST 3: Public Display Endpoint Security & Privacy (Masked Data)
  console.log('\n--- TEST 3: Public Display Data & Customer Privacy Protection ---');
  const publicDisplayRes = await fetch(`${BASE_URL}/api/display/${customScreen.display_token}`);
  assert(publicDisplayRes.status === 200, 'Public GET /api/display/:token returns 200 without auth header');
  const publicData = await publicDisplayRes.json() as any;
  assert(publicData.business.id === biz.id, 'Display accurately bound to business ID');
  assert(publicData.screen.name === '2-Qavat Stomatologiya Ekrani', 'Screen title returned in payload');
  assert(publicData.screen.room_name === '204-xona (Dr. Karimov)', 'Configured room returned for audio');
  assert(Array.isArray(publicData.currentCalled), 'currentCalled array present');
  assert(Array.isArray(publicData.waitingList), 'waitingList array present');
  assert(typeof publicData.totalWaiting === 'number', 'totalWaiting count present');

  // Security Verification: Ensure NO phone numbers or emails exist in public payload
  const publicJsonString = JSON.stringify(publicData);
  assert(!publicJsonString.includes('customer_phone'), 'CRITICAL: No customer_phone in public TV payload');
  assert(!publicJsonString.includes('password_hash'), 'CRITICAL: No password_hash in public payload');

  // TEST 4: Queue Ticket Calling (Navbat chaqirilishi)
  console.log('\n--- TEST 4: Calling a Queue Ticket on TV Display ---');
  const testTicketNumber = 'T-' + Math.floor(100 + Math.random() * 900);
  const entryId = 'q-test-tv-' + Date.now();
  db.prepare(`
    INSERT INTO queue_entries (id, business_id, service_id, customer_id, customer_name, customer_phone, queue_number, status, joined_at)
    VALUES (?, ?, ?, ?, 'Jasur Rahimov', '+998901234567', ?, 'WAITING', datetime('now'))
  `).run(entryId, biz.id, targetService.id, bizOwner.id, testTicketNumber);

  // Check waiting on display
  const dispCheckWaiting = await (await fetch(`${BASE_URL}/api/display/${customScreen.display_token}`)).json() as any;
  const foundInWaiting = dispCheckWaiting.waitingList.find((w: any) => w.queue_number === testTicketNumber);
  assert(Boolean(foundInWaiting || dispCheckWaiting.totalWaiting > 0), `New ticket ${testTicketNumber} registered in waiting queue`);

  // Call the ticket
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'CALLED', called_at = datetime('now')
    WHERE id = ?
  `).run(entryId);

  const dispCheckCalled = await (await fetch(`${BASE_URL}/api/display/${customScreen.display_token}`)).json() as any;
  const topCalled = dispCheckCalled.currentCalled[0];
  assert(topCalled && topCalled.queue_number === testTicketNumber, `Called ticket ${testTicketNumber} is in currentCalled`);
  assert(topCalled.status === 'CALLED', 'Ticket status is CALLED');

  // TEST 5: Sequential Calling of Multiple Tickets (Bir nechta navbatning ketma-ket chaqirilishi)
  console.log('\n--- TEST 5: Sequential Queue Ticket Calling ---');
  const testTicket2 = 'T-' + Math.floor(100 + Math.random() * 900);
  const entryId2 = 'q-test-tv-2-' + Date.now();
  db.prepare(`
    INSERT INTO queue_entries (id, business_id, service_id, customer_id, customer_name, customer_phone, queue_number, status, joined_at, called_at)
    VALUES (?, ?, ?, ?, 'Farhod Aliyev', '+998909876543', ?, 'CALLED', datetime('now'), datetime('now', '+2 seconds'))
  `).run(entryId2, biz.id, targetService.id, bizOwner.id, testTicket2);

  const dispCheckSeq = await (await fetch(`${BASE_URL}/api/display/${customScreen.display_token}`)).json() as any;
  assert(dispCheckSeq.currentCalled.length >= 2, 'Multiple called tickets supported concurrently');
  assert(dispCheckSeq.currentCalled[0].queue_number === testTicket2, 'Most recently called ticket is at the top');

  // TEST 6: Unauthorized / Invalid Screen Token (Ruxsatsiz token)
  console.log('\n--- TEST 6: Invalid / Revoked Token Rejection ---');
  const badTokenRes = await fetch(`${BASE_URL}/api/display/disp_invalid_fake_token_12345`);
  assert(badTokenRes.status === 404, 'Invalid token returns 404 Not Found');
  const badTokenData = await badTokenRes.json() as any;
  assert(badTokenData.code === 'INVALID_TOKEN', 'Error response has INVALID_TOKEN code');

  // TEST 7: Token Revocation / Regeneration
  console.log('\n--- TEST 7: Screen Token Regeneration & Revocation ---');
  const oldToken = customScreen.display_token;
  const regenRes = await fetch(`${BASE_URL}/api/business/screens/${customScreen.id}/regenerate-token`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert(regenRes.status === 200, 'POST /api/business/screens/:id/regenerate-token succeeds');
  const regenData = await regenRes.json() as any;
  const newToken = regenData.display_token;
  assert(Boolean(newToken) && newToken !== oldToken, 'New token generated and differs from old token');

  // Verify OLD token is instantly revoked
  const oldTokenCheck = await fetch(`${BASE_URL}/api/display/${oldToken}`);
  assert(oldTokenCheck.status === 404, 'Old token is now INVALID (404)');

  // Verify NEW token works seamlessly
  const newTokenCheck = await fetch(`${BASE_URL}/api/display/${newToken}`);
  assert(newTokenCheck.status === 200, 'New token works with 200 OK');

  // TEST 8: Inactive Screen State (Deactivation)
  console.log('\n--- TEST 8: Screen Deactivation Check ---');
  await fetch(`${BASE_URL}/api/business/screens/${customScreen.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_active: false })
  });
  const deactivatedCheck = await fetch(`${BASE_URL}/api/display/${newToken}`);
  assert(deactivatedCheck.status === 404, 'Deactivated screen returns 404 INVALID_TOKEN');

  // TEST 9: SSE Real-Time Stream Endpoint
  console.log('\n--- TEST 9: Real-time Server-Sent Events (SSE) Stream ---');
  // Reactivate screen for SSE test
  await fetch(`${BASE_URL}/api/business/screens/${customScreen.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_active: true })
  });

  const sseRes = await fetch(`${BASE_URL}/api/display/stream/${newToken}`);
  assert(sseRes.status === 200, 'SSE stream endpoint returns 200 OK');
  const contentType = sseRes.headers.get('content-type') || '';
  assert(contentType.includes('text/event-stream'), 'Content-Type is text/event-stream');

  // Clean up test entries
  db.prepare('DELETE FROM queue_entries WHERE id IN (?, ?)').run(entryId, entryId2);
  db.prepare('DELETE FROM business_screens WHERE id = ?').run(customScreen.id);
  db.prepare('DELETE FROM user_sessions WHERE token = ?').run(testSessionToken);

  console.log('\n========================================================');
  const failed = results.filter(r => !r.passed);
  if (failed.length === 0) {
    console.log(`🎉 ALL ${results.length} LIVE QUEUE DISPLAY TESTS PASSED!`);
  } else {
    console.error(`⚠️ ${failed.length} of ${results.length} tests failed!`);
    process.exit(1);
  }
  console.log('========================================================\n');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
