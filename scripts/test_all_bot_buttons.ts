process.env.NODE_ENV = 'test';
process.env.BUSINESS_BOT_TOKEN = "8658895694:AAExamplMockBotTokenForAuditTests";
process.env.BUSINESS_BOT_USERNAME = "navbatbor_bizness_bot";
process.env.TELEGRAM_BOT_TOKEN = "8751009610:AAGCustomerMockTokenForAuditTests";

import { DatabaseSync } from 'node:sqlite';
import { 
  processBusinessBotUpdate 
} from '../src/telegramBusinessBot';
import {
  processTelegramUpdate
} from '../server';

const sentMessages: any[] = [];
const originalFetch = global.fetch;

(global as any).fetch = async (url: any, options: any = {}) => {
  const urlStr = String(url);
  if (urlStr.includes('api.telegram.org')) {
    let bodyObj: any = {};
    try {
      if (options.body) bodyObj = JSON.parse(options.body);
    } catch (e) {}
    sentMessages.push({
      url: urlStr,
      endpoint: urlStr.split('/bot')[1]?.split('/')[1] || urlStr,
      chat_id: bodyObj.chat_id,
      text: bodyObj.text,
      reply_markup: bodyObj.reply_markup
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: Math.floor(Math.random() * 100000) } })
    };
  }
  return originalFetch(url, options);
};

