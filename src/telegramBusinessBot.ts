/**
 * NavbatBor.uz — Rasmiy Biznes Telegram Boti
 * Exclusive Telegram Bot for Business Owners and Authorized Staff
 * 
 * Token: process.env.BUSINESS_BOT_TOKEN
 * Uzbek-first, Russian secondary
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export type BusinessBotRole = 'SUPER_ADMIN' | 'BUSINESS_OWNER' | 'MANAGER' | 'EMPLOYEE' | 'PENDING_APPLICANT' | 'REJECTED_APPLICANT' | 'BLOCKED' | 'GUEST';
export type BotLanguage = 'uz' | 'ru';

export interface TelegramUserAuthInfo {
  role: BusinessBotRole;
  business?: any;
  user?: any;
  staff?: any;
  pendingApplication?: any;
  permissions: string[];
  language: BotLanguage;
}

export interface BusinessBotHooks {
  broadcastQueueUpdate?: (businessId: string, payload: any) => void;
  notifyQueueCalled?: (entryId: string) => Promise<any>;
  authenticateTelegramUser?: (tgId: string | null, info: { first_name?: string; last_name?: string; username?: string; phone?: string; name?: string }) => { token: string; user: any };
}

let botHooks: BusinessBotHooks = {};

export function setBusinessBotHooks(hooks: Partial<BusinessBotHooks>) {
  botHooks = { ...botHooks, ...hooks };
}

export function parseSessionExpiryDate(expiresAt: any): Date {
  if (!expiresAt) return new Date(0);
  if (expiresAt instanceof Date) return expiresAt;
  let str = String(expiresAt).trim();
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('T')) {
    str = str.replace(' ', 'T') + 'Z';
  }
  return new Date(str);
}

export function getBusinessBotHooks(): BusinessBotHooks {
  return botHooks;
}

export function getBusinessPlatformAppUrl(db?: DatabaseSync): string {
  let custom = process.env.APP_URL;
  if (db) {
    try {
      const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'app_url'").get() as any;
      if (row?.value) custom = row.value;
    } catch (e) {}
  }
  if (custom && custom.trim().length > 0 && !custom.includes('localhost') && !custom.includes('your-domain.com') && !custom.includes('asia-southeast1.run.app')) {
    return custom.trim().replace(/\/+$/, '');
  }
  return 'https://navbatbor.uz';
}

export function fallbackAuthenticateTelegramUser(db: DatabaseSync, tgId: string, from?: any): { token: string; user: any } {
  let user: any = db.prepare('SELECT * FROM users WHERE telegram_chat_id = ? OR telegram_user_id = ?').get(tgId, tgId);
  if (!user) {
    const userId = 'usr-tg-' + tgId;
    const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || (from?.username ? `@${from.username}` : 'Telegram Foydalanuvchi');
    const email = `tg_${tgId}@navbatbor.uz`;
    const passwordHash = 'tg_auth_synthetic_hash';
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status, telegram_chat_id, telegram_user_id, telegram_username, telegram_first_name)
      VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE', ?, ?, ?, ?)
    `).run(userId, fullName, email, passwordHash, tgId, tgId, from?.username || null, from?.first_name || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }
  const token = 'tok-' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  db.prepare('INSERT INTO user_sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  return { token, user };
}

// ========================================================
// 1. ENVIRONMENT CONFIGURATION & CONSTANTS
// ========================================================
export function getBusinessBotToken(): string {
  return process.env.BUSINESS_BOT_TOKEN || '';
}

export function getBusinessBotUsername(): string {
  return process.env.BUSINESS_BOT_USERNAME || 'navbatbor_bizness_bot';
}

export function getSuperAdminTelegramIds(): string[] {
  const envVal = process.env.SUPER_ADMIN_TELEGRAM_IDS || '';
  const parsed = envVal.split(',').map(s => s.trim()).filter(Boolean);
  // Default fallback super admin if not configured in env
  if (parsed.length === 0) {
    return ['108923481'];
  }
  return parsed;
}

export function getBusinessBotWebhookSecret(): string {
  return process.env.BUSINESS_BOT_WEBHOOK_SECRET || 'navbatbor_biz_sec_2026';
}

// ========================================================
// 2. MULTI-LANGUAGE STRINGS (UZBEK PRIMARY, RUSSIAN SECONDARY)
// ========================================================
export const STRINGS = {
  uz: {
    welcome_guest: `👋 <b>Assalomu alaykum! NavbatBor Biznes Botiga xush kelibsiz.</b>\n\n` +
      `Ushbu bot faqat muassasalar (klinikalar, go‘zallik salonlari, avtoservislar va boshqa xizmat ko‘rsatish maskanlari) rahbarlari va xodimlari uchun mo‘ljallangan.\n\n` +
      `Agar siz biznesingizni NavbatBor platformasiga ulamoqchi bo‘lsangiz, arizani to‘ldiring yoki mavjud biznesingizni bog‘lang. Administrator tasdiqlagach, to‘liq boshqaruv paneliga ega bo‘lasiz.`,
    btn_register: `📝 Biznes egasi sifatida ro‘yxatdan o‘tish`,
    btn_link_biz: `🔗 Mavjud biznesni ulash`,
    btn_check_status: `🔍 Ariza holatini tekshirish`,
    btn_help: `🆘 Yordam va ma’lumot`,
    
    pending_notice: `⏳ <b>Sizning arizangiz ko‘rib chiqilmoqda!</b>\n\n` +
      `🏢 Biznes: <b>{biz_name}</b>\n` +
      `📅 Ariza topshirilgan sana: <b>{created_at}</b>\n` +
      `Status: 🟡 <b>KUTILMOQDA (PENDING)</b>\n\n` +
      `Bosh administrator arizangizni ko‘rib chiqqach, ushbu bot orqali darhol xabarnoma olasiz. Iltimos, kuting.`,
    
    rejected_notice: `❌ <b>Arizangiz rad etilgan</b>\n\n` +
      `🏢 Biznes: <b>{biz_name}</b>\n` +
      `Sabab: <i>{reason}</i>\n\n` +
      `Qaytadan to‘g‘ri ma’lumotlar bilan ariza topshirishingiz mumkin.`,
    
    blocked_notice: `⛔️ <b>Kirish taqiqlangan!</b>\n\n` +
      `Sizning hisobingiz yoki biznesingiz administrator tomonidan bloklangan.\n` +
      `Batafsil ma’lumot olish uchun texnik qo‘llab-quvvatlash xizmati bilan bog‘laning:\n` +
      `📞 Tel: +998200232540 | 👤 Telegram: @mansur_0511 | ✉️ Email: mansurnuriddin24@gmail.com`,

    btn_reapply: `🔄 Qaytadan ariza topshirish`,
    
    link_prompt: `📱 <b>Mavjud biznesni ulash:</b>\n\n` +
      `NavbatBor platformasida ro‘yxatdan o‘tgan telefon raqamingizni yuboring:\n` +
      `Quyidagi tugmani bosing yoki raqamni <code>+998901234567</code> formatida yozing:`,
    link_success: `🎉 <b>Tabriklaymiz! Biznesingiz muvaffaqiyatli bog‘landi!</b>\n\n` +
      `🏢 Biznes: <b>{biz_name}</b>\n` +
      `Endi barcha navbatlarni ushbu bot orqali boshqarishingiz mumkin.`,
    link_not_found: `❌ <b>Ushbu telefon raqamiga biriktirilgan faol biznes topilmadi.</b>\n\n` +
      `Iltimos, saytda kiritilgan raqamingizni to‘g‘ri kiritganingizni tekshiring yoki yangi biznes egasi sifatida ariza topshiring.`,

    // Registration Steps
    reg_step1_name: `🏢 <b>1-qadam: Biznesingiz nomini kiriting:</b>\n\nMasalan: <i>Nasaf Dental Stomatologiyasi</i> yoki <i>Barbershop Elegant</i>`,
    reg_step2_owner: `👤 <b>2-qadam: Rahbarning to‘liq ism-sharifini kiriting:</b>\n\nMasalan: <i>Mansur Rahimov</i>`,
    reg_step3_phone: `📱 <b>3-qadam: Aloqa uchun telefon raqamingiz:</b>\n\nQuyidagi tugma orqali kontaktingizni ulashing yoki <code>+998901234567</code> formatida yozing:`,
    btn_send_contact: `📲 Telefon raqamni yuborish`,
    reg_step4_category: `🏷 <b>4-qadam: Biznes faoliyat sohasini tanlang:</b>`,
    reg_step5_city: `📍 <b>5-qadam: Hududni (shahar/tuman) tanlang:</b>`,
    reg_step6_address: `🏠 <b>6-qadam: Aniq manzilni kiriting:</b>\n\nMasalan: <i>Qarshi shahar, Mustaqillik ko‘chasi, 14-uy</i>`,
    reg_step7_desc: `📝 <b>7-qadam: Biznesingiz haqida qisqacha ma’lumot (ixtiyoriy):</b>\n\nIsh faoliyati, xizmatlar haqida yozing yoki pastdagi tugmani bosing:`,
    btn_skip: `⏩ O‘tkazib yuborish`,
    reg_confirm_title: `📋 <b>Arizangiz tayyor! Ma’lumotlarni tasdiqlang:</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 Biznes: <b>{biz_name}</b>\n` +
      `👤 Egasi: <b>{owner_name}</b>\n` +
      `📱 Tel: <b>{phone}</b>\n` +
      `🏷 Soha: <b>{category}</b>\n` +
      `📍 Hudud: <b>{city}</b>\n` +
      `🏠 Manzil: <b>{address}</b>\n` +
      `📝 Tavsif: <i>{description}</i>\n` +
      `━━━━━━━━━━━━━━━━\nTasdiqlaysizmi?`,
    btn_submit_app: `✅ Arizani topshirish`,
    btn_cancel_app: `❌ Bekor qilish`,
    
    app_submitted: `🎉 <b>Arizangiz muvaffaqiyatli qabul qilindi!</b>\n\n` +
      `Tez orada NavbatBor ma’muriyati ma’lumotlarni tekshirib, hisobingizni faollashtiradi. Tasdiqlangach, botda barcha boshqaruv menyulari avtomatik ochiladi.`,
    
    // Super Admin Notifications
    admin_new_app_title: `🚨 <b>YANGI BIZNES ARIZASI!</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 Biznes: <b>{biz_name}</b>\n` +
      `👤 Rahbar: <b>{owner_name}</b>\n` +
      `📱 Tel: <code>{phone}</code>\n` +
      `🏷 Soha: <b>{category}</b>\n` +
      `📍 Hudud: <b>{city}</b>\n` +
      `🏠 Manzil: <b>{address}</b>\n` +
      `🆔 Telegram ID: <code>{tg_id}</code> (@{tg_user})\n` +
      `📅 Sana: <b>{created_at}</b>\n` +
      `━━━━━━━━━━━━━━━━`,
    btn_admin_approve: `✅ Tasdiqlash (Approve)`,
    btn_admin_reject: `❌ Rad etish (Reject)`,
    btn_admin_details: `ℹ️ Tafsilotlar`,
    
    app_approved_owner: `🎉 <b>TABRIKLAYMIZ! ARIZANGIZ TASDIQLANDI!</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 <b>{biz_name}</b> NavbatBor tizimiga muvaffaqiyatli ulandi.\n` +
      `⚡️ <b>14 kunlik bepul sinov (TRIAL)</b> tarifi faollashtirildi.\n\n` +
      `👇 Quyidagi boshqaruv menyusidan foydalanishingiz mumkin:`,
    
    app_rejected_owner: `❌ <b>Arizangiz rad etildi</b>\n\n` +
      `🏢 <b>{biz_name}</b> arizasi bosh administrator tomonidan rad etildi.\n` +
      `Sabab: <i>{reason}</i>`,
    
    // Streamlined Essential Business Bot Buttons
    btn_menu_call_next: `🟢 KEYINGI MIJOZNI CHAQIRISH`,
    btn_menu_current: `👤 Hozirgi mijoz`,
    btn_menu_live_queue: `📋 Jonli navbat`,
    btn_menu_today_bookings: `📅 Bugungi bronlar`,
    btn_menu_quick_walkin: `➕ Navbatga qo‘shish`,
    btn_menu_report: `📊 Bugungi hisobot`,
    btn_menu_web_panel: `🌐 Boshqaruv paneli`,

    // Existing / backward-compatible button keys
    btn_menu_stats: `📊 Statistika`,
    btn_menu_today: `📋 Bugungi navbatlar`,
    btn_menu_queue: `🟢 Jonli navbat`,
    btn_menu_walkin: `➕ Jonli navbatga mijoz qo‘shish`,
    btn_menu_next: `➡️ Keyingi mijoz`,
    btn_menu_served: `✅ Mijozga xizmat ko‘rsatildi`,
    btn_menu_cancel: `❌ Navbatni bekor qilish`,
    btn_menu_staff: `👥 Xodimlar`,
    btn_menu_hours: `🕒 Ish vaqti`,
    btn_menu_services: `🛎 Xizmatlar va narxlar`,
    btn_menu_notifications: `🔔 Bildirishnomalar`,
    btn_menu_settings: `⚙️ Sozlamalar`,
    btn_menu_help: `🆘 Yordam`,
    
    unauthorized: `⛔️ <b>Ruxsat berilmagan!</b> Sizda ushbu amalni bajarish huquqi yo‘q.`,
    error_occurred: `⚠️ Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.`
  },
  ru: {
    welcome_guest: `👋 <b>Здравствуйте! Добро пожаловать в NavbatBor Business Bot.</b>\n\n` +
      `Этот бот предназначен исключительно для руководителей и персонала заведений (клиник, салонов красоты, автосервисов и др.).\n\n` +
      `Если вы хотите подключить свой бизнес к NavbatBor, заполните заявку или привяжите существующий бизнес. После одобрения администратором вам станет доступна полная панель управления.`,
    btn_register: `📝 Зарегистрироваться как владелец бизнеса`,
    btn_link_biz: `🔗 Привязать существующий бизнес`,
    btn_check_status: `🔍 Проверить статус заявки`,
    btn_help: `🆘 Помощь и информация`,
    
    pending_notice: `⏳ <b>Ваша заявка находится на рассмотрении!</b>\n\n` +
      `🏢 Бизнес: <b>{biz_name}</b>\n` +
      `📅 Дата подачи: <b>{created_at}</b>\n` +
      `Статус: 🟡 <b>ОЖИДАЕТСЯ (PENDING)</b>\n\n` +
      `Как только главный администратор рассмотрит заявку, вы получите уведомление в этом боте.`,
    
    rejected_notice: `❌ <b>Ваша заявка отклонена</b>\n\n` +
      `🏢 Бизнес: <b>{biz_name}</b>\n` +
      `Причина: <i>{reason}</i>\n\n` +
      `Вы можете подать заявку повторно с корректными данными.`,
    
    blocked_notice: `⛔️ <b>Доступ заблокирован!</b>\n\n` +
      `Ваш аккаунт или бизнес заблокирован администратором.\n` +
      `Для получения информации обратитесь в службу технической поддержки:\n` +
      `📞 Тел: +998200232540 | 👤 Telegram: @mansur_0511 | ✉️ Email: mansurnuriddin24@gmail.com`,

    btn_reapply: `🔄 Подать заявку повторно`,
    
    link_prompt: `📱 <b>Привязка существующего бизнеса:</b>\n\n` +
      `Отправьте номер телефона, зарегистрированный на платформе NavbatBor:\n` +
      `Нажмите кнопку ниже или введите номер в формате <code>+998901234567</code>:`,
    link_success: `🎉 <b>Поздравляем! Ваш бизнес успешно привязан!</b>\n\n` +
      `🏢 Бизнес: <b>{biz_name}</b>\n` +
      `Теперь вы можете управлять очередями через этого бота.`,
    link_not_found: `❌ <b>Активный бизнес по данному номеру телефона не найден.</b>\n\n` +
      `Пожалуйста, проверьте номер телефона или подайте новую заявку на подключение.`,

    reg_step1_name: `🏢 <b>Шаг 1: Введите название вашего бизнеса:</b>\n\nНапример: <i>Стоматология Насаф</i> или <i>Барбершоп Элегант</i>`,
    reg_step2_owner: `👤 <b>Шаг 2: Введите ФИО руководителя:</b>\n\nНапример: <i>Мансур Рахимов</i>`,
    reg_step3_phone: `📱 <b>Шаг 3: Контактный номер телефона:</b>\n\nПоделитесь контактом кнопкой ниже или введите в формате <code>+998901234567</code>:`,
    btn_send_contact: `📲 Отправить номер телефона`,
    reg_step4_category: `🏷 <b>Шаг 4: Выберите сферу деятельности:</b>`,
    reg_step5_city: `📍 <b>Шаг 5: Выберите город / район:</b>`,
    reg_step6_address: `🏠 <b>Шаг 6: Введите точный адрес:</b>\n\nНапример: <i>г. Карши, ул. Мустакиллик, д. 14</i>`,
    reg_step7_desc: `📝 <b>Шаг 7: Краткое описание вашего бизнеса (необязательно):</b>`,
    btn_skip: `⏩ Пропустить`,
    reg_confirm_title: `📋 <b>Заявка готова! Проверьте данные:</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 Бизнес: <b>{biz_name}</b>\n` +
      `👤 Владелец: <b>{owner_name}</b>\n` +
      `📱 Тел: <b>{phone}</b>\n` +
      `🏷 Сфера: <b>{category}</b>\n` +
      `📍 Регион: <b>{city}</b>\n` +
      `🏠 Адрес: <b>{address}</b>\n` +
      `📝 Описание: <i>{description}</i>\n` +
      `━━━━━━━━━━━━━━━━\nПодтверждаете отправку?`,
    btn_submit_app: `✅ Отправить заявку`,
    btn_cancel_app: `❌ Отмена`,
    
    app_submitted: `🎉 <b>Ваша заявка успешно отправлена!</b>\n\nАдминистрация NavbatBor проверит данные и активирует аккаунт.`,
    
    admin_new_app_title: `🚨 <b>НОВАЯ ЗАЯВКА НА ПОДКЛЮЧЕНИЕ БИЗНЕСА!</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 Бизнес: <b>{biz_name}</b>\n` +
      `👤 Владелец: <b>{owner_name}</b>\n` +
      `📱 Тел: <code>{phone}</code>\n` +
      `🏷 Сфера: <b>{category}</b>\n` +
      `📍 Регион: <b>{city}</b>\n` +
      `🏠 Адрес: <b>{address}</b>\n` +
      `🆔 Telegram ID: <code>{tg_id}</code> (@{tg_user})\n` +
      `📅 Дата: <b>{created_at}</b>\n` +
      `━━━━━━━━━━━━━━━━`,
    btn_admin_approve: `✅ Одобрить (Approve)`,
    btn_admin_reject: `❌ Отклонить (Reject)`,
    btn_admin_details: `ℹ️ Детали`,
    
    app_approved_owner: `🎉 <b>ПОЗДРАВЛЯЕМ! ВАША ЗАЯВКА ОДОБРЕНА!</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 <b>{biz_name}</b> успешно подключен к платформе NavbatBor.\n` +
      `⚡️ Активирован <b>14-дневный бесплатный пробный период (TRIAL)</b>.\n\n` +
      `👇 Используйте меню ниже для управления:`,
    
    app_rejected_owner: `❌ <b>Заявка отклонена</b>\n\n` +
      `Заявка <b>{biz_name}</b> отклонена администратором.\n` +
      `Причина: <i>{reason}</i>`,
    
    // Streamlined Essential Business Bot Buttons
    btn_menu_call_next: `🟢 ВЫЗВАТЬ СЛЕДУЮЩЕГО`,
    btn_menu_current: `👤 Текущий клиент`,
    btn_menu_live_queue: `📋 Живая очередь`,
    btn_menu_today_bookings: `📅 Брони на сегодня`,
    btn_menu_quick_walkin: `➕ Добавить в очередь`,
    btn_menu_report: `📊 Отчет за сегодня`,
    btn_menu_web_panel: `🌐 Панель управления`,

    // 13 Russian Dashboard Menu Buttons (backward compatibility)
    btn_menu_stats: `📊 Статистика`,
    btn_menu_today: `📋 Очереди на сегодня`,
    btn_menu_queue: `🟢 Живая очередь`,
    btn_menu_walkin: `➕ Добавить клиента в очередь`,
    btn_menu_next: `➡️ Следующий клиент`,
    btn_menu_served: `✅ Клиент обслужен`,
    btn_menu_cancel: `❌ Отменить очередь`,
    btn_menu_staff: `👥 Сотрудники`,
    btn_menu_hours: `🕒 График работы`,
    btn_menu_services: `🛎 Услуги и цены`,
    btn_menu_notifications: `🔔 Уведомления`,
    btn_menu_settings: `⚙️ Настройки`,
    btn_menu_help: `🆘 Помощь`,
    
    unauthorized: `⛔️ <b>Доступ запрещен!</b> У вас нет прав для выполнения этого действия.`,
    error_occurred: `⚠️ Произошла ошибка. Пожалуйста, попробуйте снова.`
  }
};

export function t(lang: BotLanguage, key: keyof typeof STRINGS.uz, vars?: Record<string, string>): string {
  const dict = STRINGS[lang] || STRINGS.uz;
  let text = (dict as any)[key] || STRINGS.uz[key] || '';
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v || '');
    }
  }
  return text;
}

// ========================================================
// 3. DATABASE INITIALIZATION & MIGRATIONS
// ========================================================
export function initBusinessBotDatabase(db: DatabaseSync): void {
  db.exec(`
    -- 1. Business Applications for registration and approval
    CREATE TABLE IF NOT EXISTS business_applications (
      id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      telegram_chat_id TEXT NOT NULL,
      telegram_username TEXT,
      business_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      category_id TEXT NOT NULL,
      city_id TEXT NOT NULL,
      district TEXT,
      address TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by_admin_id TEXT,
      reviewed_by_telegram_id TEXT,
      rejection_reason TEXT,
      created_business_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );

    CREATE INDEX IF NOT EXISTS idx_biz_apps_tg_user ON business_applications(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_biz_apps_status ON business_applications(status);

    -- 2. Business Bot User States (Conversation state machine)
    CREATE TABLE IF NOT EXISTS business_bot_user_states (
      chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      step TEXT,
      state_data_json TEXT,
      language TEXT DEFAULT 'uz' CHECK(language IN ('uz', 'ru')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Business Bot Audit Logs
    CREATE TABLE IF NOT EXISTS business_bot_audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_telegram_id TEXT NOT NULL,
      actor_user_id TEXT,
      target_id TEXT,
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Processed updates deduplication
    CREATE TABLE IF NOT EXISTS processed_business_bot_updates (
      update_id INTEGER PRIMARY KEY,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ========================================================
// 4. TELEGRAM BOT API LOW-LEVEL CALLER (ISOLATED TOKEN)
// ========================================================
export async function callTelegramBusinessApi(
  method: string,
  body: Record<string, any>,
  customToken?: string
): Promise<{ ok: boolean; result?: any; description?: string }> {
  const token = customToken || getBusinessBotToken();
  if (!token || token.trim().length <= 10) {
    // Return simulated success when running without configured bot token
    return { ok: true, result: { message_id: Math.floor(Math.random() * 100000) } };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json() as any;
    return data;
  } catch (err: any) {
    console.error(`[Business Bot API Error] ${method}:`, err.message);
    return { ok: false, description: err.message };
  }
}

export async function sendBusinessBotMessage(
  chatId: string | number,
  text: string,
  options?: {
    replyMarkup?: any;
    parseMode?: 'HTML' | 'Markdown';
  }
): Promise<any> {
  return callTelegramBusinessApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode || 'HTML',
    reply_markup: options?.replyMarkup
  });
}

export async function answerBusinessBotCallback(callbackId: string, text?: string, showAlert = false): Promise<any> {
  return callTelegramBusinessApi('answerCallbackQuery', {
    callback_query_id: callbackId,
    text: text || '',
    show_alert: showAlert
  });
}

/**
 * Send real-time notification to Business Owner via Business Bot
 */
