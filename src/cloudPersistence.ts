import fs from 'fs';
import path from 'path';
import type { DatabaseSync } from 'node:sqlite';

const BACKUP_TABLES = [
  'categories',
  'cities',
  'subscription_plans',
  'extra_services',
  'users',
  'user_sessions',
  'businesses',
  'business_applications',
  'business_memberships',
  'business_invitations',
  'business_hours',
  'business_screens',
  'services',
  'staff',
  'staff_services',
  'staff_hours',
  'blocked_times',
  'bookings',
  'booking_waitlist',
  'queue_entries',
  'reviews',
  'saved_businesses',
  'notifications',
  'subscription_transactions',
  'extra_service_orders',
  'monetization_expenses',
  'ad_promotions',
  'crm_leads',
  'partner_commissions',
  'partner_reports',
  'support_tickets',
  'promo_codes',
  'uploaded_files',
  'app_settings',
  'telegram_user_states',
  'business_bot_user_states',
  'telegram_auth_sessions',
  'telegram_link_tokens',
  'audit_logs',
  'queue_audit_logs'
];

const LOCAL_SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'cloud-snapshot.json');
const ADMIN_BACKUP_CHAT_ID = '5564730141';

const pinnedMessageIds: Record<string, number | null> = {};
let backupTimer: NodeJS.Timeout | null = null;
let isBackingUp = false;
let pendingBackupAfterCurrent = false;
let lastSnapshotHash = '';
let isRestoreCompleted = false;
let cloudSyncedAtLeastOnce = false;

function isTestProcess(): boolean {
  return process.argv.some((a) => a.includes('test-') || a.includes('run_audit'));
}

