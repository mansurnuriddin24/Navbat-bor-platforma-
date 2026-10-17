/**
 * NavbatBor.uz — To'liq Monetizatsiya Moduli Konfiguratsiyasi
 * 
 * Ushbu fayl platformadagi barcha tariflar, limitlar, qo'shimcha xizmatlar,
 * reklama paketlari va obuna holatlarini markazlashtirilgan tarzda boshqaradi.
 */

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED';

export type PlanCode = 'START' | 'BUSINESS' | 'PRO' | 'PREMIUM' | 'FREE';

export interface PlanFeatureLimits {
  max_staff: number;
  max_monthly_bookings: number;
  max_services: number;
  max_tv_screens: number;
  sms_package_monthly: number;
  can_use_online_booking: boolean;
  can_use_live_queue: boolean;
  can_use_telegram_bot: boolean;
  can_use_tv_display: boolean;
  can_use_crm: boolean;
  can_use_analytics: boolean;
  can_use_custom_branding: boolean;
  can_use_api_webhooks: boolean;
  can_use_multi_branch: boolean;
  support_level: 'COMMUNITY' | 'STANDARD' | 'PRIORITY' | 'DEDICATED_VIP';
}

export interface PlanDefinition {
  id: string;
  name: string;
  code: PlanCode;
  price_uzs: number;
  billing_period: 'MONTHLY';
  description: string;
  badge?: string;
  popular?: boolean;
  features_list: string[];
  limits: PlanFeatureLimits;
  is_active: boolean;
  is_available_for_purchase: boolean;
}

