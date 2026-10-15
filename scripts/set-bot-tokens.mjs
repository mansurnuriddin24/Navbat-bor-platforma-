#!/usr/bin/env node
/**
 * NAVBATBOR — TELEGRAM BOTLARI TOKENLARINI O'RNATISH VA TEKSHIRISH SKRIPTI
 * 
 * Foydalanish:
 *   node scripts/set-bot-tokens.mjs
 * yoki:
 *   node scripts/set-bot-tokens.mjs --customer-token <TOKEN_1> --business-token <TOKEN_2>
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ENV_PATH = path.resolve(process.cwd(), '.env');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--customer-token' || args[i] === '--client-token') {
      options.customerToken = args[++i];
    } else if (args[i] === '--business-token' || args[i] === '--biz-token') {
      options.businessToken = args[++i];
    }
  }
  return options;
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function verifyToken(token, botLabel) {
  if (!token || token.trim().length <= 10) {
    return { ok: false, error: 'Token kiritilmadi' };
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000)
    });
    const data = await resp.json();
    if (data.ok && data.result?.username) {
      return { ok: true, username: data.result.username, firstName: data.result.first_name };
    }
    return { ok: false, error: data.description || 'Noto‘g‘ri token' };
  } catch (err) {
    return { ok: false, error: 'Telegram serveriga ulanishda xatolik: ' + err.message };
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('  🤖 NAVBATBOR — TELEGRAM BOTLARINI ULASH');
  console.log('======================================================\n');
  console.log('Botlar Telegramdan xabar olishi uchun @BotFather tomonidan');
  console.log('berilgan HTTP API tokenlarni sozlash zarur.\n');

  const cliArgs = parseArgs();
  let customerToken = cliArgs.customerToken;
  let businessToken = cliArgs.businessToken;

  if (!customerToken) {
    console.log('1️⃣ MIJOZ BOTI (@Navbat1Uzb_bot) TOKENI:');
    customerToken = await prompt('   Tokenni kiriting (yoki o‘tkazib yuborish uchun Enter bosing): ');
  }

  if (!businessToken) {
    console.log('\n2️⃣ BIZNES BOSHQUV BOTI (@navbatbor_bizness_bot) TOKENI:');
    businessToken = await prompt('   Tokenni kiriting (yoki o‘tkazib yuborish uchun Enter bosing): ');
  }

  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';

  // 1. Mijoz boti
  if (customerToken && customerToken.trim().length > 10) {
    process.stdout.write('\n⏳ Mijoz boti tokeni tekshirilmoqda... ');
    const checkCust = await verifyToken(customerToken, 'Customer Bot');
    if (checkCust.ok) {
      console.log(`✅ Ulandi: @${checkCust.username} (${checkCust.firstName})`);
      if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
        envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN="${customerToken}"`);
      } else {
        envContent += `\nTELEGRAM_BOT_TOKEN="${customerToken}"`;
      }
    } else {
      console.log(`❌ Xatolik: ${checkCust.error}`);
    }
  }

  // 2. Biznes boti
  if (businessToken && businessToken.trim().length > 10) {
    process.stdout.write('⏳ Biznes boti tokeni tekshirilmoqda... ');
    const checkBiz = await verifyToken(businessToken, 'Business Bot');
    if (checkBiz.ok) {
      console.log(`✅ Ulandi: @${checkBiz.username} (${checkBiz.firstName})`);
      if (envContent.includes('BUSINESS_BOT_TOKEN=')) {
        envContent = envContent.replace(/BUSINESS_BOT_TOKEN=.*/, `BUSINESS_BOT_TOKEN="${businessToken}"`);
      } else {
        envContent += `\nBUSINESS_BOT_TOKEN="${businessToken}"`;
      }
      if (checkBiz.username) {
        if (envContent.includes('BUSINESS_BOT_USERNAME=')) {
          envContent = envContent.replace(/BUSINESS_BOT_USERNAME=.*/, `BUSINESS_BOT_USERNAME="${checkBiz.username}"`);
        }
      }
    } else {
      console.log(`❌ Xatolik: ${checkBiz.error}`);
    }
  }

  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
  console.log('\n📁 .env fayliga yangi tokenlar saqlandi.');
  console.log('🔄 O‘zgarishlar kuchga kirishi uchun serverni qayta ishga tushiring: npm start');
  console.log('======================================================\n');
}

run().catch(e => {
  console.error('Xatolik:', e.message);
  process.exit(1);
});