export async function notifyBusinessOwnerViaBusinessBot(
  db: DatabaseSync,
  businessId: string,
  message: string,
  options?: { replyMarkup?: any }
): Promise<boolean> {
  try {
    const biz = db.prepare(`
      SELECT b.owner_id, b.telegram_chat_id as biz_chat, u.telegram_chat_id as user_chat,
             ba.telegram_chat_id as app_chat
      FROM businesses b
      LEFT JOIN users u ON b.owner_id = u.id
      LEFT JOIN business_applications ba ON (ba.created_business_id = b.id OR ba.id = b.id) AND ba.status = 'APPROVED'
      WHERE b.id = ?
    `).get(businessId) as any;

    const targetChat = biz?.biz_chat || biz?.app_chat || biz?.user_chat;
    if (!targetChat) return false;

    const res = await sendBusinessBotMessage(targetChat, message, options);
    return Boolean(res?.ok);
  } catch (err: any) {
    console.error('[notifyBusinessOwnerViaBusinessBot Error]:', err?.message);
    return false;
  }
}

// ========================================================
// 5. USER AUTHENTICATION & ROLE RESOLVER
// ========================================================
export function getBusinessBotUserAuth(db: DatabaseSync, telegramUserId: string, chatId?: string): TelegramUserAuthInfo {
  const idStr = String(telegramUserId).trim();
  const cId = chatId ? String(chatId).trim() : idStr;

  // 1. Language state
  let language: BotLanguage = 'uz';
  try {
    const state = db.prepare('SELECT language FROM business_bot_user_states WHERE chat_id = ?').get(cId) as any;
    if (state?.language === 'ru') language = 'ru';
  } catch (e) {}

  // 2. Check BLOCKED status (user or application)
  try {
    const blockedUser = db.prepare(`
      SELECT * FROM users
      WHERE (telegram_chat_id = ? OR telegram_user_id = ?) AND status IN ('SUSPENDED', 'BLOCKED')
      LIMIT 1
    `).get(idStr, idStr) as any;
    if (blockedUser) {
      return { role: 'BLOCKED', user: blockedUser, permissions: [], language };
    }

    const blockedBiz = db.prepare(`
      SELECT * FROM businesses
      WHERE (telegram_chat_id = ? OR telegram_user_id = ?) AND status IN ('SUSPENDED', 'BLOCKED')
      LIMIT 1
    `).get(idStr, idStr) as any;
    if (blockedBiz) {
      return { role: 'BLOCKED', business: blockedBiz, permissions: [], language };
    }

    const blockedApp = db.prepare(`
      SELECT * FROM business_applications
      WHERE telegram_user_id = ? AND status IN ('BLOCKED', 'REJECTED_BLOCKED')
      LIMIT 1
    `).get(idStr) as any;
    if (blockedApp) {
      return { role: 'BLOCKED', pendingApplication: blockedApp, permissions: [], language };
    }
  } catch (e) {}

  // 3. Super Admin check
  const superAdminIds = getSuperAdminTelegramIds();
  const isSuperAdminEnv = superAdminIds.includes(idStr);

  let superAdminDbUser: any = null;
  try {
    superAdminDbUser = db.prepare(`
      SELECT * FROM users 
      WHERE (telegram_chat_id = ? OR telegram_user_id = ?) 
        AND role IN ('SUPER_ADMIN', 'FOUNDER', 'ADMIN')
      LIMIT 1
    `).get(idStr, idStr);
  } catch (e) {}

  if (isSuperAdminEnv || superAdminDbUser) {
    return {
      role: 'SUPER_ADMIN',
      user: superAdminDbUser || { id: 'usr-admin', name: 'Super Admin', role: 'SUPER_ADMIN' },
      permissions: ['ALL', 'APPROVE_APPLICATIONS', 'REJECT_APPLICATIONS', 'VIEW_ALL_BUSINESSES', 'VIEW_STATS'],
      language
    };
  }

  // 4. Approved Business Owner check
  let bizAsOwner: any = null;
  try {
    bizAsOwner = db.prepare(`
      SELECT b.*, u.id as owner_user_id, u.name as owner_name, u.phone as owner_phone, u.email as owner_email
      FROM businesses b
      JOIN users u ON b.owner_id = u.id
      WHERE (b.telegram_chat_id = ? OR b.telegram_user_id = ? OR u.telegram_chat_id = ? OR u.telegram_user_id = ?)
        AND b.status IN ('APPROVED', 'ACTIVE')
      ORDER BY b.created_at DESC LIMIT 1
    `).get(idStr, idStr, idStr, idStr);
  } catch (e) {}

  // If not found directly, check via approved application
  if (!bizAsOwner) {
    try {
      bizAsOwner = db.prepare(`
        SELECT b.*, u.id as owner_user_id, u.name as owner_name, u.phone as owner_phone, u.email as owner_email
        FROM business_applications ba
        JOIN businesses b ON (ba.created_business_id = b.id OR ba.id = b.id)
        JOIN users u ON b.owner_id = u.id
        WHERE (ba.telegram_user_id = ? OR ba.telegram_chat_id = ?)
          AND ba.status = 'APPROVED'
          AND b.status IN ('APPROVED', 'ACTIVE')
        ORDER BY b.created_at DESC LIMIT 1
      `).get(idStr, idStr);
    } catch (e) {}
  }

  if (bizAsOwner) {
    return {
      role: 'BUSINESS_OWNER',
      business: bizAsOwner,
      user: { id: bizAsOwner.owner_user_id, name: bizAsOwner.owner_name, phone: bizAsOwner.owner_phone },
      permissions: ['ALL', 'CALL_NEXT_CUSTOMER', 'VIEW_QUEUE', 'ADD_WALKIN', 'VIEW_STATISTICS', 'VIEW_BOOKINGS', 'VIEW_CUSTOMERS', 'VIEW_SERVICES', 'VIEW_STAFF'],
      language
    };
  }

  // 5. Staff / Manager check
  let staffRecord: any = null;
  try {
    staffRecord = db.prepare(`
      SELECT st.*, b.name as business_name, b.slug as business_slug, b.status as business_status,
             u.id as staff_user_id, u.role as user_role, u.name as staff_user_name
      FROM staff st
      JOIN businesses b ON st.business_id = b.id
      LEFT JOIN users u ON st.user_id = u.id
      WHERE (st.telegram_chat_id = ? OR st.telegram_user_id = ? OR u.telegram_chat_id = ? OR u.telegram_user_id = ?)
        AND st.is_active = 1
        AND b.status IN ('APPROVED', 'ACTIVE')
      LIMIT 1
    `).get(idStr, idStr, idStr, idStr);
  } catch (e) {}

  if (staffRecord) {
    const isManager = staffRecord.user_role === 'MANAGER' || staffRecord.user_role === 'BUSINESS_MANAGER';
    const bizObj = db.prepare('SELECT * FROM businesses WHERE id = ?').get(staffRecord.business_id) as any;
    return {
      role: isManager ? 'MANAGER' : 'EMPLOYEE',
      business: bizObj,
      staff: staffRecord,
      user: { id: staffRecord.staff_user_id, name: staffRecord.staff_user_name || staffRecord.name },
      permissions: isManager 
        ? ['CALL_NEXT_CUSTOMER', 'VIEW_QUEUE', 'ADD_WALKIN', 'VIEW_STATISTICS', 'VIEW_BOOKINGS', 'VIEW_CUSTOMERS', 'VIEW_SERVICES', 'VIEW_STAFF']
        : ['CALL_NEXT_CUSTOMER', 'VIEW_QUEUE', 'ADD_WALKIN', 'VIEW_BOOKINGS'],
      language
    };
  }

  // 6. Application check (Pending or Rejected)
  let latestApp: any = null;
  try {
    latestApp = db.prepare(`
      SELECT * FROM business_applications 
      WHERE telegram_user_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(idStr);
  } catch (e) {}

  if (latestApp) {
    if (latestApp.status === 'PENDING') {
      return {
        role: 'PENDING_APPLICANT',
        pendingApplication: latestApp,
        permissions: [],
        language
      };
    }
    if (latestApp.status === 'REJECTED') {
      return {
        role: 'REJECTED_APPLICANT',
        pendingApplication: latestApp,
        permissions: [],
        language
      };
    }
  }

  // 7. Guest
  return {
    role: 'GUEST',
    pendingApplication: latestApp,
    permissions: [],
    language
  };
}

// ========================================================
// 6. KEYBOARDS & UI BUILDERS
// ========================================================
export function getGuestKeyboard(lang: BotLanguage, hasPending = false) {
  const keyboard = [];
  if (!hasPending) {
    keyboard.push([{ text: t(lang, 'btn_register') }]);
    keyboard.push([{ text: t(lang, 'btn_link_biz') }]);
  } else {
    keyboard.push([{ text: t(lang, 'btn_check_status') }]);
    keyboard.push([{ text: t(lang, 'btn_link_biz') }]);
  }
  keyboard.push([{ text: '🇺🇿 O‘zbekcha' }, { text: '🇷🇺 Русский' }]);
  keyboard.push([{ text: t(lang, 'btn_help') }]);

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true
  };
}

export function getBusinessDashboardKeyboard(lang: BotLanguage, role: BusinessBotRole) {
  const keyboard: any[][] = [
    [{ text: t(lang, 'btn_menu_call_next') }],
    [{ text: t(lang, 'btn_menu_current') }, { text: t(lang, 'btn_menu_live_queue') }],
    [{ text: t(lang, 'btn_menu_today_bookings') }, { text: t(lang, 'btn_menu_quick_walkin') }],
    [{ text: t(lang, 'btn_menu_report') }, { text: t(lang, 'btn_menu_web_panel') }]
  ];

  if (role === 'SUPER_ADMIN') {
    keyboard.push([
      { text: '📝 Kutayotgan arizalar' },
      { text: '👑 Super Admin Boshqaruvi' }
    ]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true
  };
}

// ========================================================
// 7. AUDIT LOGGING HELPER
// ========================================================
export function logBusinessBotAudit(
  db: DatabaseSync,
  action: string,
  actorTelegramId: string,
  actorUserId?: string | null,
  targetId?: string | null,
  details?: Record<string, any>
): void {
  try {
    const id = 'bbal-' + crypto.randomUUID().slice(0, 10);
    db.prepare(`
      INSERT INTO business_bot_audit_logs (id, action, actor_telegram_id, actor_user_id, target_id, details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, action, String(actorTelegramId), actorUserId || null, targetId || null, details ? JSON.stringify(details) : null);
  } catch (err: any) {
    console.error('[Audit Log Error]:', err.message);
  }
}

// ========================================================
// 8. REGISTRATION & MULTI-STEP FLOW ENGINE
// ========================================================
export function getBotUserState(db: DatabaseSync, chatId: string): { step: string | null; data: any; lang: BotLanguage } {
  try {
    const row = db.prepare('SELECT step, state_data_json, language FROM business_bot_user_states WHERE chat_id = ?').get(chatId) as any;
    let data = {};
    if (row?.state_data_json) {
      try { data = JSON.parse(row.state_data_json); } catch (e) {}
    }
    return {
      step: row?.step || null,
      data,
      lang: (row?.language as BotLanguage) || 'uz'
    };
  } catch (e) {
    return { step: null, data: {}, lang: 'uz' };
  }
}

export function setBotUserState(db: DatabaseSync, chatId: string, telegramUserId: string, step: string | null, data?: any, lang?: BotLanguage): void {
  try {
    const current = getBotUserState(db, chatId);
    const finalData = data !== undefined ? data : current.data;
    const finalLang = lang || current.lang || 'uz';

    db.prepare(`
      INSERT INTO business_bot_user_states (chat_id, telegram_user_id, step, state_data_json, language, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(chat_id) DO UPDATE SET
        telegram_user_id = excluded.telegram_user_id,
        step = excluded.step,
        state_data_json = excluded.state_data_json,
        language = excluded.language,
        updated_at = CURRENT_TIMESTAMP
    `).run(chatId, String(telegramUserId), step, JSON.stringify(finalData), finalLang);
  } catch (err: any) {
    console.error('[Set State Error]:', err.message);
  }
}

export function clearBotUserState(db: DatabaseSync, chatId: string): void {
  try {
    db.prepare(`
      UPDATE business_bot_user_states 
      SET step = NULL, state_data_json = '{}', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?
    `).run(chatId);
  } catch (e) {}
}

// ========================================================
// 9. SUPER ADMIN APPLICATION APPROVAL / REJECTION
// ========================================================
export function approveBusinessApplication(
  db: DatabaseSync,
  applicationId: string,
  reviewerTelegramId: string,
  reviewerUserId?: string
): { success: boolean; message: string; business?: any; ownerUser?: any } {
  db.exec('BEGIN IMMEDIATE;');
  try {
    // 1. Validate application
    const app = db.prepare('SELECT * FROM business_applications WHERE id = ?').get(applicationId) as any;
    if (!app) {
      throw new Error('Ariza topilmadi');
    }
    if (app.status !== 'PENDING') {
      throw new Error(`Ushbu ariza allaqachon ko‘rib chiqilgan (Holat: ${app.status})`);
    }

    // 2. Check if owner user already exists by phone or create new user
    let owner = db.prepare('SELECT * FROM users WHERE phone = ? OR telegram_chat_id = ? LIMIT 1').get(app.owner_phone, app.telegram_chat_id) as any;
    if (!owner) {
      const ownerId = 'usr-owner-' + crypto.randomUUID().slice(0, 8);
      const email = `owner_${Date.now()}@navbatbor.uz`;
      const passHash = 'auth_tg_owner_' + crypto.randomBytes(8).toString('hex');
      
      db.prepare(`
        INSERT INTO users (id, name, email, phone, password_hash, role, status, telegram_chat_id)
        VALUES (?, ?, ?, ?, ?, 'BUSINESS_OWNER', 'ACTIVE', ?)
      `).run(ownerId, app.owner_name, email, app.owner_phone, passHash, app.telegram_chat_id);
      
      owner = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId) as any;
    } else {
      // Upgrade role if customer
      db.prepare(`
        UPDATE users 
        SET role = 'BUSINESS_OWNER', telegram_chat_id = ?, status = 'ACTIVE'
        WHERE id = ?
      `).run(app.telegram_chat_id, owner.id);
    }

    // 3. Generate unique slug
    const baseSlug = app.business_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'biz';
    let slug = baseSlug;
    let counter = 1;
    while (db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    // 4. Create Business with 14-day trial
    const bizId = 'biz-' + crypto.randomUUID().slice(0, 8);
    const trialExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO businesses (
        id, owner_id, name, slug, category_id, city_id, district, address, phone,
        description, status, is_verified, subscription_plan_code, subscription_expires_at,
        subscription_status, is_trial, trial_used, trial_started_at, telegram_chat_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 1, 'START', ?, 'TRIAL', 1, 1, CURRENT_TIMESTAMP, ?
      )
    `).run(
      bizId, owner.id, app.business_name, slug, app.category_id, app.city_id,
      app.district || 'Markaz', app.address, app.owner_phone, app.description || '',
      trialExpiry, app.telegram_chat_id
    );

    // 5. Create business membership
    const membershipId = 'bm-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO business_memberships (id, business_id, user_id, role, permissions)
      VALUES (?, ?, ?, 'OWNER', '["ALL"]')
    `).run(membershipId, bizId, owner.id);

    // 6. Create initial staff member
    const staffId = 'st-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO staff (id, business_id, user_id, name, title, phone, is_active, telegram_chat_id)
      VALUES (?, ?, ?, ?, 'Bosh mutaxassis / Egasi', ?, 1, ?)
    `).run(staffId, bizId, owner.id, app.owner_name, app.owner_phone, app.telegram_chat_id);

    // 7. Create default primary service
    const srvId = 'srv-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO services (id, business_id, name, description, price_uzs, duration_minutes, is_active)
      VALUES (?, ?, 'Standart qabul / Maslahat', 'Dastlabki ko‘rik va navbat asosida xizmat', 50000, 30, 1)
    `).run(srvId, bizId);

    // 8. Link staff to service
    db.prepare(`
      INSERT INTO staff_services (staff_id, service_id) VALUES (?, ?)
    `).run(staffId, srvId);

    // 9. Create default operating hours (Monday to Saturday 09:00 - 18:00)
    for (let day = 1; day <= 6; day++) {
      const bhId = `bh-${bizId}-${day}`;
      db.prepare(`
        INSERT OR IGNORE INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed)
        VALUES (?, ?, ?, '09:00', '18:00', 0)
      `).run(bhId, bizId, day);
    }
    // Sunday closed
    db.prepare(`
      INSERT OR IGNORE INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed)
      VALUES (?, ?, 0, '09:00', '18:00', 1)
    `).run(`bh-${bizId}-0`, bizId);

    // 10. Update application status
    db.prepare(`
      UPDATE business_applications
      SET status = 'APPROVED',
          reviewed_by_admin_id = ?,
          reviewed_by_telegram_id = ?,
          created_business_id = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reviewerUserId || 'usr-admin', String(reviewerTelegramId), bizId, applicationId);

    // 11. Audit log
    logBusinessBotAudit(db, 'APPLICATION_APPROVED', reviewerTelegramId, reviewerUserId, bizId, {
      application_id: applicationId,
      business_name: app.business_name,
      owner_name: app.owner_name,
      owner_phone: app.owner_phone
    });

    db.exec('COMMIT;');

    const createdBiz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId);
    return {
      success: true,
      message: 'Ariza muvaffaqiyatli tasdiqlandi va biznes yaratildi',
      business: createdBiz,
      ownerUser: owner
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, message: err.message };
  }
}

export function rejectBusinessApplication(
  db: DatabaseSync,
  applicationId: string,
  reviewerTelegramId: string,
  reason: string,
  reviewerUserId?: string
): { success: boolean; message: string; application?: any } {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const app = db.prepare('SELECT * FROM business_applications WHERE id = ?').get(applicationId) as any;
    if (!app) {
      throw new Error('Ariza topilmadi');
    }
    if (app.status !== 'PENDING') {
      throw new Error(`Ushbu ariza allaqachon ko‘rib chiqilgan (Holat: ${app.status})`);
    }

    db.prepare(`
      UPDATE business_applications
      SET status = 'REJECTED',
          rejection_reason = ?,
          reviewed_by_admin_id = ?,
          reviewed_by_telegram_id = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason || 'Ma’lumotlar talabga mos kelmadi', reviewerUserId || 'usr-admin', String(reviewerTelegramId), applicationId);

    logBusinessBotAudit(db, 'APPLICATION_REJECTED', reviewerTelegramId, reviewerUserId, applicationId, {
      rejection_reason: reason,
      business_name: app.business_name
    });

    db.exec('COMMIT;');
    return {
      success: true,
      message: 'Ariza rad etildi',
      application: app
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, message: err.message };
  }
}

