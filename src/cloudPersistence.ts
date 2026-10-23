import fs from 'fs';
import path from 'path';
import type { DatabaseSync } from 'node:sqlite';

const BACKUP_TABLES = [
  'categories',
  'cities',
  'users',
  'businesses',
  'business_applications',
  'business_memberships',
  'business_hours',
  'services',
  'staff',
  'staff_services',
  'staff_hours',
  'blocked_times',
  'bookings',
  'booking_waitlist',
  'queue_entries',
  'reviews',
  'subscription_transactions',
  'extra_service_orders',
  'promo_codes'
];

const LOCAL_SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'cloud-snapshot.json');
const ADMIN_BACKUP_CHAT_ID = '5564730141';

let pinnedMessageId: number | null = null;
let backupTimer: NodeJS.Timeout | null = null;
let isBackingUp = false;
let pendingBackupAfterCurrent = false;
let lastSnapshotHash = '';

function getCloudBotToken(): string {
  return (
    process.env.BUSINESS_BOT_TOKEN ||
    process.env.TELEGRAM_BUSINESS_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  ).trim();
}

export function exportDatabaseSnapshot(db: DatabaseSync): Record<string, any[]> {
  const snapshot: Record<string, any[]> = {};
  for (const table of BACKUP_TABLES) {
    try {
      const exists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      if (exists) {
        snapshot[table] = db.prepare(`SELECT * FROM ${table}`).all() as any[];
      }
    } catch (err) {
      // Ignore missing table during early init
    }
  }
  return snapshot;
}

export function importDatabaseSnapshot(db: DatabaseSync, snapshot: Record<string, any[]>): number {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  let restoredRows = 0;

  try {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN TRANSACTION;');

    for (const table of BACKUP_TABLES) {
      const rows = snapshot[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!tableInfo || tableInfo.length === 0) continue;
      const validCols = new Set(tableInfo.map((c) => c.name));

      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const cols = Object.keys(row).filter((k) => validCols.has(k));
        if (cols.length === 0) continue;

        const placeholders = cols.map(() => '?').join(', ');
        const colNames = cols.map((c) => `"${c}"`).join(', ');
        const values = cols.map((c) => row[c] ?? null);

        try {
          db.prepare(`INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`).run(
            ...values
          );
          restoredRows++;
        } catch (rowErr) {
          // Ignore individual row constraint conflict
        }
      }
    }

    db.exec('COMMIT;');
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    console.error('[CloudPersistence] Error importing snapshot:', err);
  } finally {
    try {
      db.exec('PRAGMA foreign_keys = ON;');
    } catch {}
  }

  return restoredRows;
}

