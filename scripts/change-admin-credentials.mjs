#!/usr/bin/env node
/**
 * NAVBATBOR — ADMIN AKKAUNTI LOGIN VA PAROLINI XAVFSIZ ALMASHTIRISH SKRIPTI
 * 
 * Foydalanish:
 * 1. Interaktiv rejim:
 *    node scripts/change-admin-credentials.mjs
 * 
 * 2. Buyruqlar qatori orqali:
 *    node scripts/change-admin-credentials.mjs --email yangi_admin@navbatbor.uz --password YangiMaxfiyParol2026!
 *    (Ixtiyoriy telefon bilan: --phone +998901234567)
 * 
 * Xavfsizlik xususiyatlari:
 * - O'zgarishdan oldin bazaning avtomatik vaqt tamg'ali zaxira nusxasini (backup) yaratadi
 * - Parolni SHA-256 va maxfiy tuz (salt) bilan xeshlaydi, ochiq matnda saqlamaydi
 * - Eski faol sessiyalarni bekor qiladi (invalidation)
 * - Parolni loglarga yoki ekranga chiqarmaydi
 * - Baza butunligini (integrity_check) tekshiradi
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DB_PATH = path.resolve(process.cwd(), 'navbatbor.sqlite');
const SALT = 'navbatbor_salt_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' || args[i] === '--login') {
      options.email = args[++i];
    } else if (args[i] === '--password' || args[i] === '--pass') {
      options.password = args[++i];
    } else if (args[i] === '--phone') {
      options.phone = args[++i];
    }
  }
  return options;
}

function prompt(question, isPassword = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (isPassword) {
      // Mute password output in terminal
      process.stdout.write(question);
      let pass = '';
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', function onData(char) {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode?.(false);
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            rl.close();
            resolve(pass);
            break;
          case '\u0003':
            process.exit(1);
            break;
          case '\u0008':
          case '\x7f':
            if (pass.length > 0) {
              pass = pass.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            pass += char;
            process.stdout.write('*');
            break;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function run() {
  console.log('\n======================================================');
  console.log('  🛡 NAVBATBOR — ADMIN AKKAUNTINI XAVFSIZ YANGILASH');
  console.log('======================================================\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Xatolik: Baza fayli topilmadi: ${DB_PATH}`);
    process.exit(1);
  }

  // 1. ZAXIRA NUSXA YARATISH (AUTOMATIC BACKUP)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(process.cwd(), `navbatbor.sqlite.backup_${timestamp}`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Avtomatik zaxira nusxasi yaratildi:`);
  console.log(`   📁 ${backupPath} (${fs.statSync(backupPath).size} bayt)\n`);

  const db = new DatabaseSync(DB_PATH);

  // Bazaning hozirgi butunligini tekshirish
  const preCheck = db.prepare('PRAGMA integrity_check').all();
  if (!preCheck || preCheck[0]?.integrity_check !== 'ok') {
    console.error('❌ Baza yaxlitligida xatolik bor, o‘zgarish to‘xtatildi.');
    process.exit(1);
  }

  // Mavjud ADMIN akkauntini olish
  const currentAdmin = db.prepare("SELECT * FROM users WHERE id = 'usr-admin'").get();
  if (!currentAdmin) {
    console.error("❌ Xatolik: 'usr-admin' foydalanuvchisi bazada topilmadi!");
    process.exit(1);
  }

  console.log(`ℹ️ Joriy ADMIN akkaunti ma’lumotlari:`);
  console.log(`   - ID: ${currentAdmin.id}`);
  console.log(`   - Ism: ${currentAdmin.name}`);
  console.log(`   - Joriy Email/Login: ${currentAdmin.email}`);
  console.log(`   - Joriy Telefon: ${currentAdmin.phone || "yo'q"}`);
  console.log(`   - Roli: ${currentAdmin.role} (Status: ${currentAdmin.status})\n`);

  // Ma'lumotlarni olish (CLI argumentlari yoki interaktiv savollar)
  const cliArgs = parseArgs();
  let newEmail = cliArgs.email;
  let newPassword = cliArgs.password;
  let newPhone = cliArgs.phone;

  if (!newEmail && !newPassword) {
    console.log('📝 Iltimos, yangi admin ma’lumotlarini kiriting (bo‘sh qoldirilsa joriy qiymat saqlanadi):\n');
    newEmail = await prompt(`Yangi Email/Login [Joriy: ${currentAdmin.email}]: `);
    if (!newEmail) newEmail = currentAdmin.email;

    newPhone = await prompt(`Yangi Telefon raqami [Joriy: ${currentAdmin.phone || 'mavjud emas'}]: `);
    if (!newPhone) newPhone = currentAdmin.phone;

    newPassword = await prompt(`Yangi Parol (kamida 8 ta belgi): `, true);
  }

  if (!newEmail) {
    newEmail = currentAdmin.email;
  }

  // Parol validatsiyasi
  if (newPassword) {
    if (newPassword.length < 8) {
      console.error('\n❌ Xatolik: Xavfsizlik talablariga ko‘ra yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak!');
      process.exit(1);
    }
  }

  // Email format validatsiyasi
  if (newEmail && !newEmail.includes('@') && !newEmail.startsWith('+')) {
    console.warn(`⚠️ Ogohlantirish: "${newEmail}" email yoki xalqaro telefon formatiga to‘liq mos kelmasligi mumkin.`);
  }

  // 2. YANGILASHNI AMALGA OSHIRISH (ATOMIC UPDATE)
  const updates = [];
  const params = [];

  if (newEmail && newEmail !== currentAdmin.email) {
    // Boshqa foydalanuvchida bu email yo'qligini tekshirish
    const duplicate = db.prepare("SELECT id FROM users WHERE email = ? AND id != 'usr-admin'").get(newEmail);
    if (duplicate) {
      console.error(`❌ Xatolik: Ushbu email (${newEmail}) boshqa foydalanuvchiga biriktirilgan!`);
      process.exit(1);
    }
    updates.push('email = ?');
    params.push(newEmail.trim());
  }

  if (newPhone !== undefined && newPhone !== currentAdmin.phone) {
    updates.push('phone = ?');
    params.push(newPhone ? newPhone.trim() : null);
  }

  if (newPassword) {
    const newHash = hashPassword(newPassword);
    updates.push('password_hash = ?');
    params.push(newHash);
  }

  if (updates.length === 0) {
    console.log('\nℹ️ Hech qanday ma’lumot o‘zgartirilmadi.');
    process.exit(0);
  }

  params.push('usr-admin');
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // 3. ESKI FAOL SESSIYALARNI BEKOR QILISH (SESSION REVOCATION)
  const revoked = db.prepare("DELETE FROM user_sessions WHERE user_id = 'usr-admin'").run();

  // 4. AUDIT LOG YOZISH (PAROLSIZ)
  try {
    const auditId = 'aud-' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_email, action, resource_type, resource_id, details)
      VALUES (?, 'usr-admin', ?, 'ADMIN_CREDENTIALS_UPDATED', 'USER', 'usr-admin', ?)
    `).run(
      auditId,
      newEmail || currentAdmin.email,
      JSON.stringify({
        emailChanged: Boolean(newEmail && newEmail !== currentAdmin.email),
        phoneChanged: Boolean(newPhone && newPhone !== currentAdmin.phone),
        passwordChanged: Boolean(newPassword),
        sessionsRevoked: revoked.changes,
        updatedAt: new Date().toISOString()
      })
    );
  } catch (e) {
    // Audit log optional
  }

  // 5. TEKSHIRUV VA INTEGRITY CHECK
  const postCheck = db.prepare('PRAGMA integrity_check').all();
  if (!postCheck || postCheck[0]?.integrity_check !== 'ok') {
    console.error('❌ Baza yaxlitligi buzildi! Zaxiradan qayta tiklanmoqda...');
    fs.copyFileSync(backupPath, DB_PATH);
    console.log('🔄 Baza zaxira nusxadan tiklandi.');
    process.exit(1);
  }

  const updatedAdmin = db.prepare("SELECT id, name, email, phone, role, status FROM users WHERE id = 'usr-admin'").get();

  console.log('\n🎉 TABRIKLAYMIZ! ADMIN AKKAUNTI MUVAFFAQIYATLI YANGILANDI!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 Ism:         ${updatedAdmin.name}`);
  console.log(`📧 Yangi Login: ${updatedAdmin.email}`);
  console.log(`📱 Yangi Tel:   ${updatedAdmin.phone || 'kiritilmagan'}`);
  console.log(`🛡 Roli:        ${updatedAdmin.role} (Status: ${updatedAdmin.status})`);
  console.log(`🔒 Parol:       Xavfsiz SHA-256 + Tuz bilan saqlandi (Uzunligi: ${newPassword ? newPassword.length : 'O‘zgarmadi'})`);
  console.log(`🚪 Sessiyalar:  ${revoked.changes} ta eski faol sessiya bekor qilindi`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 Eslatma: Yangi login ma’lumotlari orqali saytning "/api/auth/login" orqali');
  console.log('   yoki administrator paneliga kirishingiz mumkin.\n');
}

run().catch((err) => {
  console.error('\n❌ Xatolik yuz berdi:', err.message);
  process.exit(1);
});