// ========================================================
// 10. REAL BUSINESS DASHBOARD HANDLERS (SQLITE OPERATIONS)
// ========================================================
export function getBusinessDailyStats(db: DatabaseSync, businessId: string) {
  const waitingCount = (db.prepare(`
    SELECT count(*) as c FROM queue_entries
    WHERE business_id = ? AND status = 'WAITING'
      AND (date(joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(joined_at) >= datetime('now', '-18 hours'))
  `).get(businessId) as any)?.c || 0;

  const servingCount = (db.prepare(`
    SELECT count(*) as c FROM queue_entries
    WHERE business_id = ? AND status IN ('CALLED', 'SERVING', 'IN_SERVICE')
      AND (date(joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(joined_at) >= datetime('now', '-18 hours'))
  `).get(businessId) as any)?.c || 0;

  const completedToday = (db.prepare(`
    SELECT count(*) as c FROM queue_entries
    WHERE business_id = ? AND status = 'COMPLETED'
      AND (date(joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(joined_at) >= datetime('now', '-18 hours'))
  `).get(businessId) as any)?.c || 0;

  const bookingsToday = (db.prepare(`
    SELECT count(*) as c FROM bookings
    WHERE business_id = ? AND booking_date = date('now', '+5 hours')
  `).get(businessId) as any)?.c || 0;

  const revenueEstimate = (db.prepare(`
    SELECT COALESCE(SUM(b.total_price_uzs), 0) as s
    FROM bookings b
    WHERE b.business_id = ? AND b.booking_date = date('now', '+5 hours') AND b.status = 'COMPLETED'
  `).get(businessId) as any)?.s || 0;

  return {
    waitingCount,
    servingCount,
    completedToday,
    bookingsToday,
    revenueEstimate
  };
}

export function addWalkinCustomerViaBot(
  db: DatabaseSync,
  params: {
    businessId: string;
    customerName: string;
    customerPhone?: string;
    serviceId: string;
    staffId?: string;
    createdUserId?: string;
  }
): { success: boolean; entry?: any; message: string } {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(params.businessId) as any;
    if (!biz) throw new Error('Biznes topilmadi');

    const service = db.prepare('SELECT * FROM services WHERE id = ? AND business_id = ?').get(params.serviceId, params.businessId) as any;
    if (!service) throw new Error('Xizmat topilmadi');

    const activeCount = (db.prepare(`
      SELECT count(*) as count 
      FROM queue_entries 
      WHERE business_id = ? 
        AND (date(joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(joined_at) >= datetime('now', '-18 hours'))
    `).get(params.businessId) as any).count || 0;

    const letter = biz.name.charAt(0).toUpperCase() || 'A';
    const queueNumber = `${letter}-${(activeCount + 1).toString().padStart(3, '0')}`;
    const queueId = 'qe-' + crypto.randomUUID().slice(0, 8);

    // Create guest customer user record to satisfy foreign key
    const targetCustId = 'usr-walkin-' + crypto.randomUUID().slice(0, 8);
    const email = `walkin_${Date.now()}_${Math.floor(Math.random() * 1000)}@navbatbor.uz`;
    const passHash = 'walkin_' + crypto.randomBytes(6).toString('hex');
    db.prepare(`
      INSERT INTO users (id, name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')
    `).run(targetCustId, params.customerName, email, params.customerPhone || null, passHash);

    db.prepare(`
      INSERT INTO queue_entries (
        id, business_id, service_id, staff_id, customer_id, customer_name, customer_phone,
        queue_number, status, source, created_by_user_id, estimated_wait_minutes, people_ahead
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', 'WALK_IN', ?, ?, ?)
    `).run(
      queueId, params.businessId, params.serviceId, params.staffId || null,
      targetCustId, params.customerName, params.customerPhone || '', queueNumber,
      params.createdUserId || null,
      Math.max(5, activeCount * 15),
      activeCount
    );

    db.exec('COMMIT;');
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(queueId);

    try {
      botHooks.broadcastQueueUpdate?.(params.businessId, {
        type: 'QUEUE_JOINED',
        entry,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('[broadcastQueueUpdate Error]:', e);
    }

    return { success: true, entry, message: 'Mijoz navbatga muvaffaqiyatli qo‘shildi' };
  } catch (err: any) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    return { success: false, message: err.message };
  }
}

/**
 * Atomically call the next waiting customer for a business
 */