export async function restoreDatabaseFromCloud(db: DatabaseSync): Promise<{
  restored: boolean;
  source: string;
  rows: number;
  businessesCount: number;
}> {
  let totalRows = 0;
  let source = 'none';

  // 1. First load local snapshot file if present
  try {
    if (fs.existsSync(LOCAL_SNAPSHOT_PATH)) {
      const raw = fs.readFileSync(LOCAL_SNAPSHOT_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.tables) {
        totalRows += importDatabaseSnapshot(db, parsed.tables);
        source = 'local-file';
      }
    }
  } catch (e) {
    console.error('[CloudPersistence] Local snapshot read error:', e);
  }

  // 2. Fetch latest cloud snapshot from Telegram pinned message in Super Admin chat (5564730141)
  const token = getCloudBotToken();
  if (token) {
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_BACKUP_CHAT_ID })
      });
      const chatData: any = await chatRes.json();

      const pinned = chatData?.result?.pinned_message;
      if (pinned?.message_id) {
        pinnedMessageId = pinned.message_id;
      }

      const doc = pinned?.document;
      if (doc?.file_id && (!doc.file_name || doc.file_name.includes('navbatbor'))) {
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: doc.file_id })
        });
        const fileData: any = await fileRes.json();
        const filePath = fileData?.result?.file_path;

        if (filePath) {
          const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
          if (downloadRes.ok) {
            const text = await downloadRes.text();
            const parsed = JSON.parse(text);
            const tables = parsed?.tables || parsed;
            if (tables && typeof tables === 'object') {
              const cloudRows = importDatabaseSnapshot(db, tables);
              totalRows = cloudRows;
              source = 'telegram-cloud';
              lastSnapshotHash = JSON.stringify(tables);
              console.log(
                `[CloudPersistence] ✅ Restored ${cloudRows} rows from Telegram Cloud Backup (msg #${pinnedMessageId})`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('[CloudPersistence] Telegram cloud restore error:', err);
    }
  }

  const bizCountRow = db.prepare('SELECT count(*) as c FROM businesses').get() as any;
  return {
    restored: totalRows > 0,
    source,
    rows: totalRows,
    businessesCount: bizCountRow?.c || 0
  };
}

export async function performCloudDatabaseBackup(
  db: DatabaseSync,
  force = false
): Promise<{ success: boolean; messageId?: number | null; businessesCount: number }> {
  if (isBackingUp) {
    pendingBackupAfterCurrent = true;
    return { success: false, businessesCount: 0 };
  }

  isBackingUp = true;
  try {
    const tables = exportDatabaseSnapshot(db);
    const serializedTables = JSON.stringify(tables);
    const bizCount = Array.isArray(tables.businesses) ? tables.businesses.length : 0;
    const staffCount = Array.isArray(tables.staff) ? tables.staff.length : 0;
    const userCount = Array.isArray(tables.users) ? tables.users.length : 0;

    if (!force && serializedTables === lastSnapshotHash) {
      return { success: true, messageId: pinnedMessageId, businessesCount: bizCount };
    }

    const payloadObj = {
      version: 1,
      updated_at: new Date().toISOString(),
      counts: {
        businesses: bizCount,
        staff: staffCount,
        users: userCount
      },
      tables
    };
    const jsonString = JSON.stringify(payloadObj);

    // Save to local snapshot file
    try {
      const dir = path.dirname(LOCAL_SNAPSHOT_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_SNAPSHOT_PATH, jsonString, 'utf8');
    } catch {}

    const token = getCloudBotToken();
    if (!token) {
      lastSnapshotHash = serializedTables;
      return { success: true, messageId: null, businessesCount: bizCount };
    }

    // Check pinnedMessageId if not yet resolved
    if (!pinnedMessageId) {
      try {
        const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_BACKUP_CHAT_ID })
        });
        const chatData: any = await chatRes.json();
        if (chatData?.result?.pinned_message?.document && chatData?.result?.pinned_message?.message_id) {
          pinnedMessageId = chatData.result.pinned_message.message_id;
        }
      } catch {}
    }

    const bizNames = (tables.businesses || []).map((b: any) => b.name).join(', ');
    const caption =
      `☁️ <b>NavbatBor Avtomatik Baza Zaxirasi (Cloud DB)</b>\n` +
      `🏢 Bizneslar (${bizCount} ta): <b>${bizNames || 'Nasaf dental'}</b>\n` +
      `👥 Mutaxassislar: <b>${staffCount} ta</b> | 👤 Foydalanuvchilar: <b>${userCount} ta</b>\n` +
      `🕒 Yangilangan: <code>${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</code>\n` +
      `🔒 <i>Server qayta yonganda barcha ma’lumotlar avtomatik shu fayldan tiklanadi.</i>`;

    const fileBlob = new Blob([jsonString], { type: 'application/json' });

    // Try updating existing pinned message in-place silently via editMessageMedia
    if (pinnedMessageId) {
      try {
        const form = new FormData();
        form.append('chat_id', ADMIN_BACKUP_CHAT_ID);
        form.append('message_id', String(pinnedMessageId));
        form.append(
          'media',
          JSON.stringify({
            type: 'document',
            media: 'attach://backup_file',
            caption,
            parse_mode: 'HTML'
          })
        );
        form.append('backup_file', fileBlob, 'navbatbor-cloud-backup.json');

        const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
          method: 'POST',
          body: form
        });
        const editData: any = await editRes.json();
        if (editData?.ok) {
          lastSnapshotHash = serializedTables;
          return { success: true, messageId: pinnedMessageId, businessesCount: bizCount };
        }
      } catch {}
    }

    // Otherwise send a new document silently and pin it
    const sendForm = new FormData();
    sendForm.append('chat_id', ADMIN_BACKUP_CHAT_ID);
    sendForm.append('disable_notification', 'true');
    sendForm.append('caption', caption);
    sendForm.append('parse_mode', 'HTML');
    sendForm.append('document', fileBlob, 'navbatbor-cloud-backup.json');

    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: sendForm
    });
    const sendData: any = await sendRes.json();

    if (sendData?.ok && sendData?.result?.message_id) {
      pinnedMessageId = sendData.result.message_id;
      lastSnapshotHash = serializedTables;

      await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_BACKUP_CHAT_ID,
          message_id: pinnedMessageId,
          disable_notification: true
        })
      }).catch(() => {});

      return { success: true, messageId: pinnedMessageId, businessesCount: bizCount };
    }

    return { success: false, messageId: pinnedMessageId, businessesCount: bizCount };
  } catch (err) {
    console.error('[CloudPersistence] Backup error:', err);
    return { success: false, businessesCount: 0 };
  } finally {
    isBackingUp = false;
    if (pendingBackupAfterCurrent) {
      pendingBackupAfterCurrent = false;
      scheduleCloudDatabaseBackup(db, 2000);
    }
  }
}

export function scheduleCloudDatabaseBackup(db: DatabaseSync, delayMs = 2500) {
  // Never run cloud backup during automated test scripts
  if (process.argv.some((a) => a.includes('test-') || a.includes('run_audit'))) {
    return;
  }
  if (backupTimer) {
    clearTimeout(backupTimer);
  }
  backupTimer = setTimeout(() => {
    backupTimer = null;
    performCloudDatabaseBackup(db).catch(() => {});
  }, delayMs);
}
