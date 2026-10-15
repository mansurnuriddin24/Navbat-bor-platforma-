import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('navbatbor.sqlite');

db.exec('PRAGMA foreign_keys = OFF;');

// 1. Remove leftover test businesses created during test runs
const testBizs = db.prepare("SELECT id FROM businesses WHERE name LIKE 'Klinika Test%' OR id LIKE 'test-biz-%'").all();
console.log('Found test businesses to clean:', testBizs.length);

for (const b of testBizs) {
  db.prepare('DELETE FROM queue_entries WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM bookings WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM staff_services WHERE staff_id IN (SELECT id FROM staff WHERE business_id = ?)').run(b.id);
  db.prepare('DELETE FROM staff_hours WHERE staff_id IN (SELECT id FROM staff WHERE business_id = ?)').run(b.id);
  db.prepare('DELETE FROM staff WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM services WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM business_hours WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM business_memberships WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM subscription_transactions WHERE business_id = ?').run(b.id);
  db.prepare('DELETE FROM businesses WHERE id = ?').run(b.id);
}

// 2. Clean up test users created by test runs
db.prepare("DELETE FROM users WHERE id LIKE 'usr-bl-%' OR id LIKE 'usr-walkin-%' OR email LIKE 'owner_179%' OR email LIKE 'walkin_%'").run();

// Clean orphan applications
db.prepare("DELETE FROM business_applications WHERE telegram_user_id LIKE 'tg-test-%' OR owner_phone LIKE '+99893%'").run();

// 3. Ensure canonical subscription prices in subscription_plans
db.prepare("UPDATE subscription_plans SET price_uzs = 0 WHERE code = 'FREE'").run();
db.prepare("UPDATE subscription_plans SET price_uzs = 149000 WHERE code = 'START'").run();
db.prepare("UPDATE subscription_plans SET price_uzs = 299000 WHERE code = 'PRO'").run();
db.prepare("UPDATE subscription_plans SET price_uzs = 599000 WHERE code = 'BUSINESS'").run();

// 4. Check if is_test column exists in businesses, if not add it
const cols = db.prepare('PRAGMA table_info(businesses)').all().map(c => c.name);
if (!cols.includes('is_test')) {
  db.prepare('ALTER TABLE businesses ADD COLUMN is_test INTEGER DEFAULT 0').run();
  console.log('Added is_test column to businesses');
}
if (!cols.includes('is_temporarily_closed')) {
  db.prepare('ALTER TABLE businesses ADD COLUMN is_temporarily_closed INTEGER DEFAULT 0').run();
  console.log('Added is_temporarily_closed column to businesses');
}

db.exec('PRAGMA foreign_keys = ON;');

const check = db.prepare('PRAGMA foreign_key_check').all();
console.log('Foreign key check (should be empty):', check);

console.log('Remaining businesses:', db.prepare('SELECT id, name, phone, status, city_id FROM businesses').all());
console.log('Subscription plans:', db.prepare('SELECT code, price_uzs FROM subscription_plans').all());
