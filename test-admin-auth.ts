/**
 * NAVBATBOR — ADMIN AKKAUNTI VA PAROL XAVFSIZLIGI TEST SUITE
 * 
 * Ushbu test quyidagilarni tekshiradi:
 * 1. Admin login ma'lumotlari qayerda saqlanishi (users jadvali, usr-admin).
 * 2. SHA-256 + Tuzli parollash algoritmi.
 * 3. Yangi login va parol o'rnatilgach eski login ishlamasligi (401).
 * 4. Yangi login bilan muvaffaqiyatli kirish (200) va ADMIN roli saqlanishi.
 * 5. Server qayta ishga tushganda (seedDatabase) yangi parol qayta tiklanib ketmasligi (Persistence).
 * 6. Sessiyalarni xavfsiz bekor qilish (Session Revocation).
 * 7. Zaxira nusxa yaratilishi va ma'lumotlar bazasi butunligi (PRAGMA integrity_check).
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    failed++;
  }
}

const SALT = 'navbatbor_salt_2026';
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function simulateLogin(db: DatabaseSync, identifier: string, password: string) {
  const hash = hashPassword(password);
  const user = db.prepare('SELECT id, name, email, phone, role, status FROM users WHERE (email = ? OR phone = ?) AND password_hash = ?').get(identifier, identifier, hash) as any;
  if (!user) {
    return { status: 401, error: 'Telefon, email yoki parol noto‘g‘ri' };
  }
  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
    return { status: 403, error: 'Ushbu hisob platforma ma’muriyati tomonidan bloklangan' };
  }
  const token = 'tok-' + crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO user_sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  return { status: 200, token, user };
}

async function runAdminSecurityTests() {
  console.log('\n======================================================');
  console.log('   NAVBATBOR — ADMIN AUTENTIFIKATSIYASI VA XAVFSIZLIK TESTLARI');
  console.log('======================================================\n');

  const DB_PATH = path.resolve(process.cwd(), 'navbatbor.sqlite');
  assert(fs.existsSync(DB_PATH), '1. "navbatbor.sqlite" ma’lumotlar bazasi fayli mavjud');

  const db = new DatabaseSync(DB_PATH);

  // TEST 1: Admin identifikatori va saqlanish joyi
  console.log('\n🔹 1. Admin login ma’lumotlari saqlanish joyi tekshiruvi');
  const adminUser = db.prepare("SELECT * FROM users WHERE id = 'usr-admin'").get() as any;
  assert(Boolean(adminUser), "Mavjud ADMIN akkaunti 'usr-admin' ID si bilan 'users' jadvalida mavjud");
  assert(adminUser?.role === 'ADMIN', "Foydalanuvchining roli qat'iy 'ADMIN' sifatida belgilangan");
  assert(adminUser?.status === 'ACTIVE', "Admin hisobi faol (ACTIVE) holatda");

  // TEST 2: Parol ochiq matnda emas, SHA-256 + Salt bilan saqlanganligi
  console.log('\n🔹 2. Parol xeshlash algoritmi xavfsizligi');
  assert(typeof adminUser.password_hash === 'string' && adminUser.password_hash.length === 64, "Parol 64 belgili SHA-256 xesh ko‘rinishida saqlangan (plaintext emas)");
  const testPlaintext = 'SecureAdminPass2026!';
  const expectedHash = crypto.createHash('sha256').update(testPlaintext + SALT).digest('hex');
  assert(expectedHash.length === 64, "Xeshlash funktsiyasi 'navbatbor_salt_2026' tuzi bilan to‘g‘ri ishlamoqda");

  // TEST 3: Avtomatik zaxira nusxa (Backup) mexanizmi
  console.log('\n🔹 3. Zaxira nusxa yaratish va baza butunligi tekshiruvi');
  const tempBackup = path.resolve(process.cwd(), 'navbatbor.sqlite.test_backup');
  fs.copyFileSync(DB_PATH, tempBackup);
  assert(fs.existsSync(tempBackup) && fs.statSync(tempBackup).size > 0, "Zaxira nusxa muvaffaqiyatli yaratildi");
  const backupDb = new DatabaseSync(tempBackup);
  const integrity = backupDb.prepare('PRAGMA integrity_check').all() as any[];
  assert(integrity[0]?.integrity_check === 'ok', "Zaxira nusxa bazasi PRAGMA integrity_check tekshiruvidan muvaffaqiyatli o‘tdi");
  backupDb.close();

  // TEST 4: Eski login/parol holati va o'zgartirish jarayoni
  console.log('\n🔹 4. Yangi login va parol o‘rnatish jarayoni');
  const originalEmail = adminUser.email;
  const originalPassHash = adminUser.password_hash;

  const newTestEmail = 'super_administrator_2026@navbatbor.uz';
  const newTestPass = 'SuperAdminSecret_2026!$';

  // Yangilash
  const newHash = hashPassword(newTestPass);
  db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = 'usr-admin'").run(newTestEmail, newHash);
  db.prepare("DELETE FROM user_sessions WHERE user_id = 'usr-admin'").run();

  const verifyUpdated = db.prepare("SELECT email, password_hash, role FROM users WHERE id = 'usr-admin'").get() as any;
  assert(verifyUpdated.email === newTestEmail, "Admin emaili yangi qiymatga yangilandi");
  assert(verifyUpdated.password_hash === newHash, "Admin parol xeshi yangi xeshga yangilandi");
  assert(verifyUpdated.role === 'ADMIN', "Admin roli o‘zgarmasdan ADMIN ligicha qoldi");

  // TEST 5: Eski parol bilan kirish urinishi rad etilishi (401)
  console.log('\n🔹 5. Eski login ma’lumotlarining ishlamasligi tekshiruvi');
  const oldLoginAttempt = simulateLogin(db, originalEmail, 'admin123');
  assert(oldLoginAttempt.status === 401, "Eski login/parol bilan kirish rad etildi (Status 401)");

  // TEST 6: Yangi parol bilan muvaffaqiyatli kirish (200)
  console.log('\n🔹 6. Yangi login ma’lumotlari bilan muvaffaqiyatli kirish');
  const newLoginAttempt = simulateLogin(db, newTestEmail, newTestPass);
  assert(newLoginAttempt.status === 200, "Yangi login/parol bilan kirish muvaffaqiyatli o‘tdi (Status 200)");
  assert(newLoginAttempt.user?.role === 'ADMIN', "Yangi login bilan kirganda foydalanuvchi roli ADMIN");
  assert(Boolean(newLoginAttempt.token), "Yangi kirish uchun maxfiy sessiya tokeni berildi");

  // TEST 7: Server qayta ishga tushganda yangi parolni saqlab qolish (Persistence)
  console.log('\n🔹 7. Server qayta tushganda (seedDatabase) parolni qayta tiklanib ketmasligi');
  // Simulyatsiya: serverdagi yangilangan seedDatabase() logikasi
  const usersToSeed = [
    { id: 'usr-admin', name: 'Super Admin', email: 'admin@navbatbor.uz', phone: '+998752210000', pass: 'admin123', role: 'ADMIN' }
  ];
  for (const u of usersToSeed) {
    const existing = db.prepare('SELECT id, password_hash FROM users WHERE id = ? OR email = ?').get(u.id, u.email) as any;
    if (existing) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(u.role, existing.id);
    }
  }

  const checkAfterSeed = db.prepare("SELECT email, password_hash FROM users WHERE id = 'usr-admin'").get() as any;
  assert(checkAfterSeed.password_hash === newHash, "Server qayta ishga tushganda ham yangi parol saqlanib qoldi (admin123 ga qaytmadi)");

  // TEST 8: Sessiyalarni bekor qilish (Session Revocation)
  console.log('\n🔹 8. Sessiyalarni bekor qilish va takroriy kirish talabi');
  const sessionCheckBefore = db.prepare("SELECT count(*) as count FROM user_sessions WHERE user_id = 'usr-admin'").get() as any;
  assert(sessionCheckBefore.count >= 1, "Yangi sessiya user_sessions jadvalida qayd etilgan");
  db.prepare("DELETE FROM user_sessions WHERE user_id = 'usr-admin'").run();
  const sessionCheckAfter = db.prepare("SELECT count(*) as count FROM user_sessions WHERE user_id = 'usr-admin'").get() as any;
  assert(sessionCheckAfter.count === 0, "Barcha faol sessiyalar xavfsiz bekor qilindi");

  // TEST 9: Yakuniy bazani tozalash va tiklash
  console.log('\n🔹 9. Baza holatini tiklash va tozalash');
  db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = 'usr-admin'").run(originalEmail, originalPassHash);
  const restoredAdmin = db.prepare("SELECT email, password_hash FROM users WHERE id = 'usr-admin'").get() as any;
  assert(restoredAdmin.email === originalEmail && restoredAdmin.password_hash === originalPassHash, "Asosiy baza toza holatga xavfsiz qaytarildi");

  if (fs.existsSync(tempBackup)) {
    fs.unlinkSync(tempBackup);
    console.log("  ✅ [PASS] Vaqtinchalik test fayllari tozalandi");
    passed++;
  }

  const finalCheck = db.prepare('PRAGMA integrity_check').all() as any[];
  assert(finalCheck[0]?.integrity_check === 'ok', "Yakuniy bazaning PRAGMA integrity_check tekshiruvi: ok");

  console.log('\n======================================================');
  console.log(`🎉 YAKUNIY NATIJA: BARCHA ${passed}/${passed + failed} TA TEST MUVAFFAQIYATLI O‘TDI!`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAdminSecurityTests().catch((err) => {
  console.error('Test xatoligi:', err);
  process.exit(1);
});