export function executeCallNextCustomerInBot(
  db: DatabaseSync,
  businessId: string,
  actorUserId?: string,
  actorTgId?: string
): { success: boolean; entry?: any; message: string } {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const nextWaiting = db.prepare(`
      SELECT q.*, s.name as service_name
      FROM queue_entries q
      JOIN services s ON q.service_id = s.id
      WHERE q.business_id = ? AND q.status = 'WAITING'
        AND (date(q.joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(q.joined_at) >= datetime('now', '-18 hours'))
      ORDER BY q.joined_at ASC LIMIT 1
    `).get(businessId) as any;

    if (!nextWaiting) {
      db.exec('COMMIT;');
      return { success: false, message: 'Navbatda kutayotgan mijoz yo‘q' };
    }

    // Complete any currently serving or called entries
    db.prepare(`
      UPDATE queue_entries 
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE business_id = ? AND status IN ('CALLED', 'SERVING', 'IN_SERVICE')
    `).run(businessId);

    // Call next customer
    db.prepare(`
      UPDATE queue_entries 
      SET status = 'CALLED', called_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextWaiting.id);

    logBusinessBotAudit(db, 'CALL_NEXT', actorTgId || 'system', actorUserId, nextWaiting.id, {
      queue_number: nextWaiting.queue_number,
      customer_name: nextWaiting.customer_name
    });

    db.exec('COMMIT;');

    const updatedEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(nextWaiting.id) as any;

    try {
      botHooks.broadcastQueueUpdate?.(businessId, {
        type: 'QUEUE_CALLED',
        entryId: nextWaiting.id,
        calledCustomer: updatedEntry,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('[broadcastQueueUpdate Error]:', e);
    }

    try {
      if (botHooks.notifyQueueCalled) {
        botHooks.notifyQueueCalled(nextWaiting.id).catch(err => {
          console.error('[notifyQueueCalled Error]:', err?.message);
        });
      }
    } catch (e) {}

    return { success: true, entry: updatedEntry, message: 'Mijoz muvaffaqiyatli chaqirildi' };
  } catch (err: any) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    return { success: false, message: err.message };
  }
}

/**
 * Mark active customer as served / completed
 */
export function executeMarkCustomerServedInBot(
  db: DatabaseSync,
  businessId: string,
  entryId?: string,
  actorUserId?: string,
  actorTgId?: string
): { success: boolean; entry?: any; message: string } {
  db.exec('BEGIN IMMEDIATE;');
  try {
    let target: any = null;
    if (entryId) {
      target = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND business_id = ?').get(entryId, businessId) as any;
    } else {
      target = db.prepare(`
        SELECT * FROM queue_entries
        WHERE business_id = ? AND status IN ('CALLED', 'SERVING', 'IN_SERVICE')
          AND (date(joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(joined_at) >= datetime('now', '-18 hours'))
        ORDER BY joined_at ASC LIMIT 1
      `).get(businessId) as any;
    }

    if (!target) {
      db.exec('COMMIT;');
      return { success: false, message: 'Xizmat ko‘rsatilayotgan mijoz topilmadi' };
    }

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(target.id);

    logBusinessBotAudit(db, 'MARK_SERVED', actorTgId || 'system', actorUserId, target.id, {
      queue_number: target.queue_number,
      customer_name: target.customer_name
    });

    db.exec('COMMIT;');

    const completedEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(target.id) as any;

    try {
      botHooks.broadcastQueueUpdate?.(businessId, {
        type: 'QUEUE_STATUS_UPDATED',
        entryId: target.id,
        status: 'COMPLETED',
        entry: completedEntry,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('[broadcastQueueUpdate Error]:', e);
    }

    return { success: true, entry: completedEntry, message: 'Xizmat muvaffaqiyatli yakunlandi' };
  } catch (err: any) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    return { success: false, message: err.message };
  }
}

/**
 * Cancel a queue entry
 */
export function executeCancelQueueEntryInBot(
  db: DatabaseSync,
  businessId: string,
  entryId: string,
  reason = 'Muassasa tomonidan bekor qilindi',
  actorUserId?: string,
  actorTgId?: string
): { success: boolean; entry?: any; message: string } {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND business_id = ?').get(entryId, businessId) as any;
    if (!entry) {
      db.exec('COMMIT;');
      return { success: false, message: 'Navbat topilmadi' };
    }

    db.prepare(`
      UPDATE queue_entries 
      SET status = 'CANCELLED'
      WHERE id = ?
    `).run(entryId);

    logBusinessBotAudit(db, 'CANCEL_QUEUE', actorTgId || 'system', actorUserId, entryId, {
      queue_number: entry.queue_number,
      customer_name: entry.customer_name,
      reason
    });

    db.exec('COMMIT;');

    const cancelledEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;

    try {
      botHooks.broadcastQueueUpdate?.(businessId, {
        type: 'QUEUE_STATUS_UPDATED',
        entryId,
        status: 'CANCELLED',
        entry: cancelledEntry,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('[broadcastQueueUpdate Error]:', e);
    }

    return { success: true, entry: cancelledEntry, message: 'Navbat bekor qilindi' };
  } catch (err: any) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    return { success: false, message: err.message };
  }
}

/**
 * Link an existing business to this Telegram account via verified phone number
 */
export function linkBusinessByPhone(
  db: DatabaseSync,
  rawPhone: string,
  telegramUserId: string,
  telegramChatId: string
): { success: boolean; message: string; business?: any } {
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9) {
    return { success: false, message: 'Telefon raqami noto‘g‘ri kiritildi' };
  }

  const last9 = cleanPhone.slice(-9);
  const formatted = `+998${last9}`;

  // 1. Check in businesses table
  let biz = db.prepare(`
    SELECT b.* FROM businesses b
    WHERE (b.phone LIKE ? OR b.phone LIKE ?)
      AND b.status IN ('APPROVED', 'ACTIVE')
    ORDER BY b.created_at DESC LIMIT 1
  `).get(`%${last9}`, formatted) as any;

  // 2. Check in users table
  if (!biz) {
    const ownerUser = db.prepare(`
      SELECT u.id FROM users u
      WHERE (u.phone LIKE ? OR u.phone LIKE ?)
        AND u.role IN ('BUSINESS_OWNER', 'ADMIN', 'MANAGER')
      ORDER BY u.created_at DESC LIMIT 1
    `).get(`%${last9}`, formatted) as any;

    if (ownerUser) {
      biz = db.prepare(`
        SELECT b.* FROM businesses b
        WHERE b.owner_id = ? AND b.status IN ('APPROVED', 'ACTIVE')
        ORDER BY b.created_at DESC LIMIT 1
      `).get(ownerUser.id) as any;
    }
  }

  // 3. Check staff table
  if (!biz) {
    const staffMember = db.prepare(`
      SELECT st.business_id FROM staff st
      JOIN businesses b ON st.business_id = b.id
      WHERE (st.phone LIKE ? OR st.phone LIKE ?)
        AND st.is_active = 1 AND b.status IN ('APPROVED', 'ACTIVE')
      LIMIT 1
    `).get(`%${last9}`, formatted) as any;

    if (staffMember) {
      biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(staffMember.business_id) as any;
    }
  }

  if (!biz) {
    return { success: false, message: 'Ushbu telefon raqamiga biriktirilgan faol biznes topilmadi' };
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      UPDATE businesses 
      SET telegram_chat_id = ?, telegram_user_id = ?
      WHERE id = ?
    `).run(String(telegramChatId), String(telegramUserId), biz.id);

    if (biz.owner_id) {
      db.prepare(`
        UPDATE users
        SET telegram_chat_id = ?, telegram_user_id = ?
        WHERE id = ?
      `).run(String(telegramChatId), String(telegramUserId), biz.owner_id);
    }

    db.prepare(`
      UPDATE staff
      SET telegram_chat_id = ?, telegram_user_id = ?
      WHERE business_id = ? AND (phone LIKE ? OR user_id = ?)
    `).run(String(telegramChatId), String(telegramUserId), biz.id, `%${last9}`, biz.owner_id || '');

    logBusinessBotAudit(db, 'BUSINESS_LINKED', telegramUserId, biz.owner_id, biz.id, {
      phone: rawPhone,
      business_name: biz.name
    });

    db.exec('COMMIT;');
    const updatedBiz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(biz.id);
    return { success: true, message: 'Biznes muvaffaqiyatli bog‘landi', business: updatedBiz };
  } catch (err: any) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    return { success: false, message: err.message };
  }
}

// ========================================================
// 11. UNIFIED BUSINESS BOT UPDATE PROCESSOR
// ========================================================
export async function processBusinessBotUpdate(update: any, db: DatabaseSync): Promise<void> {
  if (!update) return;

  // Deduplication of updates
  if (update.update_id) {
    try {
      const exists = db.prepare('SELECT update_id FROM processed_business_bot_updates WHERE update_id = ?').get(update.update_id);
      if (exists) return;
      db.prepare('INSERT OR IGNORE INTO processed_business_bot_updates (update_id) VALUES (?)').run(update.update_id);
    } catch (e) {}
  }

  // A. HANDLE CALLBACK QUERIES
  if (update.callback_query) {
    await handleBusinessBotCallback(update.callback_query, db);
    return;
  }

  // B. HANDLE MESSAGES
  if (update.message) {
    await handleBusinessBotMessage(update.message, db);
    return;
  }
}