function getAllCloudBotTokens(): { label: string; token: string }[] {
  const bizToken = (
    process.env.BUSINESS_BOT_TOKEN ||
    process.env.TELEGRAM_BUSINESS_BOT_TOKEN ||
    ''
  ).trim();
  const custToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

  const result: { label: string; token: string }[] = [];
  if (bizToken && bizToken.length > 10) {
    result.push({ label: 'business', token: bizToken });
  }
  if (custToken && custToken.length > 10 && custToken !== bizToken) {
    result.push({ label: 'customer', token: custToken });
  }
  return result;
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
        if (
          table === 'queue_entries' &&
          (row.id === 'qe-771d0dfe' ||
            String(row.id || '').startsWith('qe-audit-') ||
            row.customer_name === 'Audit Test Navbatchi')
        ) {
          continue;
        }
        if (
          table === 'businesses' &&
          String(row.id || '').startsWith('biz-test-')
        ) {
          continue;
        }
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

async function fetchSnapshotFromTelegramBot(token: string, label: string): Promise<{
  tables: Record<string, any[]> | null;
  updatedAt: number;
  messageId: number | null;
}> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_BACKUP_CHAT_ID }),
        signal: AbortSignal.timeout(8000)
      });
      const chatData: any = await chatRes.json();

      const pinned = chatData?.result?.pinned_message;
      if (pinned?.message_id) {
        pinnedMessageIds[label] = pinned.message_id;
      }

      const doc = pinned?.document;
      if (doc?.file_id && (!doc.file_name || doc.file_name.includes('navbatbor'))) {
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: doc.file_id }),
          signal: AbortSignal.timeout(8000)
        });
        const fileData: any = await fileRes.json();
        const filePath = fileData?.result?.file_path;

        if (filePath) {
          const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
            signal: AbortSignal.timeout(12000)
          });
          if (downloadRes.ok) {
            const text = await downloadRes.text();
            const parsed = JSON.parse(text);
            const tables = parsed?.tables || parsed;
            if (tables && typeof tables === 'object') {
              const updatedAt = parsed?.updated_at ? new Date(parsed.updated_at).getTime() : 0;
              return { tables, updatedAt: isNaN(updatedAt) ? 0 : updatedAt, messageId: pinned.message_id };
            }
          }
        }
      }
      return { tables: null, updatedAt: 0, messageId: pinned?.message_id || null };
    } catch (err) {
      if (attempt === 3) {
        console.error(`[CloudPersistence] Telegram cloud fetch error (${label}, attempt ${attempt}):`, err);
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return { tables: null, updatedAt: 0, messageId: null };
}

export async function restoreDatabaseFromCloud(db: DatabaseSync): Promise<{
  restored: boolean;
  source: string;
  rows: number;
  businessesCount: number;
}> {
  let totalRows = 0;
  let source = 'none';

  const snapshotsToApply: { source: string; updatedAt: number; tables: Record<string, any[]> }[] = [];

  // 1. Load local snapshot file if present
  try {
    if (fs.existsSync(LOCAL_SNAPSHOT_PATH)) {
      const raw = fs.readFileSync(LOCAL_SNAPSHOT_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.tables && typeof parsed.tables === 'object') {
        const ts = parsed?.updated_at ? new Date(parsed.updated_at).getTime() : 0;
        snapshotsToApply.push({
          source: 'local-file',
          updatedAt: isNaN(ts) ? 0 : ts,
          tables: parsed.tables
        });
      }
    }
  } catch (e) {
    console.error('[CloudPersistence] Local snapshot read error:', e);
  }

  // 2. Fetch latest cloud snapshots from BOTH Telegram bots (Business Bot + Customer Bot)
  const bots = getAllCloudBotTokens();
  for (const bot of bots) {
    const res = await fetchSnapshotFromTelegramBot(bot.token, bot.label);
    if (res.tables) {
      cloudSyncedAtLeastOnce = true;
      snapshotsToApply.push({
        source: `telegram-cloud-${bot.label}`,
        updatedAt: res.updatedAt || Date.now(),
        tables: res.tables
      });
    }
  }

  // Sort snapshots chronologically (oldest first, newest last) so the newest data always wins while preserving any older records
  snapshotsToApply.sort((a, b) => a.updatedAt - b.updatedAt);

  for (const snap of snapshotsToApply) {
    const count = importDatabaseSnapshot(db, snap.tables);
    if (count > 0) {
      totalRows = count;
      source = snap.source;
    }
  }

  if (snapshotsToApply.length > 0) {
    const latestSnap = snapshotsToApply[snapshotsToApply.length - 1];
    lastSnapshotHash = JSON.stringify(exportDatabaseSnapshot(db));
    console.log(
      `[CloudPersistence] ✅ Restored ${totalRows} rows from ${source} (merged ${snapshotsToApply.length} snapshot source(s))`
    );
  }

  isRestoreCompleted = true;

  const bizCountRow = db.prepare('SELECT count(*) as c FROM businesses').get() as any;
  return {
    restored: totalRows > 0,
    source,
    rows: totalRows,
    businessesCount: bizCountRow?.c || 0
  };
}

async function uploadBackupToTelegramBot(
  token: string,
  label: string,
  jsonString: string,
  caption: string
): Promise<number | null> {
  try {
    if (!pinnedMessageIds[label]) {
      try {
        const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_BACKUP_CHAT_ID }),
          signal: AbortSignal.timeout(6000)
        });
        const chatData: any = await chatRes.json();
        if (chatData?.result?.pinned_message?.document && chatData?.result?.pinned_message?.message_id) {
          pinnedMessageIds[label] = chatData.result.pinned_message.message_id;
        }
      } catch {}
    }

    const fileBlob = new Blob([jsonString], { type: 'application/json' });
    const currentPinnedId = pinnedMessageIds[label];

    // Try updating existing pinned message in-place silently via editMessageMedia
    if (currentPinnedId) {
      try {
        const form = new FormData();
        form.append('chat_id', ADMIN_BACKUP_CHAT_ID);
        form.append('message_id', String(currentPinnedId));
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
          body: form,
          signal: AbortSignal.timeout(12000)
        });
        const editData: any = await editRes.json();
        if (editData?.ok) {
          return currentPinnedId;
        }
        if (editData?.description && editData.description.includes('message is not modified')) {
          return currentPinnedId;
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
      body: sendForm,
      signal: AbortSignal.timeout(12000)
    });
    const sendData: any = await sendRes.json();

    if (sendData?.ok && sendData?.result?.message_id) {
      const newMsgId = sendData.result.message_id;
      pinnedMessageIds[label] = newMsgId;

      await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_BACKUP_CHAT_ID,
          message_id: newMsgId,
          disable_notification: true
        }),
        signal: AbortSignal.timeout(6000)
      }).catch(() => {});

      return newMsgId;
    }
  } catch (err) {
    console.error(`[CloudPersistence] Upload error (${label}):`, err);
  }
  return pinnedMessageIds[label] || null;
}