async function main() {
  const db = new DatabaseSync('navbatbor.sqlite');
  console.log('====================================================');
  console.log('🤖 TELEGRAM BOTS COMPLETE BUTTON AUDIT & SIMULATION');
  console.log('====================================================\n');

  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

  async function testBusinessMessage(testName: string, text: string, userId = '5564730141') {
    testCount++;
    sentMessages.length = 0;
    try {
      const updateId = Date.now() + Math.floor(Math.random() * 1000000);
      await processBusinessBotUpdate({
        update_id: updateId,
        message: {
          message_id: 2000 + testCount,
          chat: { id: Number(userId), type: 'private' },
          from: { id: Number(userId), first_name: 'Mansur', username: 'nuriddinov' },
          text
        }
      }, db);

      const lastReply = sentMessages[sentMessages.length - 1];
      if (!lastReply) {
        console.log(`❌ FAIL [${testName}]: No message sent in response to "${text}"`);
        failCount++;
        return;
      }

      if (lastReply.text && lastReply.text.includes('Ruxsat berilmagan') && !testName.includes('Unauthorized')) {
        console.log(`❌ FAIL [${testName}]: Unauthorized error returned: ${lastReply.text.slice(0, 100)}`);
        failCount++;
        return;
      }

      console.log(`✅ PASS [${testName}]: Responded with "${lastReply.text?.split('\n')[0]?.slice(0, 70)}"`);
      passCount++;
    } catch (err: any) {
      console.log(`❌ ERROR [${testName}]: ${err.message}`);
      failCount++;
    }
  }

  async function testBusinessCallback(testName: string, data: string, userId = '5564730141') {
    testCount++;
    sentMessages.length = 0;
    try {
      const updateId = Date.now() + Math.floor(Math.random() * 1000000);
      await processBusinessBotUpdate({
        update_id: updateId,
        callback_query: {
          id: 'cb_' + testCount,
          chat: { id: Number(userId), type: 'private' },
          from: { id: Number(userId), first_name: 'Mansur', username: 'nuriddinov' },
          message: {
            message_id: 3000 + testCount,
            chat: { id: Number(userId), type: 'private' }
          },
          data
        }
      }, db);

      const lastReply = sentMessages[sentMessages.length - 1];
      if (!lastReply) {
        console.log(`✅ PASS [${testName}]: Callback processed successfully`);
        passCount++;
        return;
      }

      if (lastReply.text && lastReply.text.includes('Ruxsat berilmagan') && !testName.includes('Unauthorized')) {
        console.log(`❌ FAIL [${testName}]: Unauthorized error returned for callback "${data}": ${lastReply.text.slice(0, 100)}`);
        failCount++;
        return;
      }

      console.log(`✅ PASS [${testName}]: Responded with "${lastReply.text?.split('\n')[0]?.slice(0, 70)}"`);
      passCount++;
    } catch (err: any) {
      console.log(`❌ ERROR [${testName}]: ${err.message}`);
      failCount++;
    }
  }

  async function testCustomerMessage(testName: string, text: string, userId = '777123456') {
    testCount++;
    sentMessages.length = 0;
    try {
      const updateId = Date.now() + Math.floor(Math.random() * 1000000);
      await processTelegramUpdate({
        update_id: updateId,
        message: {
          message_id: 4000 + testCount,
          chat: { id: Number(userId), type: 'private' },
          from: { id: Number(userId), first_name: 'Mijoz', username: 'mijoz_user' },
          text
        }
      });

      const lastReply = sentMessages[sentMessages.length - 1];
      if (!lastReply) {
        console.log(`❌ FAIL [${testName}]: No message sent in response to "${text}"`);
        failCount++;
        return;
      }

      console.log(`✅ PASS [${testName}]: Responded with "${lastReply.text?.split('\n')[0]?.slice(0, 70)}"`);
      passCount++;
    } catch (err: any) {
      console.log(`❌ ERROR [${testName}]: ${err.message}`);
      failCount++;
    }
  }

  async function testCustomerCallback(testName: string, data: string, userId = '777123456') {
    testCount++;
    sentMessages.length = 0;
    try {
      const updateId = Date.now() + Math.floor(Math.random() * 1000000);
      await processTelegramUpdate({
        update_id: updateId,
        callback_query: {
          id: 'cust_cb_' + testCount,
          chat: { id: Number(userId), type: 'private' },
          from: { id: Number(userId), first_name: 'Mijoz', username: 'mijoz_user' },
          message: {
            message_id: 5000 + testCount,
            chat: { id: Number(userId), type: 'private' }
          },
          data
        }
      });

      const lastReply = sentMessages[sentMessages.length - 1];
      if (!lastReply) {
        console.log(`✅ PASS [${testName}]: Callback acknowledged successfully`);
        passCount++;
        return;
      }

      console.log(`✅ PASS [${testName}]: Responded with "${lastReply.text?.split('\n')[0]?.slice(0, 70)}"`);
      passCount++;
    } catch (err: any) {
      console.log(`❌ ERROR [${testName}]: ${err.message}`);
      failCount++;
    }
  }

  // --- 1. BUSINESS BOT TESTS ---
  console.log('--- 1. BUSINESS BOT (@navbatbor_bizness_bot) ---');
  await testBusinessMessage('Biz: Start Command', '/start');
  await testBusinessMessage('Biz: Help Command', 'ℹ️ Yordam');
  await testBusinessMessage('Biz: Call Next Customer', '🟢 Keyingi mijozni chaqirish');
  await testBusinessMessage('Biz: Current Customer', '👤 Hozirgi mijoz');
  await testBusinessMessage('Biz: Live Queue Status', '📋 Jonli navbat');
  await testBusinessMessage('Biz: Today Bookings', '📅 Bugungi bronlar');
  await testBusinessMessage('Biz: Add Walk-in Customer', '➕ Tezkor mijoz qo‘shish (Walk-in)');
  await testBusinessMessage('Biz: Daily Report', '📊 Kunlik hisobot');
  await testBusinessMessage('Biz: Web Panel Link', '🌐 Web Panelga kirish');
  await testBusinessMessage('Biz: Staff List', '👥 Mutaxassislar');
  await testBusinessMessage('Biz: Working Hours', '⏰ Ish vaqti');
  await testBusinessMessage('Biz: Services List', '🩺 Xizmatlar');
  await testBusinessMessage('Biz: Notifications Settings', '🔔 Bildirishnomalar');
  await testBusinessMessage('Biz: Settings Panel', '⚙️ Sozlamalar');

  // Specialist Mode
  console.log('\n--- 2. SPECIALIST / STAFF BUTTONS ---');
  await testBusinessMessage('Biz: Enter Staff Code STF-1001', 'STF-1001');
  await testBusinessMessage('Specialist: Call Next Customer', '🟢 KEYINGI MIJOZIMNI CHAQIRISH');
  await testBusinessMessage('Specialist: Current Customer', '👤 Hozirgi mijozim');
  await testBusinessMessage('Specialist: My Queue', '📋 Mening navbatim');
  await testBusinessMessage('Specialist: Today Bookings', '📅 Bugungi bronlarim');
  await testBusinessMessage('Specialist: My Report', '📊 Mening hisobotim');

  // Business Callbacks
  console.log('\n--- 3. BUSINESS BOT INLINE ACTIONS ---');
  await testBusinessCallback('Biz: Refresh Dashboard', 'biz_refresh_dash_biz-nasaf-dental');
  await testBusinessCallback('Biz: Open Queue', 'biz_open_queue_biz-nasaf-dental');
  await testBusinessCallback('Biz: Call Next Callback', 'biz_call_next_biz-nasaf-dental');

  const entry = db.prepare("SELECT id FROM queue_entries WHERE business_id = 'biz-nasaf-dental' LIMIT 1").get() as any;
  if (entry) {
    await testBusinessCallback('Biz: Recall Callback', `biz_recall_${entry.id}`);
    await testBusinessCallback('Biz: Serve Callback', `biz_q_serve_${entry.id}`);
    await testBusinessCallback('Biz: Complete Callback', `biz_q_complete_${entry.id}`);
  }

  // Guest Flow
  console.log('\n--- 4. GUEST FLOW ---');
  const guestTgId = '999888777';
  await testBusinessMessage('Guest: Start', '/start', guestTgId);
  await testBusinessMessage('Guest: Register Business', '📝 Biznesni ro‘yxatdan o‘tkazish', guestTgId);
  await testBusinessMessage('Guest: Check Status', 'ℹ️ Ariza holatini tekshirish', guestTgId);
  await testBusinessMessage('Guest: Help', 'ℹ️ Yordam / Qo‘llanma', guestTgId);

  // --- 5. CUSTOMER BOT TESTS ---
  console.log('\n--- 5. CUSTOMER BOT (@Navbat1Uzb_bot) ---');
  await testCustomerMessage('Cust: Start Command', '/start');
  await testCustomerMessage('Cust: Live Queue Info', '📋 Jonli navbatim');
  await testCustomerMessage('Cust: My Bookings', '📅 Bronlarim');
  await testCustomerMessage('Cust: Search Categories', '🔍 Qidiruv');
  await testCustomerMessage('Cust: Tariffs Info', '⚡️ Tariflar');
  await testCustomerMessage('Cust: Help', '🆘 Yordam');

  // --- 6. CUSTOMER BOT INLINE ACTIONS ---
  console.log('\n--- 6. CUSTOMER BOT INLINE ACTIONS ---');
  await testCustomerCallback('Cust: Category View', 'cat_cat-medical');
  await testCustomerCallback('Cust: Business Queue Info', 'q_biz_biz-nasaf-dental');
  await testCustomerCallback('Cust: Search Categories Callback', 'search_categories');
  await testCustomerCallback('Cust: Check Queue Callback', 'check_queue');
  await testCustomerCallback('Cust: Check Bookings Callback', 'check_bookings');
  await testCustomerCallback('Cust: View Tariffs Callback', 'view_tariffs');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${testCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('====================================================');
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