// 1. CANONICAL INITIAL PLANS (Foydalanuvchi talabi bo'yicha)
export const INITIAL_PLANS: Record<PlanCode, PlanDefinition> = {
  START: {
    id: 'plan-start',
    name: 'START',
    code: 'START',
    price_uzs: 149000,
    billing_period: 'MONTHLY',
    description: 'Kichik xizmat ko‘rsatish nuqtalari, go‘zallik ustalari va yakka tadbirkorlar uchun',
    features_list: [
      '3 tagacha xodim',
      'Oyiga 300 ta bron',
      'Onlayn bron qilish sahifasi',
      'Jonli navbat boshqaruvi',
      'Telegram bot xabarnomalari',
      'Mijozlar kontaktlar bazasi',
      'Standart qo‘llab-quvvatlash'
    ],
    limits: {
      max_staff: 3,
      max_monthly_bookings: 300,
      max_services: 10,
      max_tv_screens: 0,
      sms_package_monthly: 0,
      can_use_online_booking: true,
      can_use_live_queue: true,
      can_use_telegram_bot: true,
      can_use_tv_display: false,
      can_use_crm: true,
      can_use_analytics: false,
      can_use_custom_branding: false,
      can_use_api_webhooks: false,
      can_use_multi_branch: false,
      support_level: 'STANDARD'
    },
    is_active: true,
    is_available_for_purchase: true
  },
  PRO: {
    id: 'plan-pro',
    name: 'PRO',
    code: 'PRO',
    price_uzs: 299000,
    billing_period: 'MONTHLY',
    description: 'O‘rta bizneslar, xususiy klinikalar, sartaroshxonalar va to‘liq CRM tizimi',
    popular: true,
    badge: 'Tavsiya etiladi',
    features_list: [
      '8 tagacha xodim',
      'Oyiga 1 000 ta bron',
      '2 tagacha Smart TV navbat ekrani',
      'To‘liq CRM mijozlar bazasi',
      'Daromad va bronlar analitikasi',
      'Prioritet Telegram eslatmalar',
      '200 ta SMS paketi',
      'Tezkor texnik ko‘mak'
    ],
    limits: {
      max_staff: 8,
      max_monthly_bookings: 1000,
      max_services: 25,
      max_tv_screens: 2,
      sms_package_monthly: 200,
      can_use_online_booking: true,
      can_use_live_queue: true,
      can_use_telegram_bot: true,
      can_use_tv_display: true,
      can_use_crm: true,
      can_use_analytics: true,
      can_use_custom_branding: false,
      can_use_api_webhooks: false,
      can_use_multi_branch: false,
      support_level: 'PRIORITY'
    },
    is_active: true,
    is_available_for_purchase: true
  },
  BUSINESS: {
    id: 'plan-business',
    name: 'BUSINESS',
    code: 'BUSINESS',
    price_uzs: 599000,
    billing_period: 'MONTHLY',
    description: 'Katta oqimli markazlar, diagnostika klinikalari, filiallar va tarmoqlar uchun',
    features_list: [
      '25 tagacha xodim',
      'Oyiga 5 000 ta bron',
      '5 tagacha Smart TV ekran',
      'Kengaytirilgan biznes analitikasi',
      'Shaxsiy logotip va brending',
      'API & Webhook integratsiyasi',
      '500 ta SMS paketi',
      'Prioritet texnik qo‘llab-quvvatlash'
    ],
    limits: {
      max_staff: 25,
      max_monthly_bookings: 5000,
      max_services: 50,
      max_tv_screens: 5,
      sms_package_monthly: 500,
      can_use_online_booking: true,
      can_use_live_queue: true,
      can_use_telegram_bot: true,
      can_use_tv_display: true,
      can_use_crm: true,
      can_use_analytics: true,
      can_use_custom_branding: true,
      can_use_api_webhooks: true,
      can_use_multi_branch: true,
      support_level: 'PRIORITY'
    },
    is_active: true,
    is_available_for_purchase: true
  },
  PREMIUM: {
    id: 'plan-premium',
    name: 'PREMIUM',
    code: 'PREMIUM',
    price_uzs: 999000,
    billing_period: 'MONTHLY',
    description: 'Yirik korxonalar, ko‘p filialli holdinglar va VIP mijozlarga xizmat ko‘rsatuvchi muassasalar',
    badge: 'VIP',
    features_list: [
      'Cheksiz xodimlar',
      'Cheksiz oylik bronlar',
      'Cheksiz Smart TV ekranlar',
      'Ko‘p filialli boshqaruv',
      'Chek printeri (ESC/POS) sozlash kiritilgan',
      '2 000 ta SMS paketi',
      'Shaxsiy akkaunt menejeri',
      '24/7 VIP maxsus yordam'
    ],
    limits: {
      max_staff: 9999,
      max_monthly_bookings: 999999,
      max_services: 9999,
      max_tv_screens: 99,
      sms_package_monthly: 2000,
      can_use_online_booking: true,
      can_use_live_queue: true,
      can_use_telegram_bot: true,
      can_use_tv_display: true,
      can_use_crm: true,
      can_use_analytics: true,
      can_use_custom_branding: true,
      can_use_api_webhooks: true,
      can_use_multi_branch: true,
      support_level: 'DEDICATED_VIP'
    },
    is_active: true,
    is_available_for_purchase: true
  },
  FREE: {
    id: 'plan-free',
    name: 'FREE (14 kunlik sinov)',
    code: 'FREE',
    price_uzs: 0,
    billing_period: 'MONTHLY',
    description: '14 kunlik to‘liq bepul sinov davri (Yangi ro‘yxatdan o‘tgan bizneslar uchun)',
    badge: '14 Kun Bepul',
    features_list: [
      '14 kun bepul foydalanish',
      '3 tagacha xodim',
      'Oyiga 300 ta bron',
      'Jonli navbat va onlayn bron',
      'Telegram bot eslatmalari',
      'Mijozlar CRM bazasi'
    ],
    limits: {
      max_staff: 3,
      max_monthly_bookings: 300,
      max_services: 10,
      max_tv_screens: 1,
      sms_package_monthly: 50,
      can_use_online_booking: true,
      can_use_live_queue: true,
      can_use_telegram_bot: true,
      can_use_tv_display: true,
      can_use_crm: true,
      can_use_analytics: true,
      can_use_custom_branding: false,
      can_use_api_webhooks: false,
      can_use_multi_branch: false,
      support_level: 'STANDARD'
    },
    is_active: true,
    is_available_for_purchase: false
  }
};

// 2. QO'SHIMCHA XIZMATLAR (ADD-ON SERVICES)
export interface ExtraServiceDefinition {
  id: string;
  code: string;
  name: string;
  category: 'ONBOARDING' | 'MESSAGING' | 'MARKETING' | 'ANALYTICS' | 'HARDWARE';
  description: string;
  price_uzs: number;
  unit: string;
  icon: string;
  is_active: boolean;
}

