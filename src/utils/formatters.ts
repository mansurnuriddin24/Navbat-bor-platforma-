// Utility helpers for consistent phone, role, and text formatting

export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return 'Kiritilmagan';
  const clean = phone.trim();
  if (!clean) return 'Kiritilmagan';

  // Strip non-digit characters except leading plus
  const digits = clean.replace(/[^\d]/g, '');

  // Case: 998901234567 (12 digits)
  if (digits.length === 12 && digits.startsWith('998')) {
    const code = digits.slice(3, 5);
    const p1 = digits.slice(5, 8);
    const p2 = digits.slice(8, 10);
    const p3 = digits.slice(10, 12);
    return `+998 (${code}) ${p1}-${p2}-${p3}`;
  }

  // Case: 901234567 (9 digits)
  if (digits.length === 9) {
    const code = digits.slice(0, 2);
    const p1 = digits.slice(2, 5);
    const p2 = digits.slice(5, 7);
    const p3 = digits.slice(7, 9);
    return `+998 (${code}) ${p1}-${p2}-${p3}`;
  }

  return clean;
}

export function formatRole(role?: string | null, t?: (key: any) => string): string {
  if (!role) return t ? t('role_customer') : 'Mijoz';
  const r = role.toUpperCase();
  switch (r) {
    case 'CUSTOMER':
      return t ? t('role_customer') : 'Mijoz';
    case 'BUSINESS_OWNER':
      return t ? t('role_business_owner') : 'Biznes egasi';
    case 'STAFF':
    case 'EMPLOYEE':
      return t ? t('role_staff') : 'Xodim';
    case 'ADMIN':
    case 'SUPER_ADMIN':
    case 'FOUNDER':
    case 'OWNER':
      return t ? t('role_admin') : 'Administrator';
    case 'OPERATING_PARTNER':
    case 'SALES_MANAGER':
    case 'BUSINESS_MANAGER':
      return t ? t('role_operating_partner') : 'Operatsion hamkor';
    default:
      return role;
  }
}

export function sanitizeName(name?: string | null): string {
  if (!name) return '';
  return name.replace(/[\uFFFD\u0000-\u001F\u007F-\u009F]/g, '').trim();
}