// ========================================================
// 12. MESSAGE HANDLER & STATE MACHINE
// ========================================================
async function handleBusinessBotMessage(msg: any, db: DatabaseSync): Promise<void> {
  const chatId = String(msg.chat?.id);
  const tgUserId = String(msg.from?.id || chatId);
  const text = (msg.text || '').trim();

  const auth = getBusinessBotUserAuth(db, tgUserId, chatId);
  const lang = auth.language;

  // 1. BLOCKED check: if blocked, refuse all actions
  if (auth.role === 'BLOCKED') {
    await sendBusinessBotMessage(chatId, t(lang, 'blocked_notice'));
    return;
  }

  // 2. Global /cancel command
  if (text === '/cancel' || text === '❌ Bekor qilish' || text === '❌ Отмена') {
    clearBotUserState(db, chatId);
    if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE' || auth.role === 'SUPER_ADMIN') {
      await sendBusinessBotMessage(chatId, '✅ Amal bekor qilindi. Boshqaruv menyusi:', {
        replyMarkup: getBusinessDashboardKeyboard(lang, auth.role)
      });
    } else {
      await sendBusinessBotMessage(chatId, '✅ Amal bekor qilindi.', {
        replyMarkup: getGuestKeyboard(lang, auth.role === 'PENDING_APPLICANT')
      });
    }
    return;
  }

  // 3. Language switcher
  if (text === '🇺🇿 O‘zbekcha' || text === '/lang_uz') {
    setBotUserState(db, chatId, tgUserId, null, undefined, 'uz');
    await sendBusinessBotMessage(chatId, '🇺🇿 Til o‘zbek tiliga o‘zgartirildi.');
    if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE' || auth.role === 'SUPER_ADMIN') {
      await sendBusinessBotMessage(chatId, 'Boshqaruv menyusi:', { replyMarkup: getBusinessDashboardKeyboard('uz', auth.role) });
    } else {
      await sendBusinessBotMessage(chatId, 'Bosh menyu:', { replyMarkup: getGuestKeyboard('uz', auth.role === 'PENDING_APPLICANT') });
    }
    return;
  }

  if (text === '🇷🇺 Русский' || text === '/lang_ru') {
    setBotUserState(db, chatId, tgUserId, null, undefined, 'ru');
    await sendBusinessBotMessage(chatId, '🇷🇺 Язык изменен на русский.');
    if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE' || auth.role === 'SUPER_ADMIN') {
      await sendBusinessBotMessage(chatId, 'Панель управления:', { replyMarkup: getBusinessDashboardKeyboard('ru', auth.role) });
    } else {
      await sendBusinessBotMessage(chatId, 'Главное меню:', { replyMarkup: getGuestKeyboard('ru', auth.role === 'PENDING_APPLICANT') });
    }
    return;
  }

  // 3b. Web Browser Auth / Session Confirmation Deep Link (/start auth_xxx, /start reg_xxx, /start login_xxx)
  if (text.startsWith('/start auth_') || text.startsWith('/start reg_') || text.startsWith('/start login_')) {
    const sessionId = text.replace('/start ', '').trim();
    const session = db.prepare('SELECT * FROM telegram_auth_sessions WHERE id = ?').get(sessionId) as any;

    if (!session) {
      await sendBusinessBotMessage(
        chatId,
        `⚠️ <b>Sessiya topilmadi</b>\nKirish yoki tasdiqlash havolasi eskirgan yoki xato. Iltimos, saytga qaytib yangi havola oling.`
      );
      return;
    }

    if (session.status === 'EXPIRED' || parseSessionExpiryDate(session.expires_at) < new Date()) {
      db.prepare("UPDATE telegram_auth_sessions SET status = 'EXPIRED' WHERE id = ?").run(sessionId);
      await sendBusinessBotMessage(
        chatId,
        `⏳ <b>Havola muddati tugagan</b>\nUshbu tasdiqlash sessiyasi 5 daqiqadan ko‘proq vaqt oldin yaratilgan. Iltimos, saytga qaytib «Qayta urinish» tugmasini bosing.`
      );
      return;
    }

    if (session.status === 'CONFIRMED') {
      await sendBusinessBotMessage(
        chatId,
        `ℹ️ <b>Ushbu sessiya allaqachon tasdiqlangan</b>\nSaytdagi brauzeringizga qaytib xizmatlardan foydalanishingiz mumkin.`
      );
      return;
    }

    const hooks = getBusinessBotHooks();
    const { token, user } = hooks.authenticateTelegramUser
      ? hooks.authenticateTelegramUser(chatId, {
          first_name: msg.from?.first_name,
          last_name: msg.from?.last_name,
          username: msg.from?.username
        })
      : fallbackAuthenticateTelegramUser(db, chatId, msg.from);

    // Link Telegram account to business or business_applications if matched
    try {
      if (user?.id) {
        db.prepare(`
          UPDATE businesses 
          SET telegram_chat_id = COALESCE(telegram_chat_id, ?),
              telegram_user_id = COALESCE(telegram_user_id, ?)
          WHERE owner_id = ?
        `).run(chatId, tgUserId, user.id);

          db.prepare(`
            UPDATE business_applications 
            SET telegram_chat_id = COALESCE(telegram_chat_id, ?),
                telegram_user_id = COALESCE(telegram_user_id, ?)
            WHERE owner_phone = ? OR created_business_id IN (SELECT id FROM businesses WHERE owner_id = ?)
          `).run(chatId, tgUserId, user.phone || '', user.id);
      }
    } catch (e) {}

    db.prepare("UPDATE telegram_auth_sessions SET status = 'CONFIRMED', user_id = ?, token = ? WHERE id = ?")
      .run(user.id, token, sessionId);

    const appUrl = getBusinessPlatformAppUrl(db);
    const returnUrl = `${appUrl}/?auth_session=${sessionId}`;
    await sendBusinessBotMessage(
      chatId,
      `✅ <b>Muvaffaqiyatli tasdiqlandi!</b>\n━━━━━━━━━━━━━━━━\nAssalomu alaykum, <b>${msg.from?.first_name || user.name}</b>!\n\nSiz NavbatBor Biznes platformasiga Telegram (@${getBusinessBotUsername()}) orqali muvaffaqiyatli kirdingiz.\n\nEndi brauzerdagi saytga qaytsangiz, avtomatik profilingizga kirilganini ko‘rasiz.`,
      {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🌐 Saytga o‘tish', url: returnUrl }],
            [{ text: '📱 NavbatBor ilovasini ochish', web_app: { url: returnUrl } }]
          ]
        }
      }
    );
    return;
  }

  // 3c. 6-digit confirmation code verification
  if (/^\d{6}$/.test(text.trim())) {
    const code = text.trim();
    const session = db.prepare('SELECT * FROM telegram_auth_sessions WHERE code = ?').get(code) as any;
    if (session) {
      if (session.status === 'EXPIRED' || parseSessionExpiryDate(session.expires_at) < new Date()) {
        db.prepare("UPDATE telegram_auth_sessions SET status = 'EXPIRED' WHERE id = ?").run(session.id);
        await sendBusinessBotMessage(
          chatId,
          `⏳ <b>Kiritilgan kod muddati tugagan</b>\nIltimos, saytdan yangi tasdiqlash kodi oling.`
        );
        return;
      }

      if (session.status === 'CONFIRMED') {
        await sendBusinessBotMessage(
          chatId,
          `ℹ️ <b>Ushbu kod allaqachon tasdiqlangan</b>\nBrauzerdagi sahifangizga qaytib xizmatlardan foydalanishingiz mumkin.`
        );
        return;
      }

      const hooks = getBusinessBotHooks();
      const { token, user } = hooks.authenticateTelegramUser
        ? hooks.authenticateTelegramUser(chatId, {
            first_name: msg.from?.first_name,
            last_name: msg.from?.last_name,
            username: msg.from?.username
          })
        : fallbackAuthenticateTelegramUser(db, chatId, msg.from);

      try {
        if (user?.id) {
          db.prepare(`
            UPDATE businesses 
            SET telegram_chat_id = COALESCE(telegram_chat_id, ?),
                telegram_user_id = COALESCE(telegram_user_id, ?)
            WHERE owner_id = ?
          `).run(chatId, tgUserId, user.id);

          db.prepare(`
            UPDATE business_applications 
            SET telegram_chat_id = COALESCE(telegram_chat_id, ?),
                telegram_user_id = COALESCE(telegram_user_id, ?)
            WHERE owner_phone = ? OR created_business_id IN (SELECT id FROM businesses WHERE owner_id = ?)
          `).run(chatId, tgUserId, user.phone || '', user.id);
        }
      } catch (e) {}

      db.prepare("UPDATE telegram_auth_sessions SET status = 'CONFIRMED', user_id = ?, token = ? WHERE id = ?")
        .run(user.id, token, session.id);

      const appUrl = getBusinessPlatformAppUrl(db);
      const returnUrl = `${appUrl}/?auth_session=${session.id}`;
      await sendBusinessBotMessage(
        chatId,
        `✅ <b>Kodingiz tasdiqlandi!</b>\nAssalomu alaykum, <b>${msg.from?.first_name || user.name}</b>!\n\nSaytdagi sessiyangiz faollashdi. Brauzerga qaytib biznesingizni boshqarishingiz mumkin.`,
        {
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🌐 Saytga o‘tish', url: returnUrl }],
              [{ text: '📱 NavbatBor ilovasini ochish', web_app: { url: returnUrl } }]
            ]
          }
        }
      );
      return;
    }
  }

  // 4. /start command
  if (text === '/start' || text.startsWith('/start@') || text === '/menu' || text === '/start help') {
    clearBotUserState(db, chatId);

    if (auth.role === 'SUPER_ADMIN') {
      const pendingCount = (db.prepare("SELECT count(*) as c FROM business_applications WHERE status = 'PENDING'").get() as any)?.c || 0;
      await sendBusinessBotMessage(
        chatId,
        `👑 <b>Assalomu alaykum, Super Administrator!</b>\n\n` +
        `Siz NavbatBor platformasining bosh boshqaruvchisiz.\n` +
        `🟡 Ko‘rib chiqish kutilayotgan arizalar: <b>${pendingCount} ta</b>\n\n` +
        `👇 Boshqaruv menyusidan foydalanishingiz mumkin:`,
        { replyMarkup: getBusinessDashboardKeyboard(lang, 'SUPER_ADMIN') }
      );
      return;
    }

    if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE') {
      const biz = auth.business;
      const stats = getBusinessDailyStats(db, biz.id);
      await sendBusinessBotMessage(
        chatId,
        `🏢 <b>${biz.name}</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👤 Vakolatingiz: <b>${auth.role}</b>\n` +
        `⚡️ Tarif: <b>${biz.subscription_plan_code || 'START'}</b> (${biz.subscription_status || 'TRIAL'})\n\n` +
        `📊 <b>Bugungi holat:</b>\n` +
        `• 🟢 Xizmatda: <b>${stats.servingCount} nafar</b>\n` +
        `• ⏳ Navbatda kutayotgan: <b>${stats.waitingCount} nafar</b>\n` +
        `• ✅ Bugun xizmat ko‘rsatilgan: <b>${stats.completedToday} nafar</b>\n` +
        `• 📅 Bugungi bronlar: <b>${stats.bookingsToday} ta</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👇 Kerakli bo‘limni tanlang:`,
        { replyMarkup: getBusinessDashboardKeyboard(lang, auth.role) }
      );
      return;
    }

    if (auth.role === 'PENDING_APPLICANT') {
      const app = auth.pendingApplication;
      await sendBusinessBotMessage(
        chatId,
        t(lang, 'pending_notice', {
          biz_name: app.business_name,
          created_at: app.created_at?.slice(0, 16) || ''
        }),
        { replyMarkup: getGuestKeyboard(lang, true) }
      );
      return;
    }

    if (auth.role === 'REJECTED_APPLICANT') {
      const app = auth.pendingApplication;
      await sendBusinessBotMessage(
        chatId,
        t(lang, 'rejected_notice', {
          biz_name: app.business_name,
          reason: app.rejection_reason || 'Ma’lumotlar talabga mos kelmadi'
        }),
        { replyMarkup: getGuestKeyboard(lang, false) }
      );
      return;
    }

    // GUEST FLOW
    await sendBusinessBotMessage(
      chatId,
      t(lang, 'welcome_guest'),
      { replyMarkup: getGuestKeyboard(lang, false) }
    );
    return;
  }

  // 5. Check status command
  if (text === t(lang, 'btn_check_status') || text === '/status') {
    if (auth.pendingApplication) {
      const app = auth.pendingApplication;
      if (app.status === 'PENDING') {
        await sendBusinessBotMessage(chatId, t(lang, 'pending_notice', {
          biz_name: app.business_name,
          created_at: app.created_at?.slice(0, 16) || ''
        }), { replyMarkup: getGuestKeyboard(lang, true) });
      } else if (app.status === 'REJECTED') {
        await sendBusinessBotMessage(chatId, t(lang, 'rejected_notice', {
          biz_name: app.business_name,
          reason: app.rejection_reason || 'Ma’lumotlar talabga mos kelmadi'
        }), { replyMarkup: getGuestKeyboard(lang, false) });
      } else {
        await sendBusinessBotMessage(chatId, `ℹ️ Ariza holati: <b>${app.status}</b>`);
      }
    } else {
      await sendBusinessBotMessage(chatId, 'ℹ️ Sizda ko‘rib chiqilayotgan ariza mavjud emas.', {
        replyMarkup: getGuestKeyboard(lang, false)
      });
    }
    return;
  }

  // 6. Link existing business flow
  const userState = getBotUserState(db, chatId);

  if (text === t(lang, 'btn_link_biz') || text === '/link') {
    if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE') {
      await sendBusinessBotMessage(chatId, `ℹ️ Siz allaqachon <b>${auth.business?.name}</b> biznesiga ulangansiz.`, {
        replyMarkup: getBusinessDashboardKeyboard(lang, auth.role)
      });
      return;
    }

    setBotUserState(db, chatId, tgUserId, 'LINK_PHONE', {}, lang);
    await sendBusinessBotMessage(chatId, t(lang, 'link_prompt'), {
      replyMarkup: {
        keyboard: [
          [{ text: t(lang, 'btn_send_contact'), request_contact: true }],
          [{ text: '❌ Bekor qilish' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // Handle phone submission for linking
  if (userState.step === 'LINK_PHONE') {
    let phone = '';
    if (msg.contact && msg.contact.phone_number) {
      phone = msg.contact.phone_number;
    } else if (text) {
      phone = text.replace(/[^0-9+]/g, '');
    }

    if (!phone || phone.length < 7) {
      await sendBusinessBotMessage(chatId, '⚠️ Iltimos, telefon raqamingizni to‘g‘ri formatda yuboring (masalan: +998901234567):');
      return;
    }

    const linkRes = linkBusinessByPhone(db, phone, tgUserId, chatId);
    clearBotUserState(db, chatId);

    if (linkRes.success && linkRes.business) {
      await sendBusinessBotMessage(
        chatId,
        t(lang, 'link_success', { biz_name: linkRes.business.name }),
        { replyMarkup: getBusinessDashboardKeyboard(lang, 'BUSINESS_OWNER') }
      );
    } else {
      await sendBusinessBotMessage(
        chatId,
        t(lang, 'link_not_found'),
        { replyMarkup: getGuestKeyboard(lang, auth.role === 'PENDING_APPLICANT') }
      );
    }
    return;
  }

  // Help & Support (Available for guests and all roles)
  if (text === t(lang, 'btn_help') || text === '🆘 Yordam va ma’lumot' || text === '🆘 Помощь и информация' || text === 'ℹ️ Yordam va ma’lumot' || text === '/help') {
    await sendBusinessBotMessage(
      chatId,
      `ℹ️ <b>NAVBATBOR BIZNES EGASI BOTI</b>\n━━━━━━━━━━━━━━━━\n` +
      `Ushbu bot orqali Qarshi shahridagi xizmat ko‘rsatish maskaningizni (klinika, go‘zallik saloni, avtoservis va boshqalar) NavbatBor tizimiga ulashingiz, arizangiz holatini kuzatishingiz va tasdiqlangach navbatlarni boshqarishingiz mumkin.\n\n` +
      `📞 <b>Texnik qo‘llab-quvvatlash:</b>\n` +
      `• Telefon: <b>+998200232540</b>\n` +
      `• Telegram: <b>@mansur_0511</b>\n` +
      `• Email: <b>mansurnuriddin24@gmail.com</b>\n\n` +
      `🌐 <b>Rasmiy sayt:</b> https://navbatbor.uz`
    );
    return;
  }

  // ========================================================
  // GUEST / REGISTRATION FLOW STATE MACHINE
  // ========================================================
  if (text === t(lang, 'btn_register') || text === '/register' || text === t(lang, 'btn_reapply')) {
    if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE') {
      await sendBusinessBotMessage(chatId, 'ℹ️ Siz allaqachon ro‘yxatdan o‘tgan biznes egasisiz.', {
        replyMarkup: getBusinessDashboardKeyboard(lang, auth.role)
      });
      return;
    }

    if (auth.role === 'PENDING_APPLICANT') {
      await sendBusinessBotMessage(chatId, t(lang, 'pending_notice', {
        biz_name: auth.pendingApplication.business_name,
        created_at: auth.pendingApplication.created_at?.slice(0, 16) || ''
      }));
      return;
    }

    // Start Step 1
    setBotUserState(db, chatId, tgUserId, 'REG_BIZ_NAME', {
      telegram_user_id: tgUserId,
      telegram_chat_id: chatId,
      telegram_username: msg.from?.username || ''
    }, lang);

    await sendBusinessBotMessage(chatId, t(lang, 'reg_step1_name'), {
      replyMarkup: {
        keyboard: [[{ text: '❌ Bekor qilish' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // Step 1 -> Step 2
  if (userState.step === 'REG_BIZ_NAME') {
    if (text.length < 2) {
      await sendBusinessBotMessage(chatId, '⚠️ Biznes nomi kamida 2 ta belgidan iborat bo‘lishi lozim:');
      return;
    }
    userState.data.business_name = text;
    setBotUserState(db, chatId, tgUserId, 'REG_OWNER_NAME', userState.data, lang);
    await sendBusinessBotMessage(chatId, t(lang, 'reg_step2_owner'));
    return;
  }

  // Step 2 -> Step 3
  if (userState.step === 'REG_OWNER_NAME') {
    if (text.length < 3) {
      await sendBusinessBotMessage(chatId, '⚠️ Ism-sharif kamida 3 ta belgidan iborat bo‘lishi kerak:');
      return;
    }
    userState.data.owner_name = text;
    setBotUserState(db, chatId, tgUserId, 'REG_PHONE', userState.data, lang);
    await sendBusinessBotMessage(chatId, t(lang, 'reg_step3_phone'), {
      replyMarkup: {
        keyboard: [
          [{ text: t(lang, 'btn_send_contact'), request_contact: true }],
          [{ text: '❌ Bekor qilish' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // Step 3 -> Step 4 (Phone or Contact)
  if (userState.step === 'REG_PHONE') {
    let phone = '';
    if (msg.contact && msg.contact.phone_number) {
      phone = msg.contact.phone_number;
    } else if (text) {
      phone = text.replace(/[^0-9+]/g, '');
    }

    if (!phone || phone.length < 7) {
      await sendBusinessBotMessage(chatId, '⚠️ Iltimos, haqiqiy telefon raqamingizni yuboring (masalan: +998901234567):');
      return;
    }

    if (!phone.startsWith('+')) phone = '+' + phone;
    userState.data.owner_phone = phone;

    // Fetch categories from DB
    const categories = db.prepare('SELECT id, name FROM categories WHERE active = 1 ORDER BY name ASC LIMIT 10').all() as any[];
    const inlineButtons = categories.map(cat => [{ text: cat.name, callback_data: `reg_cat_${cat.id}` }]);

    setBotUserState(db, chatId, tgUserId, 'REG_CATEGORY', userState.data, lang);
    await sendBusinessBotMessage(chatId, t(lang, 'reg_step4_category'), {
      replyMarkup: { inline_keyboard: inlineButtons }
    });
    return;
  }

  // Step 6 -> Step 7 (Address)
  if (userState.step === 'REG_ADDRESS') {
    if (text.length < 5) {
      await sendBusinessBotMessage(chatId, '⚠️ Manzilni to‘liqroq yozing:');
      return;
    }
    userState.data.address = text;
    setBotUserState(db, chatId, tgUserId, 'REG_DESC', userState.data, lang);
    await sendBusinessBotMessage(chatId, t(lang, 'reg_step7_desc'), {
      replyMarkup: {
        keyboard: [
          [{ text: t(lang, 'btn_skip') }],
          [{ text: '❌ Bekor qilish' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // Step 7 -> Summary Confirmation
  if (userState.step === 'REG_DESC') {
    userState.data.description = (text === t(lang, 'btn_skip') || text === '⏩ Пропустить') ? '' : text;
    setBotUserState(db, chatId, tgUserId, 'REG_CONFIRM', userState.data, lang);

    const catName = (db.prepare('SELECT name FROM categories WHERE id = ?').get(userState.data.category_id) as any)?.name || 'Kategoriya';
    const cityName = (db.prepare('SELECT name FROM cities WHERE id = ?').get(userState.data.city_id) as any)?.name || 'Shahar';

    const summary = t(lang, 'reg_confirm_title', {
      biz_name: userState.data.business_name,
      owner_name: userState.data.owner_name,
      phone: userState.data.owner_phone,
      category: catName,
      city: cityName,
      address: userState.data.address,
      description: userState.data.description || 'Kiritilmagan'
    });

    await sendBusinessBotMessage(chatId, summary, {
      replyMarkup: {
        keyboard: [
          [{ text: t(lang, 'btn_submit_app') }],
          [{ text: '❌ Bekor qilish' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // Step 8 -> Save & Submit
  if (userState.step === 'REG_CONFIRM' && text === t(lang, 'btn_submit_app')) {
    const d = userState.data;
    const appId = 'app-' + crypto.randomUUID().slice(0, 10);

    const existing = db.prepare("SELECT id FROM business_applications WHERE telegram_user_id = ? AND status = 'PENDING'").get(tgUserId);
    if (existing) {
      await sendBusinessBotMessage(chatId, '⚠️ Siz allaqachon ariza topshirgansiz. U ko‘rib chiqilmoqda.', {
        replyMarkup: getGuestKeyboard(lang, true)
      });
      clearBotUserState(db, chatId);
      return;
    }

    db.prepare(`
      INSERT INTO business_applications (
        id, telegram_user_id, telegram_chat_id, telegram_username, business_name,
        owner_name, owner_phone, category_id, city_id, district, address, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Markaz', ?, ?, 'PENDING')
    `).run(
      appId, tgUserId, chatId, d.telegram_username || '', d.business_name,
      d.owner_name, d.owner_phone, d.category_id, d.city_id, d.address, d.description || ''
    );

    logBusinessBotAudit(db, 'REGISTER_SUBMITTED', tgUserId, null, appId, {
      business_name: d.business_name,
      owner_name: d.owner_name
    });

    clearBotUserState(db, chatId);

    await sendBusinessBotMessage(chatId, t(lang, 'app_submitted'), {
      replyMarkup: getGuestKeyboard(lang, true)
    });

    const catName = (db.prepare('SELECT name FROM categories WHERE id = ?').get(d.category_id) as any)?.name || 'Kategoriya';
    const cityName = (db.prepare('SELECT name FROM cities WHERE id = ?').get(d.city_id) as any)?.name || 'Shahar';
    const adminMsg = t('uz', 'admin_new_app_title', {
      biz_name: d.business_name,
      owner_name: d.owner_name,
      phone: d.owner_phone,
      category: catName,
      city: cityName,
      address: d.address,
      tg_id: tgUserId,
      tg_user: d.telegram_username || 'mavjud_emas',
      created_at: new Date().toISOString().slice(0, 16)
    });

    const superAdminIds = getSuperAdminTelegramIds();
    for (const adminTgId of superAdminIds) {
      await sendBusinessBotMessage(adminTgId, adminMsg, {
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Tasdiqlash (Approve)', callback_data: `admin_appr_${appId}` },
              { text: '❌ Rad etish (Reject)', callback_data: `admin_rejc_${appId}` }
            ],
            [
              { text: 'ℹ️ Tafsilotlar', callback_data: `admin_view_${appId}` }
            ]
          ]
        }
      });
    }
    return;
  }

  // ========================================================
  // BUSINESS DASHBOARD BUTTONS (FOR APPROVED OWNERS/STAFF)
  // ========================================================
  if (auth.role === 'BUSINESS_OWNER' || auth.role === 'MANAGER' || auth.role === 'EMPLOYEE' || auth.role === 'SUPER_ADMIN') {
    const biz = auth.business;

    // Super Admin: Pending Applications & Approvals
    if (auth.role === 'SUPER_ADMIN' && (
      text.startsWith('📝 Kutayotgan arizalar') || 
      text === '👑 Super Admin Boshqaruvi' || 
      text === '/arizalar' || 
      text === '/pending'
    )) {
      const pendingApps = db.prepare(`
        SELECT a.*, COALESCE(c.name, 'Boshqa xizmatlar') as category_name, COALESCE(ct.name, 'Qarshi') as city_name
        FROM business_applications a
        LEFT JOIN categories c ON (a.category_id = c.id OR a.category_id = c.slug)
        LEFT JOIN cities ct ON (a.city_id = ct.id OR a.city_id = ct.name)
        WHERE a.status = 'PENDING'
        ORDER BY a.created_at DESC LIMIT 10
      `).all() as any[];

      const pendingBizs = db.prepare(`
        SELECT b.*, COALESCE(u.name, 'Noma’lum') as owner_name, COALESCE(u.phone, b.phone) as owner_phone,
               COALESCE(c.name, 'Boshqa xizmatlar') as category_name, COALESCE(ct.name, 'Qarshi') as city_name
        FROM businesses b
        LEFT JOIN users u ON b.owner_id = u.id
        LEFT JOIN categories c ON (b.category_id = c.id OR b.category_id = c.slug)
        LEFT JOIN cities ct ON (b.city_id = ct.id OR b.city_id = ct.name)
        WHERE b.status = 'PENDING'
        ORDER BY b.created_at DESC LIMIT 10
      `).all() as any[];

      const totalPending = pendingApps.length + pendingBizs.length;
      if (totalPending === 0) {
        await sendBusinessBotMessage(
          chatId,
          `✅ <b>Hozirda tasdiq kutayotgan biznes arizalari mavjud emas.</b>\nBarcha muassasalar ko‘rib chiqilgan va faol.`,
          { replyMarkup: getBusinessDashboardKeyboard(lang, 'SUPER_ADMIN') }
        );
        return;
      }

      await sendBusinessBotMessage(
        chatId,
        `📝 <b>Tasdiq Kutayotgan Biznes Arizalari (${totalPending} ta):</b>\n━━━━━━━━━━━━━━━━\nQuyidagi har bir muassasani ko‘rib chiqib, 1 bosishda tasdiqlashingiz yoki rad etishingiz mumkin:`
      );

      for (const app of pendingApps) {
        const appCard = 
          `🏢 <b>${app.business_name}</b>\n` +
          `📂 Kategoriya: <b>${app.category_name}</b>\n` +
          `📍 Manzil: <b>${app.city_name}, ${app.district ? `${app.district}, ` : ''}${app.address}</b>\n` +
          `👤 Rahbar: <b>${app.owner_name}</b>\n` +
          `📞 Telefon: <b>${app.owner_phone}</b>\n` +
          `📅 Topshirildi: <b>${app.created_at}</b>\n` +
          `⏳ Holati: <b>TASDIQLASH KUTILMOQDA</b>`;

        await sendBusinessBotMessage(chatId, appCard, {
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Tasdiqlash', callback_data: `admin_appr_${app.id}` },
                { text: '❌ Rad etish', callback_data: `admin_rejc_${app.id}` }
              ]
            ]
          }
        });
      }

      for (const pb of pendingBizs) {
        if (pendingApps.some(a => a.created_business_id === pb.id || a.id === pb.id)) continue;
        const bizCard = 
          `🏢 <b>${pb.name}</b>\n` +
          `📂 Kategoriya: <b>${pb.category_name}</b>\n` +
          `📍 Manzil: <b>${pb.city_name}, ${pb.district ? `${pb.district}, ` : ''}${pb.address}</b>\n` +
          `👤 Rahbar: <b>${pb.owner_name}</b>\n` +
          `📞 Telefon: <b>${pb.owner_phone || pb.phone}</b>\n` +
          `📅 Topshirildi: <b>${pb.created_at}</b>\n` +
          `⏳ Holati: <b>TASDIQLASH KUTILMOQDA</b>`;

        await sendBusinessBotMessage(chatId, bizCard, {
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Tasdiqlash', callback_data: `admin_approve_biz_${pb.id}` },
                { text: '❌ Rad etish', callback_data: `admin_reject_biz_${pb.id}` }
              ]
            ]
          }
        });
      }
      return;
    }

    // 0. 🟢 KEYINGI MIJOZNI CHAQIRISH (Primary single-tap action)
    if (
      text === t(lang, 'btn_menu_call_next') ||
      text === '🟢 KEYINGI MIJOZNI CHAQIRISH' ||
      text === '🟢 Keyingi mijozni chaqirish' ||
      text === t(lang, 'btn_menu_next') ||
      text === '➡️ Keyingi mijoz' ||
      text === '➡️ Следующий клиент' ||
      text === '🟢 ВЫЗВАТЬ СЛЕДУЮЩЕГО' ||
      text === '/next'
    ) {
      if (!biz) return;
      const res = executeCallNextCustomerInBot(db, biz.id, auth.user?.id, tgUserId);
      if (res.success && res.entry) {
        await sendBusinessBotMessage(
          chatId,
          `📢 <b>KEYINGI MIJOZ CHAQIRILDI!</b>\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Navbat raqami: <b>#${res.entry.queue_number}</b>\n` +
          `👤 Mijoz: <b>${res.entry.customer_name}</b>\n` +
          `🩺 Xizmat: <b>${res.entry.service_name || 'Xizmat'}</b>\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `<i>Sayt va TV monitor ekranda jonli yangilandi.</i>`,
          {
            replyMarkup: {
              inline_keyboard: [
                [{ text: '✅ Mijoz keldi (Xizmatda)', callback_data: `biz_q_serve_${res.entry.id}` }],
                [{ text: '🏁 Xizmatni yakunlash', callback_data: `biz_q_complete_${res.entry.id}` }],
                [{ text: '🔄 Qayta chaqirish', callback_data: `biz_recall_${res.entry.id}` }],
                [{ text: '❌ Kelmadi (O‘tkazib yuborish)', callback_data: `biz_q_noshow_${res.entry.id}` }],
                [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }]
              ]
            }
          }
        );
      } else {
        await sendBusinessBotMessage(chatId, `ℹ️ ${res.message || 'Hozircha navbatda kutayotgan mijozlar yo‘q.'}`);
      }
      return;
    }

    // 1. 👤 Hozirgi mijoz
    if (
      text === t(lang, 'btn_menu_current') ||
      text === '👤 Hozirgi mijoz' ||
      text === '👤 Текущий клиент' ||
      text === '/current'
    ) {
      if (!biz) return;
      const currentServing = db.prepare(`
        SELECT q.*, s.name as service_name
        FROM queue_entries q
        LEFT JOIN services s ON q.service_id = s.id
        WHERE q.business_id = ? AND q.status IN ('SERVING', 'CALLED', 'IN_SERVICE')
          AND (date(q.joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(q.joined_at) >= datetime('now', '-18 hours'))
        ORDER BY q.called_at DESC, q.joined_at DESC
        LIMIT 1
      `).get(biz.id) as any;

      if (currentServing) {
        const isCalled = currentServing.status === 'CALLED';
        await sendBusinessBotMessage(
          chatId,
          `👤 <b>HOZIRGI MIJOZ — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Navbat raqami: <b>#${currentServing.queue_number}</b>\n` +
          `👤 Ism: <b>${currentServing.customer_name}</b>\n` +
          `🩺 Xizmat: <b>${currentServing.service_name || 'Xizmat'}</b>\n` +
          `⚡️ Holat: <b>${isCalled ? '🟡 Chaqirilgan (Kutmoqda)' : '🟢 Qabulda (Xizmatda)'}</b>\n` +
          `━━━━━━━━━━━━━━━━`,
          {
            replyMarkup: {
              inline_keyboard: [
                isCalled
                  ? [{ text: '✅ Mijoz keldi (Xizmatda)', callback_data: `biz_q_serve_${currentServing.id}` }]
                  : [{ text: '🏁 Xizmatni yakunlash', callback_data: `biz_q_complete_${currentServing.id}` }],
                [{ text: '🔄 Qayta chaqirish', callback_data: `biz_recall_${currentServing.id}` }],
                [{ text: '❌ Kelmadi (O‘tkazib yuborish)', callback_data: `biz_q_noshow_${currentServing.id}` }],
                [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }]
              ]
            }
          }
        );
      } else {
        await sendBusinessBotMessage(
          chatId,
          `👤 <b>Hozir qabulda faol mijoz yo‘q.</b>\n\nNavbatdagi mijozni chaqirish uchun quyidagi tugmani bosing:`,
          {
            replyMarkup: {
              inline_keyboard: [
                [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }],
                [{ text: '📋 Jonli navbat', callback_data: `biz_open_queue_${biz.id}` }]
              ]
            }
          }
        );
      }
      return;
    }

    // 2. 📋 Jonli navbat
    if (
      text === t(lang, 'btn_menu_live_queue') ||
      text === '📋 Jonli navbat' ||
      text === t(lang, 'btn_menu_queue') ||
      text === '🟢 Jonli navbat' ||
      text === '🟢 Живая очередь' ||
      text === '📋 Живая очередь' ||
      text === '/queue'
    ) {
      if (!biz) return;
      await renderLiveQueueMessage(chatId, biz.id, db, lang);
      return;
    }

    // 3. 📅 Bugungi bronlar
    if (
      text === t(lang, 'btn_menu_today_bookings') ||
      text === '📅 Bugungi bronlar' ||
      text === t(lang, 'btn_menu_today') ||
      text === '📋 Bugungi navbatlar' ||
      text === '📋 Очереди на сегодня' ||
      text === '📅 Брони на сегодня' ||
      text === '/today' ||
      text === '/bookings'
    ) {
      if (!biz) return;
      const todayBookings = db.prepare(`
        SELECT b.*, s.name as service_name, st.name as staff_name
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN staff st ON b.staff_id = st.id
        WHERE b.business_id = ? AND b.booking_date = date('now', '+5 hours')
        ORDER BY b.start_time ASC LIMIT 12
      `).all(biz.id) as any[];

      const todayQueues = db.prepare(`
        SELECT q.*, s.name as service_name
        FROM queue_entries q
        LEFT JOIN services s ON q.service_id = s.id
        WHERE q.business_id = ?
          AND (date(q.joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(q.joined_at) >= datetime('now', '-18 hours'))
        ORDER BY q.joined_at DESC LIMIT 8
      `).all(biz.id) as any[];

      if (todayBookings.length === 0 && todayQueues.length === 0) {
        await sendBusinessBotMessage(chatId, `📅 <b>${biz.name}</b> uchun bugun hali bronlar yoki navbatlar yo‘q.`);
        return;
      }

      let bMsg = `📅 <b>BUGUNGI BRONLAR VA NAVBATLAR — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n`;
      if (todayBookings.length > 0) {
        bMsg += `<b>🗓 Qabul bronlari (${todayBookings.length} ta):</b>\n`;
        todayBookings.forEach((b, idx) => {
          const bStatusIcon = b.status === 'CONFIRMED' ? '🟢' : b.status === 'PENDING' ? '🟡' : b.status === 'COMPLETED' ? '✅' : '❌';
          bMsg += `${idx + 1}. ${bStatusIcon} <b>${b.start_time}</b> — #${b.booking_number}\n` +
            `   👤 ${b.customer_name} (${b.customer_phone || ''})\n` +
            `   🩺 ${b.service_name || 'Xizmat'}${b.staff_name ? ` (${b.staff_name})` : ''}\n\n`;
        });
      }

      if (todayQueues.length > 0) {
        bMsg += `<b>🎫 Jonli navbat chiptalari:</b>\n`;
        todayQueues.slice(0, 5).forEach((q, idx) => {
          const statusIcon = q.status === 'WAITING' ? '⏳' : q.status === 'CALLED' ? '🟡' : q.status === 'SERVING' ? '🟢' : q.status === 'COMPLETED' ? '✅' : '❌';
          bMsg += `${idx + 1}. ${statusIcon} <b>#${q.queue_number}</b> — ${q.customer_name} (${q.service_name || 'Xizmat'})\n`;
        });
      }

      await sendBusinessBotMessage(chatId, bMsg, {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }],
            [{ text: '📋 Jonli navbat', callback_data: `biz_open_queue_${biz.id}` }]
          ]
        }
      });
      return;
    }

    // 4. ➕ Navbatga qo‘shish (Instant Walk-in ticket)
    if (
      text === t(lang, 'btn_menu_quick_walkin') ||
      text === '➕ Navbatga qo‘shish' ||
      text === t(lang, 'btn_menu_walkin') ||
      text === '➕ Jonli navbatga mijoz qo‘shish' ||
      text === '➕ Добавить в очередь' ||
      text === '➕ Добавить клиента в очередь' ||
      text === '/walkin'
    ) {
      if (!biz) return;
      const todayCount = (db.prepare(`
        SELECT count(*) as c FROM queue_entries
        WHERE business_id = ? AND (date(joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(joined_at) >= datetime('now', '-18 hours'))
      `).get(biz.id) as any)?.c || 0;
      const letter = biz.name.charAt(0).toUpperCase() || 'A';
      const qNum = `${letter}-${100 + todayCount + 1}`;
      const newEntryId = 'qe-' + crypto.randomUUID().slice(0, 10);

      const firstService = db.prepare('SELECT id, name FROM services WHERE business_id = ? AND is_active = 1 LIMIT 1').get(biz.id) as any;
      const srvId = firstService?.id || null;
      const srvName = firstService?.name || 'Jonli qabul';

      db.prepare(`
        INSERT INTO queue_entries (
          id, business_id, service_id, customer_name, customer_phone,
          queue_number, status, joined_at, called_source
        ) VALUES (?, ?, ?, 'Jonli mijoz', '', ?, 'WAITING', CURRENT_TIMESTAMP, 'OPERATOR')
      `).run(newEntryId, biz.id, srvId, qNum);

      try {
        botHooks.broadcastQueueUpdate?.(biz.id, {
          type: 'QUEUE_JOINED',
          entry: { id: newEntryId, queue_number: qNum, customer_name: 'Jonli mijoz', service_name: srvName, status: 'WAITING' },
          source: 'OPERATOR',
          timestamp: new Date().toISOString()
        });
      } catch (e) {}

      await sendBusinessBotMessage(
        chatId,
        `🎟 <b>Yangi mijoz navbatga qo‘shildi!</b>\n━━━━━━━━━━━━━━━━\n` +
        `🎫 Chipta raqami: <b>#${qNum}</b>\n` +
        `🏢 Muassasa: <b>${biz.name}</b>\n` +
        `🩺 Xizmat: <b>${srvName}</b>\n` +
        `⚡️ Holat: <b>Kutmoqda (WAITING)</b>\n━━━━━━━━━━━━━━━━\n` +
        `<i>Ushbu chipta raqamini mijozga taqdim etishingiz mumkin.</i>`,
        {
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }]
            ]
          }
        }
      );
      return;
    }

    // 5. 📊 Bugungi hisobot / Statistika
    if (
      text === t(lang, 'btn_menu_report') ||
      text === '📊 Bugungi hisobot' ||
      text === t(lang, 'btn_menu_stats') ||
      text === '📊 Statistika' ||
      text === '📊 Статистика' ||
      text === '📊 Отчет за сегодня' ||
      text === '/stats' ||
      text === '/report'
    ) {
      if (!biz) {
        await sendBusinessBotMessage(chatId, 'ℹ️ Biznes ma’lumoti topilmadi.');
        return;
      }
      const stats = getBusinessDailyStats(db, biz.id);
      await sendBusinessBotMessage(
        chatId,
        `📊 <b>BUGUNGI HISOBOT — ${biz.name}</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `✅ <b>Yakunlangan xizmatlar:</b> <b>${stats.completedToday} nafar</b>\n` +
        `⏳ <b>Navbatda kutayotgan:</b> <b>${stats.waitingCount} nafar</b>\n` +
        `🟢 <b>Hozir qabulda:</b> <b>${stats.servingCount} nafar</b>\n` +
        `📅 <b>Bugungi qabul bronlari:</b> <b>${stats.bookingsToday} ta</b>\n` +
        `💰 <b>Kassa tushumi (taxminiy):</b> <b>${stats.revenueEstimate.toLocaleString()} so‘m</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `<i>Ma’lumotlar bazadan real vaqtda yangilanadi.</i>`,
        {
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🔄 Yangilash', callback_data: `biz_refresh_dash_${biz.id}` }],
              [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }]
            ]
          }
        }
      );
      return;
    }

    // 6. 🌐 Boshqaruv paneli
    if (
      text === t(lang, 'btn_menu_web_panel') ||
      text === '🌐 Boshqaruv paneli' ||
      text === '🌐 Панель управления' ||
      text === '/panel' ||
      text === '/dashboard'
    ) {
      if (!biz) return;
      const appUrl = getBusinessPlatformAppUrl(db);
      await sendBusinessBotMessage(
        chatId,
        `🌐 <b>${biz.name} — Boshqaruv Paneli:</b>\n━━━━━━━━━━━━━━━━\n` +
        `Xodimlar ro‘yxati, xizmatlar, narxlar va barcha sozlamalarni veb-kabinet orqali boshqarishingiz mumkin:`,
        {
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🚀 Veb Boshqaruv Panelini Ochish', web_app: { url: `${appUrl}/#business-dashboard` } }],
              [{ text: '🔗 Brauzerda ochish', url: `${appUrl}/#business-dashboard` }]
            ]
          }
        }
      );
      return;
    }

    // 6. ✅ Mijozga xizmat ko‘rsatildi
    if (text === t(lang, 'btn_menu_served') || text === '✅ Mijozga xizmat ko‘rsatildi' || text === '✅ Клиент обслужен' || text === '/served' || text === '/complete') {
      if (!biz) return;
      const res = executeMarkCustomerServedInBot(db, biz.id, undefined, auth.user?.id, tgUserId);
      if (res.success && res.entry) {
        await sendBusinessBotMessage(
          chatId,
          `✅ <b>Mijozga xizmat muvaffaqiyatli ko‘rsatildi!</b>\n\n` +
          `🎫 <b>#${res.entry.queue_number} — ${res.entry.customer_name}</b> yakunlandi.`,
          {
            replyMarkup: {
              inline_keyboard: [
                [{ text: '➡️ Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }],
                [{ text: '🟢 Jonli navbat', callback_data: `biz_open_queue_${biz.id}` }]
              ]
            }
          }
        );
      } else {
        await sendBusinessBotMessage(chatId, `ℹ️ ${res.message || 'Hozir xizmat ko‘rsatilayotgan mijoz mavjud emas.'}`, {
          replyMarkup: {
            inline_keyboard: [
              [{ text: '➡️ Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }]
            ]
          }
        });
      }
      return;
    }

    // 7. ❌ Navbatni bekor qilish
    if (text === t(lang, 'btn_menu_cancel') || text === '❌ Navbatni bekor qilish' || text === '❌ Отменить очередь' || text === '/cancel_queue') {
      if (!biz) return;
      const activeEntries = db.prepare(`
        SELECT q.*, s.name as service_name
        FROM queue_entries q
        LEFT JOIN services s ON q.service_id = s.id
        WHERE q.business_id = ? AND q.status IN ('WAITING', 'CALLED', 'SERVING', 'IN_SERVICE')
          AND (date(q.joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(q.joined_at) >= datetime('now', '-18 hours'))
        ORDER BY q.joined_at ASC LIMIT 8
      `).all(biz.id) as any[];

      if (activeEntries.length === 0) {
        await sendBusinessBotMessage(chatId, 'ℹ️ Bekor qilish uchun faol navbatlar topilmadi.');
        return;
      }

      const buttons = activeEntries.map(e => [
        { text: `❌ #${e.queue_number} ${e.customer_name} (${e.status})`, callback_data: `biz_q_cancel_${e.id}` }
      ]);

      await sendBusinessBotMessage(chatId, '❌ <b>Bekor qilmoqchi bo‘lgan navbatingizni tanlang:</b>', {
        replyMarkup: { inline_keyboard: buttons }
      });
      return;
    }

    // 8. 👥 Xodimlar
    if (text === t(lang, 'btn_menu_staff') || text === '👥 Xodimlar' || text === '👥 Сотрудники' || text === '/staff') {
      if (!biz) return;
      const staffList = db.prepare('SELECT * FROM staff WHERE business_id = ? ORDER BY name ASC').all(biz.id) as any[];
      if (staffList.length === 0) {
        await sendBusinessBotMessage(chatId, `👥 <b>${biz.name}</b> uchun hali xodimlar kiritilmagan.`);
        return;
      }
      let stMsg = `👥 <b>XODIMLAR RO‘YXATI — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n`;
      staffList.forEach((st, idx) => {
        stMsg += `<b>${idx + 1}. ${st.name}</b> (${st.title || 'Mutaxassis'})\n` +
          `   📞 Tel: ${st.phone || 'Kiritilmagan'}\n` +
          `   Holat: ${st.is_active ? '🟢 Ishda (Faol)' : '⚪️ Ta’tilda'}\n\n`;
      });
      await sendBusinessBotMessage(chatId, stMsg);
      return;
    }

    // 9. 🕒 Ish vaqti
    if (text === t(lang, 'btn_menu_hours') || text === '🕒 Ish vaqti' || text === '🕒 График работы' || text === '/hours') {
      if (!biz) return;
      const hours = db.prepare('SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC').all(biz.id) as any[];
      const daysMap: Record<number, string> = {
        1: 'Dushanba',
        2: 'Seshanba',
        3: 'Chorshanba',
        4: 'Payshanba',
        5: 'Juma',
        6: 'Shanba',
        0: 'Yakshanba'
      };

      let hMsg = `🕒 <b>ISH VAQTI JADVALI — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n`;
      if (hours.length > 0) {
        hours.forEach(h => {
          const dName = daysMap[h.day_of_week] || `Kun #${h.day_of_week}`;
          if (h.is_closed) {
            hMsg += `• <b>${dName}:</b> 🔴 Dam olish kuni\n`;
          } else {
            hMsg += `• <b>${dName}:</b> 🟢 ${h.open_time} - ${h.close_time}\n`;
          }
        });
      } else {
        hMsg += `• Dushanba - Shanba: 09:00 - 18:00\n• Yakshanba: Dam olish kuni\n`;
      }
      await sendBusinessBotMessage(chatId, hMsg);
      return;
    }

    // 10. 🛎 Xizmatlar va narxlar
    if (text === t(lang, 'btn_menu_services') || text === '🛎 Xizmatlar va narxlar' || text === '🛎 Услуги и цены' || text === '/services') {
      if (!biz) return;
      const services = db.prepare('SELECT * FROM services WHERE business_id = ? ORDER BY name ASC').all(biz.id) as any[];
      if (services.length === 0) {
        await sendBusinessBotMessage(chatId, `🛎 Hozircha xizmatlar kiritilmagan.`);
        return;
      }

      let sMsg = `🛎 <b>XIZMATLAR VA NARXLAR — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n`;
      services.forEach((s, idx) => {
        sMsg += `<b>${idx + 1}. ${s.name}</b>\n` +
          `   💰 Narx: <b>${s.price_uzs.toLocaleString()} so‘m</b>\n` +
          `   ⏱ Davomiylik: <b>${s.duration_minutes} daqiqa</b>\n` +
          `   Holat: ${s.is_active ? '🟢 Faol' : '🔴 Nofaol'}\n\n`;
      });
      await sendBusinessBotMessage(chatId, sMsg);
      return;
    }

    // 11. 🔔 Bildirishnomalar
    if (text === t(lang, 'btn_menu_notifications') || text === '🔔 Bildirishnomalar' || text === '🔔 Уведомления' || text === '/notifications') {
      if (!biz) return;
      await sendBusinessBotMessage(
        chatId,
        `🔔 <b>BILDIRISHNOMALAR SOZLAMALARI — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n` +
        `• 🟢 <b>Yangi bronlar:</b> Telegram orqali xabar berish faol\n` +
        `• 🟢 <b>Navbat chaqiruvi:</b> Mijozga avtomatik eslatish faol\n` +
        `• 🟢 <b>Veb-sayt sinxronizatsiyasi:</b> Real vaqt SSE ulanishi faol\n\n` +
        `<i>Mijozlar Telegram bot orqali yoki saytdan navbat olganida, barcha xabarlar bir zumda ushbu chatga yetib keladi.</i>`
      );
      return;
    }

    // 12. ⚙️ Sozlamalar
    if (text === t(lang, 'btn_menu_settings') || text === '⚙️ Sozlamalar' || text === '⚙️ Настройки' || text === '/settings') {
      await sendBusinessBotMessage(
        chatId,
        `⚙️ <b>SOZLAMALAR VA TIL</b>\n━━━━━━━━━━━━━━━━\n` +
        `Biznes: <b>${biz?.name}</b>\n` +
        `Telegram bot tili: <b>${lang === 'uz' ? 'O‘zbekcha' : 'Русский'}</b>\n\n` +
        `Tilni almashtirish uchun quyidagi tugmani bosing:`,
        {
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🇺🇿 O‘zbekcha', callback_data: 'set_lang_uz' }, { text: '🇷🇺 Русский', callback_data: 'set_lang_ru' }]
            ]
          }
        }
      );
      return;
    }

    // 13. 🆘 Yordam
    if (text === t(lang, 'btn_menu_help') || text === '🆘 Yordam' || text === '🆘 Помощь' || text === '/help') {
      await sendBusinessBotMessage(
        chatId,
        `🆘 <b>NAVBATBOR BIZNES BOTI QO‘LLANMASI</b>\n━━━━━━━━━━━━━━━━\n` +
        `<b>Boshqaruv menyusi imkoniyatlari:</b>\n` +
        `• 📊 <b>Statistika:</b> Kunlik va oylik tushum hamda navbatlar hisoboti\n` +
        `• 📋 <b>Bugungi navbatlar:</b> Bugungi barcha bronlar va navbatlar ro‘yxati\n` +
        `• 🟢 <b>Jonli navbat:</b> Hozirgi mijoz va navbatdagi navbat monitoringi\n` +
        `• ➕ <b>Jonli navbatga mijoz qo‘shish:</b> Yangi kelgan mijozni navbatga qo‘shish\n` +
        `• ➡️ <b>Keyingi mijoz:</b> Navbatdagi mijozni chaqirish (sayt va TVda yangilanadi)\n` +
        `• ✅ <b>Mijozga xizmat ko‘rsatildi:</b> Joriy xizmatni yakunlash\n` +
        `• ❌ <b>Navbatni bekor qilish:</b> Tanlangan navbatni bekor qilish\n` +
        `• 👥 <b>Xodimlar:</b> Xodimlar ro‘yxati va ularning faolligi\n` +
        `• 🕒 <b>Ish vaqti:</b> Muassasaning ish kunlari va soatlari\n` +
        `• 🛎 <b>Xizmatlar va narxlar:</b> Mavjud xizmatlar va narxlari\n` +
        `• 🔔 <b>Bildirishnomalar:</b> Xabarnomalar holati va sozlamalari\n` +
        `• ⚙️ <b>Sozlamalar:</b> Til va biznes profili sozlamalari\n\n` +
        `📞 <b>Texnik qo‘llab-quvvatlash:</b>\n` +
        `• Telefon: <b>+998200232540</b>\n` +
        `• Telegram: <b>@mansur_0511</b>\n` +
        `• Email: <b>mansurnuriddin24@gmail.com</b>\n\n` +
        `🌐 <b>Rasmiy sayt:</b> https://navbatbor.uz`
      );
      return;
    }

    // Walk-in step 1 -> step 2
    if (userState.step === 'WALKIN_NAME') {
      userState.data.customer_name = text;
      const services = db.prepare('SELECT id, name, price_uzs FROM services WHERE business_id = ? AND is_active = 1 LIMIT 8').all(userState.data.business_id) as any[];
      if (services.length === 0) {
        await sendBusinessBotMessage(chatId, '⚠️ Xizmatlar topilmadi. Avval xizmat qo‘shing.');
        clearBotUserState(db, chatId);
        return;
      }
      const buttons = services.map(s => [{ text: `${s.name} (${s.price_uzs.toLocaleString()} so‘m)`, callback_data: `walkin_srv_${s.id}` }]);
      setBotUserState(db, chatId, tgUserId, 'WALKIN_SERVICE', userState.data, lang);
      await sendBusinessBotMessage(chatId, `🩺 <b>${userState.data.customer_name}</b> uchun xizmatni tanlang:`, {
        replyMarkup: { inline_keyboard: buttons }
      });
      return;
    }
  }

  // Fallback for unauthenticated access to buttons
  if (!['/start', '/help', '/menu'].includes(text) && !text.startsWith('/start@')) {
    await sendBusinessBotMessage(chatId, t(lang, 'unauthorized'), {
      replyMarkup: getGuestKeyboard(lang, auth.role === 'PENDING_APPLICANT')
    });
  }
}

// ========================================================
// 13. CALLBACK QUERY HANDLER
// ========================================================
async function handleBusinessBotCallback(cb: any, db: DatabaseSync): Promise<void> {
  const cbChatId = String(cb.message?.chat?.id || cb.from?.id);
  const cbUserId = String(cb.from?.id || cbChatId);
  const data = cb.data || '';

  // Fast non-blocking acknowledge callback query (instantly stops button loading spinner)
  answerBusinessBotCallback(cb.id).catch(() => {});

  const auth = getBusinessBotUserAuth(db, cbUserId, cbChatId);
  const lang = auth.language;

  if (auth.role === 'BLOCKED') {
    await sendBusinessBotMessage(cbChatId, t(lang, 'blocked_notice'));
    return;
  }

  // 1. Language switcher callbacks
  if (data === 'set_lang_uz') {
    setBotUserState(db, cbChatId, cbUserId, null, undefined, 'uz');
    await sendBusinessBotMessage(cbChatId, '🇺🇿 Til o‘zbek tiliga o‘zgartirildi.');
    return;
  }
  if (data === 'set_lang_ru') {
    setBotUserState(db, cbChatId, cbUserId, null, undefined, 'ru');
    await sendBusinessBotMessage(cbChatId, '🇷🇺 Язык изменен на русский.');
    return;
  }

  // 2. Refresh Dashboard
  if (data.startsWith('biz_refresh_dash_')) {
    const bizId = data.replace('biz_refresh_dash_', '');
    if (auth.business?.id !== bizId && auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }
    const biz = auth.business || db.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId) as any;
    const stats = getBusinessDailyStats(db, bizId);
    await sendBusinessBotMessage(
      cbChatId,
      `📊 <b>YANGILANGAN STATISTIKA — ${biz.name}</b>\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🟢 <b>Hozir xizmat ko‘rsatilayotgan:</b> <b>${stats.servingCount} nafar</b>\n` +
      `⏳ <b>Navbatda kutayotgan:</b> <b>${stats.waitingCount} nafar</b>\n` +
      `✅ <b>Bugun yakunlangan navbatlar:</b> <b>${stats.completedToday} ta</b>\n` +
      `📅 <b>Bugungi qabul bronlari:</b> <b>${stats.bookingsToday} ta</b>\n` +
      `💰 <b>Kassa tushumi (taxminiy):</b> <b>${stats.revenueEstimate.toLocaleString()} so‘m</b>\n` +
      `━━━━━━━━━━━━━━━━`,
      {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🔄 Yangilash', callback_data: `biz_refresh_dash_${bizId}` }],
            [{ text: '🟢 Jonli navbatga o‘tish', callback_data: `biz_open_queue_${bizId}` }]
          ]
        }
      }
    );
    return;
  }

  // 3. Open Queue
  if (data.startsWith('biz_open_queue_')) {
    const bizId = data.replace('biz_open_queue_', '');
    if (auth.business?.id !== bizId && auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }
    await renderLiveQueueMessage(cbChatId, bizId, db, lang);
    return;
  }

  // 4. Registration Category selection
  if (data.startsWith('reg_cat_')) {
    const catId = data.replace('reg_cat_', '');
    const userState = getBotUserState(db, cbChatId);
    userState.data.category_id = catId;

    const cities = db.prepare('SELECT id, name FROM cities ORDER BY name ASC LIMIT 10').all() as any[];
    const buttons = cities.map(c => [{ text: c.name, callback_data: `reg_city_${c.id}` }]);

    setBotUserState(db, cbChatId, cbUserId, 'REG_CITY', userState.data, lang);
    await sendBusinessBotMessage(cbChatId, t(lang, 'reg_step5_city'), {
      replyMarkup: { inline_keyboard: buttons }
    });
    return;
  }

  // 5. Registration City selection
  if (data.startsWith('reg_city_')) {
    const cityId = data.replace('reg_city_', '');
    const userState = getBotUserState(db, cbChatId);
    userState.data.city_id = cityId;

    setBotUserState(db, cbChatId, cbUserId, 'REG_ADDRESS', userState.data, lang);
    await sendBusinessBotMessage(cbChatId, t(lang, 'reg_step6_address'), {
      replyMarkup: {
        keyboard: [[{ text: '❌ Bekor qilish' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // 6. SUPER ADMIN APPROVAL
  if (data.startsWith('admin_appr_') || data.startsWith('admin_approve_biz_')) {
    const appIdOrBizId = data.replace('admin_appr_', '').replace('admin_approve_biz_', '');
    if (auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    let app = db.prepare('SELECT * FROM business_applications WHERE id = ?').get(appIdOrBizId) as any;
    if (!app) {
      app = db.prepare('SELECT * FROM business_applications WHERE created_business_id = ?').get(appIdOrBizId) as any;
    }

    if (app) {
      const result = approveBusinessApplication(db, app.id, cbUserId, auth.user?.id);
      if (!result.success) {
        await sendBusinessBotMessage(cbChatId, `⚠️ ${result.message}`);
        return;
      }

      await sendBusinessBotMessage(
        cbChatId,
        `✅ <b>Ariza ma’qullandi!</b>\n\n🏢 <b>${app.business_name}</b> muvaffaqiyatli tasdiqlandi va saytda faol holatga keltirildi.`
      );

      if (app.telegram_chat_id && app.telegram_chat_id !== 'web_onboard') {
        await sendBusinessBotMessage(
          app.telegram_chat_id,
          t('uz', 'app_approved_owner', { biz_name: app.business_name }),
          { replyMarkup: getBusinessDashboardKeyboard('uz', 'BUSINESS_OWNER') }
        ).catch(() => {});
      }
      return;
    }

    // Direct business approval if not in applications
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(appIdOrBizId) as any;
    if (biz) {
      db.prepare(`
        UPDATE businesses 
        SET status = 'APPROVED', is_verified = 1, subscription_status = 'TRIAL', is_trial = 1, trial_used = 1
        WHERE id = ?
      `).run(biz.id);
      await sendBusinessBotMessage(
        cbChatId,
        `✅ <b>Ariza ma’qullandi!</b>\n\n🏢 <b>${biz.name}</b> muvaffaqiyatli tasdiqlandi va saytda faol holatga keltirildi.`
      );
      return;
    }

    await sendBusinessBotMessage(cbChatId, '⚠️ Ariza yoki biznes topilmadi.');
    return;
  }

  // 7. SUPER ADMIN REJECTION
  if (data.startsWith('admin_rejc_') || data.startsWith('admin_reject_biz_')) {
    const appIdOrBizId = data.replace('admin_rejc_', '').replace('admin_reject_biz_', '');
    if (auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    let app = db.prepare('SELECT * FROM business_applications WHERE id = ?').get(appIdOrBizId) as any;
    if (!app) {
      app = db.prepare('SELECT * FROM business_applications WHERE created_business_id = ?').get(appIdOrBizId) as any;
    }

    if (app) {
      const result = rejectBusinessApplication(db, app.id, cbUserId, 'Ma’lumotlar tekshiruvdan o‘tmadi', auth.user?.id);
      if (!result.success) {
        await sendBusinessBotMessage(cbChatId, `⚠️ ${result.message}`);
        return;
      }
      await sendBusinessBotMessage(
        cbChatId,
        `❌ <b>Ariza rad etildi.</b>\n\n🏢 ${app.business_name} arizachisiga rad javobi yetkazildi.`
      );
      if (app.telegram_chat_id && app.telegram_chat_id !== 'web_onboard') {
        await sendBusinessBotMessage(
          app.telegram_chat_id,
          t('uz', 'app_rejected_owner', {
            biz_name: app.business_name,
            reason: 'Ma’lumotlar tekshiruvdan o‘tmadi yoki telefon raqamga bog‘lanib bo‘lmadi.'
          }),
          { replyMarkup: getGuestKeyboard('uz', false) }
        ).catch(() => {});
      }
      return;
    }

    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(appIdOrBizId) as any;
    if (biz) {
      db.prepare("UPDATE businesses SET status = 'REJECTED' WHERE id = ?").run(biz.id);
      await sendBusinessBotMessage(cbChatId, `❌ <b>${biz.name}</b> arizasi rad etildi.`);
      return;
    }

    await sendBusinessBotMessage(cbChatId, '⚠️ Ariza topilmadi.');
    return;
  }

  // 7b. SUPER ADMIN PROMO / REKLAMA APPROVAL & REJECTION
  if (data.startsWith('admin_approve_promo_')) {
    const promoId = data.replace('admin_approve_promo_', '').trim();
    if (auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    const promo = db.prepare('SELECT * FROM ad_promotions WHERE id = ?').get(promoId) as any;
    if (!promo) {
      await sendBusinessBotMessage(cbChatId, '⚠️ Reklama arizasi topilmadi.');
      return;
    }

    db.prepare("UPDATE ad_promotions SET status = 'ACTIVE' WHERE id = ?").run(promoId);
    db.prepare("UPDATE businesses SET is_sponsored = 1 WHERE id = ?").run(promo.business_id);

    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(promo.business_id) as any;
    await sendBusinessBotMessage(
      cbChatId,
      `✅ <b>REKLAMA ARIZASI TASDIQLANDI!</b>\n━━━━━━━━━━━━━━━━\n` +
      `🏢 Muassasa: <b>${biz?.name || 'Muassasa'}</b>\n` +
      `⚡️ Holat: <b>TOP Featured o‘ringa chiqarildi!</b>`
    );

    try {
      notifyBusinessOwnerViaBusinessBot(
        db,
        promo.business_id,
        `🎉 <b>REKLAMA ARIZANGIZ TASDIQLANDI!</b>\n━━━━━━━━━━━━━━━━\n` +
        `Sizning <b>${biz?.name || 'Muassasangiz'}</b> ma’muriyat tomonidan tasdiqlandi va NavbatBor qidiruvida eng yuqori (TOP Featured) o‘ringa joylashtirildi!\n\n` +
        `Endi mijozlar sizni birinchi o‘rinda ko‘rishadi.`
      ).catch(() => {});
    } catch (e) {}
    return;
  }

  if (data.startsWith('admin_reject_promo_')) {
    const promoId = data.replace('admin_reject_promo_', '').trim();
    if (auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    db.prepare("UPDATE ad_promotions SET status = 'REJECTED' WHERE id = ?").run(promoId);
    await sendBusinessBotMessage(
      cbChatId,
      `❌ <b>Reklama arizasi rad etildi / bekor qilindi.</b>`
    );
    return;
  }

  // 8. SUPER ADMIN VIEW DETAILS
  if (data.startsWith('admin_view_')) {
    const appId = data.replace('admin_view_', '');
    if (auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }
    const app = db.prepare('SELECT * FROM business_applications WHERE id = ?').get(appId) as any;
    if (!app) {
      await sendBusinessBotMessage(cbChatId, '⚠️ Ariza topilmadi.');
      return;
    }

    await sendBusinessBotMessage(
      cbChatId,
      `ℹ️ <b>ARIZA TAFSILOTLARI</b>\n━━━━━━━━━━━━━━━━\n` +
      `ID: <code>${app.id}</code>\n` +
      `Biznes: <b>${app.business_name}</b>\n` +
      `Egasi: <b>${app.owner_name}</b>\n` +
      `Tel: <code>${app.owner_phone}</code>\n` +
      `Manzil: <b>${app.address}</b>\n` +
      `Telegram ID: <code>${app.telegram_user_id}</code>\n` +
      `Holat: <b>${app.status}</b>\n` +
      `Sana: <b>${app.created_at}</b>\n` +
      `Tavsif: <i>${app.description || 'Yo‘q'}</i>`
    );
    return;
  }

  // 9. WALK-IN SERVICE SELECTION
  if (data.startsWith('walkin_srv_')) {
    const srvId = data.replace('walkin_srv_', '');
    const userState = getBotUserState(db, cbChatId);
    const bizId = userState.data.business_id || auth.business?.id;

    if (!bizId) {
      await sendBusinessBotMessage(cbChatId, '⚠️ Biznes aniqlanmadi.');
      return;
    }

    const res = addWalkinCustomerViaBot(db, {
      businessId: bizId,
      customerName: userState.data.customer_name || 'Navbatdagi mijoz',
      serviceId: srvId,
      createdUserId: auth.user?.id
    });

    clearBotUserState(db, cbChatId);

    if (res.success && res.entry) {
      await sendBusinessBotMessage(
        cbChatId,
        `🎫 <b>MIJOZ JONLI NAVBATGA QO‘SHILDI!</b>\n━━━━━━━━━━━━━━━━\n` +
        `Navbat raqami: <b>#${res.entry.queue_number}</b>\n` +
        `Ism: <b>${res.entry.customer_name}</b>\n` +
        `Kutish vaqti (taxminan): <b>${res.entry.estimated_wait_minutes} daqiqa</b>\n` +
        `Oldidagi odamlar: <b>${res.entry.people_ahead} nafar</b>\n` +
        `━━━━━━━━━━━━━━━━`,
        { replyMarkup: getBusinessDashboardKeyboard(lang, auth.role) }
      );
    } else {
      await sendBusinessBotMessage(cbChatId, `⚠️ ${res.message}`);
    }
    return;
  }

  // 10. LIVE QUEUE CALL NEXT
  if (data.startsWith('biz_call_next_')) {
    const bizId = data.replace('biz_call_next_', '');
    if (auth.business?.id !== bizId && auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    const res = executeCallNextCustomerInBot(db, bizId, auth.user?.id, cbUserId);
    if (!res.success || !res.entry) {
      await sendBusinessBotMessage(cbChatId, `ℹ️ ${res.message || 'Hozircha navbatda kutayotgan mijozlar yo‘q.'}`);
      return;
    }

    await sendBusinessBotMessage(
      cbChatId,
      `📢 <b>MIJOZ CHAQIRILDI: #${res.entry.queue_number} — ${res.entry.customer_name}</b>\n` +
      `Xizmat: <b>${res.entry.service_name || 'Xizmat'}</b>`,
      {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '✅ Mijoz keldi (Xizmatda)', callback_data: `biz_q_serve_${res.entry.id}` }],
            [{ text: '🏁 Xizmatni yakunlash', callback_data: `biz_q_complete_${res.entry.id}` }],
            [{ text: '❌ Kelmadi (No-show)', callback_data: `biz_q_noshow_${res.entry.id}` }],
            [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${bizId}` }]
          ]
        }
      }
    );
    return;
  }

  // 11. SERVE / COMPLETE / NO-SHOW / CANCEL QUEUE ENTRY
  if (data.startsWith('biz_q_serve_')) {
    const entryId = data.replace('biz_q_serve_', '');
    const ent = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!ent || (auth.business?.id !== ent.business_id && auth.role !== 'SUPER_ADMIN')) {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    db.prepare("UPDATE queue_entries SET status = 'SERVING' WHERE id = ?").run(entryId);

    try {
      botHooks.broadcastQueueUpdate?.(ent.business_id, {
        type: 'QUEUE_STATUS_UPDATED',
        entryId,
        status: 'SERVING',
        timestamp: Date.now()
      });
    } catch (e) {}

    await sendBusinessBotMessage(cbChatId, `🟢 <b>Xizmat ko‘rsatilmoqda: #${ent.queue_number} (${ent.customer_name})</b>`, {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🏁 Xizmatni yakunlash', callback_data: `biz_q_complete_${entryId}` }]
        ]
      }
    });
    return;
  }

  if (data.startsWith('biz_recall_')) {
    const entryId = data.replace('biz_recall_', '');
    const ent = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!ent || (auth.business?.id !== ent.business_id && auth.role !== 'SUPER_ADMIN')) {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    db.prepare("UPDATE queue_entries SET status = 'CALLED', called_at = CURRENT_TIMESTAMP WHERE id = ?").run(entryId);

    try {
      botHooks.broadcastQueueUpdate?.(ent.business_id, {
        type: 'QUEUE_CALLED',
        entryId,
        queue_number: ent.queue_number,
        timestamp: Date.now()
      });
      botHooks.notifyQueueCalled?.(entryId);
    } catch (e) {}

    await sendBusinessBotMessage(cbChatId, `🔄 <b>Mijoz qayta chaqirildi: #${ent.queue_number} (${ent.customer_name})</b>`, {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '✅ Mijoz keldi (Xizmatda)', callback_data: `biz_q_serve_${entryId}` }],
          [{ text: '🏁 Xizmatni yakunlash', callback_data: `biz_q_complete_${entryId}` }],
          [{ text: '❌ Kelmadi (O‘tkazib yuborish)', callback_data: `biz_q_noshow_${entryId}` }]
        ]
      }
    });
    return;
  }

  if (data.startsWith('biz_q_complete_')) {
    const entryId = data.replace('biz_q_complete_', '');
    const ent = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!ent || (auth.business?.id !== ent.business_id && auth.role !== 'SUPER_ADMIN')) {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    const res = executeMarkCustomerServedInBot(db, ent.business_id, entryId, auth.user?.id, cbUserId);
    await sendBusinessBotMessage(cbChatId, `✅ <b>Xizmat muvaffaqiyatli yakunlandi: #${ent.queue_number}</b>`, {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${ent.business_id}` }]
        ]
      }
    });
    return;
  }

  if (data.startsWith('biz_q_noshow_') || data.startsWith('biz_q_cancel_')) {
    const entryId = data.replace('biz_q_noshow_', '').replace('biz_q_cancel_', '');
    const ent = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!ent || (auth.business?.id !== ent.business_id && auth.role !== 'SUPER_ADMIN')) {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    const res = executeCancelQueueEntryInBot(db, ent.business_id, entryId, 'Muassasa tomonidan bekor qilindi', auth.user?.id, cbUserId);
    await sendBusinessBotMessage(cbChatId, `❌ <b>Navbat bekor qilindi / o‘tkazib yuborildi: #${ent.queue_number}</b>`, {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${ent.business_id}` }]
        ]
      }
    });
    return;
  }

  // 12. BOOKING MANAGEMENT (BUSINESS BOT)
  if (data.startsWith('biz_bkg_cancel_')) {
    const bkgId = data.replace('biz_bkg_cancel_', '');
    const booking = db.prepare(`
      SELECT b.*, biz.name as business_name, u.telegram_chat_id as cust_tg
      FROM bookings b
      JOIN businesses biz ON b.business_id = biz.id
      LEFT JOIN users u ON b.customer_id = u.id
      WHERE b.id = ?
    `).get(bkgId) as any;

    if (!booking) {
      await sendBusinessBotMessage(cbChatId, '⚠️ Bron topilmadi.');
      return;
    }

    if (auth.business?.id !== booking.business_id && auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }

    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      await sendBusinessBotMessage(cbChatId, `⚠️ Ushbu bron allaqachon ${booking.status === 'COMPLETED' ? 'yakunlangan' : 'bekor qilingan'}.`);
      return;
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare("UPDATE bookings SET status = 'CANCELLED', cancel_reason = 'Muassasa tomonidan bekor qilindi' WHERE id = ?").run(bkgId);
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_email, action, target_type, target_id, details)
        VALUES (?, ?, ?, 'BOOKING_CANCELLED_BY_BIZ_BOT', 'BOOKING', ?, ?)
      `).run('aud-' + Date.now(), auth.user?.id || null, auth.user?.email || null, bkgId, `Telegram: ${cbUserId}`);
      db.exec('COMMIT;');

      try {
        botHooks.broadcastQueueUpdate?.(booking.business_id, {
          type: 'BOOKING_CANCELLED',
          bookingId: bkgId,
          timestamp: Date.now()
        });
      } catch (e) {}

      await sendBusinessBotMessage(cbChatId, `❌ <b>Bron muvaffaqiyatli bekor qilindi: #${booking.booking_number}</b>\nMijoz: <b>${booking.customer_name}</b> (${booking.booking_date} ${booking.start_time})`);
    } catch(err: any) {
      try { db.exec('ROLLBACK;'); } catch(e){}
      await sendBusinessBotMessage(cbChatId, `⚠️ Xatolik yuz berdi: ${err.message}`);
    }
    return;
  }

  if (data.startsWith('biz_bkg_done_')) {
    const bkgId = data.replace('biz_bkg_done_', '');
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bkgId) as any;
    if (!booking) {
      await sendBusinessBotMessage(cbChatId, '⚠️ Bron topilmadi.');
      return;
    }
    if (auth.business?.id !== booking.business_id && auth.role !== 'SUPER_ADMIN') {
      await sendBusinessBotMessage(cbChatId, t(lang, 'unauthorized'));
      return;
    }
    db.prepare("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?").run(bkgId);

    try {
      botHooks.broadcastQueueUpdate?.(booking.business_id, {
        type: 'BOOKING_COMPLETED',
        bookingId: bkgId,
        timestamp: Date.now()
      });
    } catch (e) {}

    await sendBusinessBotMessage(cbChatId, `✅ <b>Bron qabul qilindi / yakunlandi: #${booking.booking_number}</b>\nMijoz: <b>${booking.customer_name}</b>`);
    return;
  }
}

// ========================================================
// 14. HELPER: RENDER LIVE QUEUE MESSAGE
// ========================================================
async function renderLiveQueueMessage(chatId: string, businessId: string, db: DatabaseSync, lang: BotLanguage): Promise<void> {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId) as any;
  if (!biz) return;

  const current = db.prepare(`
    SELECT q.*, s.name as service_name
    FROM queue_entries q
    JOIN services s ON q.service_id = s.id
    WHERE q.business_id = ? AND q.status IN ('CALLED', 'SERVING', 'IN_SERVICE')
      AND (date(q.joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(q.joined_at) >= datetime('now', '-18 hours'))
    ORDER BY q.joined_at ASC LIMIT 1
  `).get(businessId) as any;

  const waitingList = db.prepare(`
    SELECT q.*, s.name as service_name
    FROM queue_entries q
    JOIN services s ON q.service_id = s.id
    WHERE q.business_id = ? AND q.status = 'WAITING'
      AND (date(q.joined_at, '+5 hours') = date('now', '+5 hours') OR datetime(q.joined_at) >= datetime('now', '-18 hours'))
    ORDER BY q.joined_at ASC LIMIT 5
  `).all(businessId) as any[];

  let qText = `🟢 <b>JONLI NAVBAT — ${biz.name}</b>\n━━━━━━━━━━━━━━━━\n`;

  if (current) {
    qText += `👤 <b>Hozirgi mijoz:</b>\n` +
      `   🎫 <b>#${current.queue_number} — ${current.customer_name}</b>\n` +
      `   🩺 Xizmat: <b>${current.service_name}</b>\n` +
      `   Holat: <b>${current.status === 'CALLED' ? '🟡 Chaqirilgan' : '🟢 Xizmatda'}</b>\n\n`;
  } else {
    qText += `👤 <b>Hozirgi mijoz:</b> <i>Hech kim yo‘q (bo‘sh)</i>\n\n`;
  }

  qText += `⏳ <b>Kutayotganlar ro‘yxati (${waitingList.length} ta):</b>\n`;
  if (waitingList.length === 0) {
    qText += `<i>Navbatda kutayotgan mijozlar mavjud emas.</i>\n`;
  } else {
    waitingList.forEach((w, idx) => {
      qText += `<b>${idx + 1}. #${w.queue_number}</b> — ${w.customer_name} (${w.service_name})\n`;
    });
  }

  qText += `━━━━━━━━━━━━━━━━`;

  const inlineButtons = [];
  if (waitingList.length > 0) {
    inlineButtons.push([{ text: '🟢 Keyingi mijozni chaqirish', callback_data: `biz_call_next_${biz.id}` }]);
  }
  if (current) {
    inlineButtons.push([
      { text: '✅ Keldi (Xizmatda)', callback_data: `biz_q_serve_${current.id}` },
      { text: '🏁 Yakunlash', callback_data: `biz_q_complete_${current.id}` }
    ]);
  }
  inlineButtons.push([{ text: '🔄 Yangilash', callback_data: `biz_open_queue_${biz.id}` }]);

  await sendBusinessBotMessage(chatId, qText, {
    replyMarkup: { inline_keyboard: inlineButtons }
  });
}

// ========================================================
// 15. LONG POLLING SERVICE FOR LOCAL / DEV ENVIRONMENTS
// ========================================================
let isBusinessPollingActive = false;
let businessUpdateOffset = 0;
export let lastBusinessPollTime = 0;

export async function startBusinessBotPolling(db: DatabaseSync): Promise<void> {
  const token = getBusinessBotToken();
  if (!token || token.trim().length <= 10) {
    console.log('[Business Bot Poller] BUSINESS_BOT_TOKEN not configured or simulated.');
    return;
  }

  if (isBusinessPollingActive) return;
  isBusinessPollingActive = true;

  console.log('[Business Bot Poller] Starting long polling for business bot...');

  // Reset any existing webhook for polling
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
  } catch (e) {}

  const pollLoop = async () => {
    while (isBusinessPollingActive) {
      try {
        lastBusinessPollTime = Date.now();
        const resp = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${businessUpdateOffset}&timeout=25&allowed_updates=["message","callback_query"]`, {
          signal: AbortSignal.timeout(35000)
        });
        if (!resp.ok) {
          console.error(`[Business Bot Poller] HTTP ${resp.status}`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        const data = await resp.json() as any;

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            businessUpdateOffset = Math.max(businessUpdateOffset, update.update_id + 1);
            try {
              await processBusinessBotUpdate(update, db);
            } catch (uErr) {
              console.error('[Business Bot Poller] Update processing error:', uErr);
            }
          }
        } else if (!data.ok) {
          console.error('[Business Bot Poller] Telegram API error:', data.error_code, data.description);
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err: any) {
        // Sleep on error to prevent CPU spinning on network glitches
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  };

  const runPollerSupervisor = async () => {
    while (isBusinessPollingActive) {
      try {
        await pollLoop();
      } catch (loopErr) {
        console.error('[Business Bot Poller] Loop crashed, auto-recovering in 5 seconds...', loopErr);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  };

  runPollerSupervisor().catch(e => console.error('[Business Bot Poller Supervisor Error]:', e));
}