export const INITIAL_EXTRA_SERVICES: ExtraServiceDefinition[] = [
  {
    id: 'svc-initial-setup',
    code: 'initial_setup',
    name: 'Biznesni dastlabki sozlash',
    category: 'ONBOARDING',
    description: 'Biznes profili, xodimlar, xizmatlar, ish jadvallari va xonalarni NavbatBor mutaxassislari tomonidan to‘liq sozlab berish',
    price_uzs: 150000,
    unit: 'bir martalik',
    icon: 'Sparkles',
    is_active: true
  },
  {
    id: 'svc-sms-bundle-1000',
    code: 'sms_bundle',
    name: 'SMS paketlar (1 000 ta SMS)',
    category: 'MESSAGING',
    description: 'Mijozlarga rasmiy SMS orqali bron tasdiqlari, eslatmalar va navbat chaqiruvlari yuborish uchun to‘plam',
    price_uzs: 80000,
    unit: '1000 SMS',
    icon: 'MessageSquare',
    is_active: true
  },
  {
    id: 'svc-extra-ads',
    code: 'extra_ads',
    name: 'Qo‘shimcha reklama to‘plami',
    category: 'MARKETING',
    description: '14 kun davomida qidiruv natijalarida va shahar bo‘yicha yuqori reytingda ko‘rsatilish kafolati',
    price_uzs: 120000,
    unit: '14 kunlik',
    icon: 'TrendingUp',
    is_active: true
  },
  {
    id: 'svc-advanced-analytics',
    code: 'advanced_analytics',
    name: 'Kengaytirilgan statistika',
    category: 'ANALYTICS',
    description: 'Mijozlar oqimi, xodimlar samaradorligi, bekor qilingan bronlar sababi va daromadlar chuqur tahlili',
    price_uzs: 100000,
    unit: 'oylik',
    icon: 'BarChart3',
    is_active: true
  },
  {
    id: 'svc-printer-setup',
    code: 'printer_setup',
    name: 'Printer sozlash xizmati',
    category: 'HARDWARE',
    description: 'Termal chek printeri (ESC/POS 80mm/58mm) va navbat talonlarini avtomatlashtirilgan chop etish tizimini o‘rnatish',
    price_uzs: 150000,
    unit: 'bir martalik',
    icon: 'Printer',
    is_active: true
  }
];

// 3. REKLAMA KAMPANIYALARI TARIFLARI
export interface AdPackageDefinition {
  type: 'RECOMMENDED' | 'CATEGORY_BOOST' | 'TIMED_CAMPAIGN';
  title: string;
  description: string;
  durations: Array<{
    days: number;
    price_uzs: number;
    popular?: boolean;
  }>;
}

export const AD_PACKAGES: AdPackageDefinition[] = [
  {
    type: 'RECOMMENDED',
    title: 'Tavsiya etilgan bizneslar (Bosh sahifa & TOP)',
    description: 'Platformaning eng asosiy sahifasida va barcha qidiruvlar boshida “Tavsiya etilgan” maxsus nishoni bilan namoyish etiladi',
    durations: [
      { days: 7, price_uzs: 70000 },
      { days: 14, price_uzs: 130000, popular: true },
      { days: 30, price_uzs: 250000 }
    ]
  },
  {
    type: 'CATEGORY_BOOST',
    title: 'Kategoriya ichidagi reklama',
    description: 'O‘z sohangiz (masalan, Tibbiyot yoki Go‘zallik) katalogida doimo 1-o‘rinda ko‘rinish',
    durations: [
      { days: 7, price_uzs: 50000 },
      { days: 14, price_uzs: 90000, popular: true },
      { days: 30, price_uzs: 170000 }
    ]
  },
  {
    type: 'TIMED_CAMPAIGN',
    title: 'Muddatli reklama kampaniyasi (Moslashuvchan)',
    description: 'Aksiyalar yoki mavsumiy chegirmalar uchun maxsus kunlik reja',
    durations: [
      { days: 3, price_uzs: 30000 },
      { days: 5, price_uzs: 48000 },
      { days: 10, price_uzs: 90000 }
    ]
  }
];

// 4. REAL EXPENSE CATEGORIES (Real xarajatlar va sof foydani hisoblash uchun)
export const EXPENSE_CATEGORIES: Record<string, { label: string; icon: string }> = {
  SERVER_HOSTING: { label: 'Server & Hosting infratuzilmasi', icon: 'Server' },
  SMS_GATEWAY: { label: 'SMS Gateway provayderi xarajatlari', icon: 'MessageSquare' },
  TELEGRAM_API: { label: 'Telegram Bot & API xizmatlari', icon: 'Send' },
  PARTNER_COMMISSIONS: { label: 'Boshqaruvchi hamkorlar komissiyasi (30%)', icon: 'Users' },
  BANK_FEES: { label: 'Bank & To‘lov tizimlari komissiyasi (Click/Payme)', icon: 'CreditCard' },
  OFFICE_SUPPORT: { label: 'Qo‘llab-quvvatlash xizmati va ofis', icon: 'Headphones' },
  MARKETING: { label: 'Platforma marketingi va reklama', icon: 'Megaphone' }
};

// Helper: Format UZS
export function formatUzs(amount: number): string {
  return `${(amount || 0).toLocaleString('uz-UZ')} so‘m`;
}

// Helper: Get limits for plan
export function getPlanLimits(code: string): PlanFeatureLimits {
  const normalized = (code || 'START').toUpperCase() as PlanCode;
  return INITIAL_PLANS[normalized]?.limits || INITIAL_PLANS.START.limits;
}

// Helper: Calculate days remaining
export function calculateDaysRemaining(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
}