export async function performCloudDatabaseBackup(
  db: DatabaseSync,
  force = false
): Promise<{ success: boolean; messageId?: number | null; businessesCount: number }> {
  // Never overwrite cloud backup from automated test scripts or before startup restore finishes
  if (isTestProcess() || !isRestoreCompleted) {
    return { success: false, businessesCount: 0 };
  }

  if (isBackingUp) {
    pendingBackupAfterCurrent = true;
    return { success: false, businessesCount: 0 };
  }

  isBackingUp = true;
  try {
    // Safety guard: if startup failed to reach Telegram Cloud, pull & merge from Telegram before pushing!
    const bots = getAllCloudBotTokens();
    if (!cloudSyncedAtLeastOnce && bots.length > 0) {
      for (const bot of bots) {
        const remote = await fetchSnapshotFromTelegramBot(bot.token, bot.label);
        if (remote.tables) {
          importDatabaseSnapshot(db, remote.tables);
          cloudSyncedAtLeastOnce = true;
        }
      }
    }

    const tables = exportDatabaseSnapshot(db);
    const serializedTables = JSON.stringify(tables);
    const bizCount = Array.isArray(tables.businesses) ? tables.businesses.length : 0;
    const staffCount = Array.isArray(tables.staff) ? tables.staff.length : 0;
    const userCount = Array.isArray(tables.users) ? tables.users.length : 0;
    const queueCount = Array.isArray(tables.queue_entries) ? tables.queue_entries.length : 0;
    const bookingCount = Array.isArray(tables.bookings) ? tables.bookings.length : 0;

    // Anti-wipe guard: never overwrite cloud backup if businesses table is somehow empty
    if (bizCount === 0) {
      return { success: false, businessesCount: 0 };
    }

    if (!force && serializedTables === lastSnapshotHash) {
      return { success: true, messageId: pinnedMessageIds['business'] || null, businessesCount: bizCount };
    }

    const payloadObj = {
      version: 2,
      updated_at: new Date().toISOString(),
      counts: {
        businesses: bizCount,
        staff: staffCount,
        users: userCount,
        queues: queueCount,
        bookings: bookingCount
      },
      tables
    };
    const jsonString = JSON.stringify(payloadObj);

    // 1. Save to local snapshot file
    try {
      const dir = path.dirname(LOCAL_SNAPSHOT_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_SNAPSHOT_PATH, jsonString, 'utf8');
    } catch {}

    if (bots.length === 0) {
      lastSnapshotHash = serializedTables;
      return { success: true, messageId: null, businessesCount: bizCount };
    }

    const bizNames = (tables.businesses || []).map((b: any) => b.name).join(', ');
    const caption =
      `☁️ <b>NavbatBor Avtomatik Baza Zaxirasi (Cloud DB v2)</b>\n` +
      `🏢 Bizneslar (${bizCount} ta): <b>${bizNames || 'Nasaf dental'}</b>\n` +
      `👥 Mutaxassislar: <b>${staffCount} ta</b> | 👤 Foydalanuvchilar: <b>${userCount} ta</b>\n` +
      `🎫 Navbatlar: <b>${queueCount} ta</b> | 📅 Bronlar: <b>${bookingCount} ta</b>\n` +
      `🕒 Yangilangan: <code>${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</code>\n` +
      `🔒 <i>Sayt yangilanganda yoki qayta publish qilinganda barcha ma’lumotlar avtomatik shu fayldan tiklanadi.</i>`;

    // 2. Upload to ALL configured Telegram bots in parallel for dual-bot redundancy
    const results = await Promise.all(
      bots.map((bot) => uploadBackupToTelegramBot(bot.token, bot.label, jsonString, caption))
    );

    const anyMsgId = results.find((id) => id !== null) || null;
    if (anyMsgId) {
      lastSnapshotHash = serializedTables;
      cloudSyncedAtLeastOnce = true;
      return { success: true, messageId: anyMsgId, businessesCount: bizCount };
    }

    return { success: false, messageId: null, businessesCount: bizCount };
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

export function scheduleCloudDatabaseBackup(db: DatabaseSync, delayMs = 2000) {
  if (isTestProcess() || !isRestoreCompleted) {
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
