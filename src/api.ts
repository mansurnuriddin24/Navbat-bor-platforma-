import {
  OperatingPartnerOverview,
  CRMLead,
  PartnerCommission,
  CommissionSummary,
  PartnerReport,
  SupportTicket,
  OperatingAuditLog,
  OperatingPartnerKPI
} from './types';

// API Client for NavbatBor
const TOKEN_KEY = 'navbatbor_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  let data: any = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  } else {
    try {
      const text = await response.text();
      data = { error: text || `Server xatosi (${response.status})` };
    } catch {
      data = { error: `Server xatosi (${response.status})` };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/api/auth/me') {
      setStoredToken(null);
    }
    throw new Error(data?.error || data?.message || `Serverda xatolik (${response.status})`);
  }

  return data;
}

export const api = {
  // Auth
  register: (body: any) => request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  loginWithTelegramWebApp: (data: { initData: string; user?: any }) =>
    request<{ user: any; token: string }>('/api/auth/telegram-webapp', { method: 'POST', body: JSON.stringify(data) }),
  createTelegramAuthSession: (botType?: 'customer' | 'business') =>
    request<{ sessionId: string; code: string; botUsername: string; botUrl: string; deepLink: string; tgDirect: string; expiresAt: string; botType?: string }>(
      '/api/auth/telegram-session',
      { method: 'POST', body: JSON.stringify({ bot_type: botType || 'customer' }) }
    ),
  checkTelegramAuthSession: (sessionId: string) =>
    request<{ status: 'PENDING' | 'CONFIRMED' | 'EXPIRED'; token?: string; user?: any }>(`/api/auth/telegram-session/${sessionId}`),
  consumeTelegramAuthSession: (sessionId: string) =>
    request<{ success: boolean }>(`/api/auth/telegram-session/${sessionId}/consume`, { method: 'POST' }),
  quickTelegramLogin: (data: { phone?: string; name?: string; username?: string; sessionId?: string; code?: string }) =>
    request<{ success: boolean; token: string; user: any; message: string }>('/api/auth/telegram-quick-login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<any>('/api/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: any }>('/api/auth/me'),
  getCurrentUser: () => request<{ user: any }>('/api/auth/me'),

  // Public Marketplace
  getCategories: () => request<any[]>('/api/categories'),
  getCities: () => request<any[]>('/api/cities'),
  getBusinesses: (params: { q?: string; category?: string; city?: string; sort?: string; page?: number; limit?: number; lat?: number; lng?: number }) => {
    const qp = new URLSearchParams();
    if (params.q) qp.set('q', params.q);
    if (params.category) qp.set('category', params.category);
    if (params.city) qp.set('city', params.city);
    if (params.sort) qp.set('sort', params.sort);
    if (params.page) qp.set('page', params.page.toString());
    if (params.limit) qp.set('limit', params.limit.toString());
    if (params.lat !== undefined && params.lng !== undefined) {
      qp.set('lat', params.lat.toString());
      qp.set('lng', params.lng.toString());
    }
    return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number; user_coords?: { lat: number; lng: number } }>(`/api/businesses?${qp.toString()}`);
  },
  getBusinessBySlug: (slug: string, coords?: { lat: number; lng: number }) => {
    const qp = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
    return request<{ business: any; services: any[]; staff: any[]; hours: any[]; reviews: any[] }>(`/api/businesses/${slug}${qp}`);
  },
  getAvailableSlots: (bizId: string, date: string, staffId: string, serviceId: string) =>
    request<{ slots: string[]; reason?: string; suggested_date?: string; suggested_date_formatted?: string }>(`/api/businesses/${bizId}/available-slots?date=${date}&staff_id=${staffId}&service_id=${serviceId}`),
  getPublicStats: () =>
    request<{ businesses: number; customers: number; queues: number; bookings: number }>('/api/public-stats'),

  // Booking
  createBooking: (data: any) => request<any>('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getCustomerBookings: (status?: string) => request<any[]>(`/api/customer/bookings${status ? `?status=${status}` : ''}`),
  cancelBooking: (id: string, reason?: string) => request<any>(`/api/customer/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rescheduleBooking: (id: string, date: string, time: string) =>
    request<any>(`/api/customer/bookings/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ booking_date: date, start_time: time }) }),
  sendBookingReminder: (id: string) => request<any>(`/api/bookings/${id}/send-reminder`, { method: 'POST' }),

  // Digital Queue
  joinQueue: (data: any) => request<any>('/api/queue/join', { method: 'POST', body: JSON.stringify(data) }),
  getMyActiveQueue: () => request<{ activeQueue: any | null }>('/api/queue/my-active'),
  getBusinessQueue: (bizId: string) => request<any[]>(`/api/business/${bizId}/queue`),
  queueAction: (id: string, action: 'CALL' | 'SERVE' | 'COMPLETE' | 'SKIP' | 'NO_SHOW') =>
    request<any>(`/api/business/queue/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
  requestNextCustomer: (businessId: string) =>
    request<{
      success: boolean;
      pendingActionId: string;
      message: string;
      waitingTelegramConfirmation: boolean;
      telegramChatId?: string;
      nextCustomer: any;
      currentCustomer: any;
    }>('/api/queue/next/request', { method: 'POST', body: JSON.stringify({ business_id: businessId }) }),
  confirmNextCustomer: (pendingActionId?: string, businessId?: string) =>
    request<{ success: boolean; message: string; calledCustomer: any; previousCustomer: any }>('/api/queue/next/confirm', {
      method: 'POST',
      body: JSON.stringify({ pending_action_id: pendingActionId, business_id: businessId })
    }),
  cancelPendingQueueAction: (pendingActionId: string) =>
    request<{ success: boolean; message: string }>('/api/queue/pending-cancel', {
      method: 'POST',
      body: JSON.stringify({ pending_action_id: pendingActionId })
    }),
  getPendingQueueStatus: (pendingActionId: string) =>
    request<{
      status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
      confirmed_at?: string;
      expires_at: string;
      calledCustomer?: any;
    }>(`/api/queue/pending-status/${pendingActionId}`),
  completeQueueService: (businessId: string, entryId?: string) =>
    request<{ success: boolean; message: string; completedCustomer: any }>('/api/queue/complete', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, entry_id: entryId })
    }),
  noShowQueueCustomer: (businessId: string, entryId: string) =>
    request<{ success: boolean; message: string }>('/api/queue/no-show', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, entry_id: entryId })
    }),
  operatorSkip: (entryId: string) =>
    request<{ success: boolean; message: string; status: string; skipCount: number }>('/api/operator/queue/skip', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId })
    }),
  operatorRecall: (entryId: string) =>
    request<{ success: boolean; message: string; customer: any }>('/api/operator/queue/recall', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId })
    }),
  acceptEarlyArrival: (bookingId: string) =>
    request<{ success: boolean; message: string; booking: any }>('/api/bookings/accept-early-arrival', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId })
    }),
  updateServiceDetails: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/api/business/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  createWalkInCustomer: (data: {
    business_id?: string;
    type: 'LIVE_QUEUE' | 'APPOINTMENT';
    customer_name?: string;
    customer_phone?: string;
    service_id: string;
    staff_id?: string;
    booking_date?: string;
    start_time?: string;
    guest_notes?: string;
    override_hours?: boolean;
  }) =>
    request<{
      success: boolean;
      type: 'LIVE_QUEUE' | 'APPOINTMENT';
      ticket: {
        id: string;
        queue_number?: string;
        booking_number?: string;
        customer_name: string;
        customer_phone?: string;
        service_name: string;
        service_price: number;
        service_duration: number;
        staff_name: string;
        business_name: string;
        business_address?: string;
        business_phone?: string;
        status: string;
        people_ahead?: number;
        estimated_wait_minutes?: number;
        booking_date?: string;
        start_time?: string;
        end_time?: string;
        source: string;
        created_at: string;
        is_repeat_customer?: boolean;
      };
    }>('/api/business/walk-in', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getCurrentQueueState: (businessId: string) =>
    request<{
      currentCustomer: any | null;
      nextCustomer: any | null;
      waitingCount: number;
      servedToday: number;
      pendingAction: any | null;
    }>(`/api/queue/current?business_id=${businessId}`),
  getWaitingQueueList: (businessId: string) =>
    request<{ waitingCustomers: any[]; count: number }>(`/api/queue/waiting?business_id=${businessId}`),
  getQueueAuditLogs: (businessId: string) =>
    request<any[]>(`/api/queue/audit-logs/${businessId}`),
  getTelegramHealth: () =>
    request<any>('/api/telegram/health'),

  // Dedicated Operator Queue Controls
  operatorCallNext: (businessId: string) =>
    request<{
      success: boolean;
      message: string;
      calledCustomer: any;
      previousCustomer: any;
    }>('/api/operator/queue/call-next', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId })
    }),
  operatorAccept: (entryId: string) =>
    request<{ success: boolean; status: string; message: string }>('/api/operator/queue/accept', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId })
    }),
  operatorCancel: (entryId: string) =>
    request<{ success: boolean; status: string; message: string }>('/api/operator/queue/cancel', {
      method: 'POST',
      body: JSON.stringify({ entry_id: entryId })
    }),

  // QR Code Instant Check-in
  resolveQRCode: (code: string) =>
    request<{
      type: 'business' | 'booking' | 'queue_ticket';
      business?: any;
      liveQueue?: { activeCount: number; estimatedWaitMinutes: number; avgDurationMinutes: number };
      services?: any[];
      booking?: any;
      queue?: any;
    }>('/api/check-in/resolve', { method: 'POST', body: JSON.stringify({ code }) }),
  instantQueueCheckIn: (data: {
    business_id: string;
    service_id?: string;
    customer_name?: string;
    customer_phone?: string;
    telegram_chat_id?: string;
  }) =>
    request<{
      success: boolean;
      queueEntry: any;
      token?: string;
      user?: any;
    }>('/api/check-in/instant-queue', { method: 'POST', body: JSON.stringify(data) }),

  // Reviews
  createReview: (data: any) => request<any>('/api/reviews', { method: 'POST', body: JSON.stringify(data) }),

  // Business Dashboard & CRM
  getCurrentBusiness: () => request<{ business: any; stats: any }>('/api/business/current'),
  getCalendarBookings: (startDate?: string, endDate?: string) => {
    const qp = new URLSearchParams();
    if (startDate) qp.set('start_date', startDate);
    if (endDate) qp.set('end_date', endDate);
    return request<any[]>(`/api/business/calendar?${qp.toString()}`);
  },
  updateBookingStatus: (id: string, status: string) => request<any>(`/api/business/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  getCRMCustomers: (q?: string) => request<any[]>(`/api/business/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getBusinessServices: () => request<any[]>('/api/business/services'),
  createBusinessService: (data: any) => request<any>('/api/business/services', { method: 'POST', body: JSON.stringify(data) }),
  deleteBusinessService: (id: string) => request<any>(`/api/business/services/${id}`, { method: 'DELETE' }),
  getBusinessStaff: () => request<any[]>('/api/business/staff'),
  createBusinessStaff: (data: any) => request<any>('/api/business/staff', { method: 'POST', body: JSON.stringify(data) }),
  cancelBusinessBooking: (id: string, reason?: string) => request<any>(`/api/business/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rescheduleBusinessBooking: (id: string, date: string, time: string, staff_id?: string) =>
    request<any>(`/api/business/bookings/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ booking_date: date, start_time: time, staff_id }) }),
  getBusinessBlockedTimes: () => request<any[]>('/api/business/blocked-times'),
  createBusinessBlockedTime: (data: { staff_id?: string | null; title: string; start_datetime: string; end_datetime: string }) =>
    request<any>('/api/business/blocked-times', { method: 'POST', body: JSON.stringify(data) }),
  deleteBusinessBlockedTime: (id: string) => request<any>(`/api/business/blocked-times/${id}`, { method: 'DELETE' }),

  // Admin Blocked Times
  getAdminBlockedTimes: (business_id?: string) => request<any[]>(`/api/admin/blocked-times${business_id ? `?business_id=${business_id}` : ''}`),
  createAdminBlockedTime: (data: { business_id: string; staff_id?: string | null; title: string; start_datetime: string; end_datetime: string }) =>
    request<any>('/api/admin/blocked-times', { method: 'POST', body: JSON.stringify(data) }),
  deleteAdminBlockedTime: (id: string) => request<any>(`/api/admin/blocked-times/${id}`, { method: 'DELETE' }),
  registerBusiness: (data: any) => request<any>('/api/businesses/register', { method: 'POST', body: JSON.stringify(data) }),

  // Multi-business Management
  getMyBusinesses: () => request<{ businesses: any[]; activeBusinessId: string | null }>('/api/business/my-businesses'),
  switchActiveBusiness: (id: string) => request<{ success: boolean; business: any }>(`/api/business/switch/${id}`, { method: 'POST' }),

  // Subscriptions & Telegram (1 Month Validity & 14-Day Free Trial)
  getBusinessSubscription: () => request<any>('/api/business/subscription'),
  requestTelegramPayment: (data: { plan_code: string }) =>
    request<{
      success: boolean;
      transactionId: string;
      message: string;
      telegramUrl: string;
      plan: any;
      status: string;
    }>('/api/business/request-telegram-payment', { method: 'POST', body: JSON.stringify(data) }),
  activateBusinessTrial: () => request<any>('/api/business/activate-trial', { method: 'POST' }),
  confirmAdminPayment: (id: string) => request<any>(`/api/admin/subscription-transactions/${id}/confirm`, { method: 'POST' }),
  cancelAdminPayment: (id: string) => request<any>(`/api/admin/subscription-transactions/${id}/cancel`, { method: 'POST' }),
  renewBusinessSubscription: (data: { plan_code?: string; months?: number; payment_method?: string }) =>
    request<any>('/api/business/renew-subscription', { method: 'POST', body: JSON.stringify(data) }),
  updateBusinessTelegram: (data: { telegram_chat_id: string; telegram_channel_or_group?: string; send_test?: boolean }) =>
    request<any>('/api/business/telegram-settings', { method: 'POST', body: JSON.stringify(data) }),
  updateUserTelegram: (data: { telegram_chat_id: string; send_test?: boolean }) =>
    request<any>('/api/user/telegram-settings', { method: 'POST', body: JSON.stringify(data) }),
  sendTestTelegram: (data: { chat_id: string; message?: string }) =>
    request<any>('/api/telegram/test', { method: 'POST', body: JSON.stringify(data) }),
  getTelegramBotInfo: () =>
    request<{ botUsername: string; isConfigured: boolean; botUrl: string }>('/api/telegram/bot-info'),
  generateTelegramLinkToken: () =>
    request<{ linkToken: string; deepLink: string; botUsername: string }>('/api/telegram/generate-link-token', { method: 'POST' }),
  sendQueueTicketToTelegram: (entryId: string, chatId?: string) =>
    request<{ success: boolean; message: string; details?: any }>(`/api/queue/${entryId}/send-to-telegram`, { method: 'POST', body: JSON.stringify({ chat_id: chatId }) }),
  sendBookingVoucherToTelegram: (bookingId: string, chatId?: string) =>
    request<{ success: boolean; message: string; details?: any }>(`/api/bookings/${bookingId}/send-to-telegram`, { method: 'POST', body: JSON.stringify({ chat_id: chatId }) }),

  // Admin Panel (Advanced & Comprehensive)
  getAdminOverview: () => request<any>('/api/admin/overview'),
  getAdminCharts: () => request<any>('/api/admin/stats-charts'),
  getAdminBusinesses: () => request<any[]>('/api/admin/businesses'),
  createAdminBusiness: (data: any) => request<any>('/api/admin/businesses', { method: 'POST', body: JSON.stringify(data) }),
  acceptBusinessInvitation: (token: string) => request<any>(`/api/invitations/${token}/accept`, { method: 'POST' }),
  updateAdminBusinessStatus: (id: string, data: { status?: string; is_verified?: boolean; reason?: string }) =>
    request<any>(`/api/admin/businesses/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminAllBookings: (params: { status?: string; q?: string; page?: number; limit?: number }) => {
    const qp = new URLSearchParams();
    if (params.status) qp.set('status', params.status);
    if (params.q) qp.set('q', params.q);
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    return request<{ bookings: any[]; total: number; page: number; totalPages: number }>(`/api/admin/all-bookings?${qp.toString()}`);
  },
  updateAdminBookingStatus: (id: string, status: string) =>
    request<any>(`/api/admin/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  getAdminSubscriptions: () => request<{ subscriptions: any[]; pendingTransactions: any[]; transactions: any[] }>('/api/admin/subscriptions'),
  extendAdminSubscription: (bizId: string, data: { months?: number; plan_code?: string }) =>
    request<any>(`/api/admin/businesses/${bizId}/extend-subscription`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminTelegramLogs: () => request<any[]>('/api/admin/telegram-logs'),
  sendAdminTelegram: (data: { chat_id: string; message: string }) =>
    request<any>('/api/admin/telegram/send', { method: 'POST', body: JSON.stringify(data) }),
  getAdminTelegramRecipientsCount: () =>
    request<{ customersCount: number; businessesCount: number; totalCount: number }>('/api/admin/telegram/recipients-count'),
  getAdminTelegramRecipients: (type: 'customer' | 'business') =>
    request<any[]>(`/api/admin/telegram/recipients?type=${type}`),
  sendAdminTelegramBroadcast: (data: {
    target: 'single_customer' | 'single_business' | 'all_customers' | 'all_businesses';
    target_id?: string;
    chat_id?: string;
    template_type?: string;
    title?: string;
    message: string;
    idempotency_key?: string;
  }) => request<{ success: boolean; total: number; sent: number; failed: number; blocked: number; results?: any[] }>(
    '/api/admin/telegram/broadcast',
    { method: 'POST', body: JSON.stringify(data) }
  ),
  getAdminSystemHealth: () => request<any>('/api/admin/system-health'),
  getAdminUsers: () => request<any[]>('/api/admin/users'),
  createAdminUser: (data: { name: string; email: string; phone?: string; password: string; role?: string }) =>
    request<any>('/api/admin/users/create', { method: 'POST', body: JSON.stringify(data) }),
  resetAdminUserPassword: (id: string, password: string) =>
    request<any>(`/api/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  updateAdminUserStatus: (id: string, data: { status?: string; role?: string; reason?: string }) =>
    request<any>(`/api/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminAuditLogs: () => request<any[]>('/api/admin/audit-logs'),
  getAdminQueues: () => request<any[]>('/api/admin/queues'),
  getAdminServices: () => request<any[]>('/api/admin/services'),
  getAdminStaff: () => request<any[]>('/api/admin/staff'),
  getAdminReviews: () => request<any[]>('/api/admin/reviews'),
  deleteAdminReview: (id: string) => request<any>(`/api/admin/reviews/${id}/delete`, { method: 'POST' }),
  getAdminPromotions: () => request<any[]>('/api/admin/promotions'),
  getAdminReports: () => request<any>('/api/admin/reports'),

  // Plans & Notifications
  getPlans: () => request<any[]>('/api/plans'),
  getNotifications: () => request<any[]>('/api/notifications'),
  markNotificationAsRead: (id: string) => request<any>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsAsRead: () => request<any>('/api/notifications/read-all', { method: 'POST' }),

  // Customer Favorites & Profile
  getCustomerFavorites: () => request<any[]>('/api/customer/favorites'),
  getCustomerFavoriteIds: () => request<string[]>('/api/customer/favorites/ids'),
  toggleCustomerFavorite: (businessId: string) => request<{ isSaved: boolean }>(`/api/customer/favorites/${businessId}/toggle`, { method: 'POST' }),
  getCustomerProfile: () => request<any>('/api/customer/profile'),
  updateCustomerProfile: (data: { name?: string; phone?: string; telegram_chat_id?: string; reminder_30m_enabled?: number; telegram_reminders_enabled?: number }) =>
    request<any>('/api/customer/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Business Profile, Hours & Promotion
  getBusinessProfileSettings: () => request<any>('/api/business/profile'),
  updateBusinessProfileSettings: (data: any) => request<any>('/api/business/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getBusinessWorkingHours: () => request<any[]>('/api/business/working-hours'),
  updateBusinessWorkingHours: (hours: any[]) => request<any>('/api/business/working-hours', { method: 'PUT', body: JSON.stringify({ hours }) }),
  uploadImage: async (file: File): Promise<{ success: boolean; url: string; filename: string }> => {
    return new Promise<{ success: boolean; url: string; filename: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await request<{ success: boolean; url: string; filename: string }>('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              data: reader.result as string,
              filename: file.name,
              mimeType: file.type
            })
          });
          resolve(res);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Faylni o‘qishda xatolik yuz berdi'));
      reader.readAsDataURL(file);
    });
  },
  promoteBusiness: (data: { duration_days?: number; payment_method?: string }) =>
    request<any>('/api/business/promote', { method: 'POST', body: JSON.stringify(data) }),
  getBusinessAdAnalytics: () => request<any>('/api/business/ad-analytics'),

  // Public TV Queue Display
  getPublicQueueBoard: (slug: string) => request<any>(`/api/public-queue/${slug}`),

  // ==========================================
  // OPERATING PARTNER & CRM & COMMISSION API
  // ==========================================
  getPartnerOverview: () => request<OperatingPartnerOverview>('/api/partner/overview'),
  getPartnerBusinesses: () => request<any[]>('/api/partner/businesses'),
  createPartnerBusiness: (data: any) =>
    request<any>('/api/partner/businesses', { method: 'POST', body: JSON.stringify(data) }),
  updatePartnerBusinessStatus: (id: string, status: string, reason?: string) =>
    request<any>(`/api/partner/businesses/${id}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) }),
  updatePartnerBusinessProfile: (id: string, data: any) =>
    request<any>(`/api/partner/businesses/${id}/profile`, { method: 'POST', body: JSON.stringify(data) }),
  updatePartnerBusinessTariff: (id: string, data: { plan_code: string; months?: number }) =>
    request<any>(`/api/partner/businesses/${id}/tariff`, { method: 'POST', body: JSON.stringify(data) }),
  addPartnerBusinessService: (id: string, data: any) =>
    request<any>(`/api/partner/businesses/${id}/services`, { method: 'POST', body: JSON.stringify(data) }),
  deletePartnerBusinessService: (bizId: string, serviceId: string) =>
    request<any>(`/api/partner/businesses/${bizId}/services/${serviceId}`, { method: 'DELETE' }),
  addPartnerBusinessStaff: (id: string, data: any) =>
    request<any>(`/api/partner/businesses/${id}/staff`, { method: 'POST', body: JSON.stringify(data) }),
  deletePartnerBusinessStaff: (bizId: string, staffId: string) =>
    request<any>(`/api/partner/businesses/${bizId}/staff/${staffId}`, { method: 'DELETE' }),

  // CRM
  getCRMLeads: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status && params.status !== 'ALL') q.append('status', params.status);
    return request<CRMLead[]>(`/api/partner/crm/leads?${q.toString()}`);
  },
  createCRMLead: (data: Partial<CRMLead>) =>
    request<CRMLead>('/api/partner/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateCRMLead: (id: string, data: Partial<CRMLead>) =>
    request<CRMLead>(`/api/partner/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateCRMLeadStage: (id: string, status: string) =>
    request<CRMLead>(`/api/partner/crm/leads/${id}/stage`, { method: 'POST', body: JSON.stringify({ status }) }),
  convertCRMLeadToBusiness: (id: string, data: { plan_code?: string; owner_password?: string }) =>
    request<any>(`/api/partner/crm/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCRMLead: (id: string) =>
    request<any>(`/api/partner/crm/leads/${id}`, { method: 'DELETE' }),

  // Commissions
  getPartnerCommissions: () =>
    request<{ commissions: PartnerCommission[]; summary: CommissionSummary }>('/api/partner/commissions'),
  settleCommissionPayout: (id: string, payoutNotes?: string) =>
    request<any>(`/api/partner/commissions/${id}/settle`, { method: 'POST', body: JSON.stringify({ payout_notes: payoutNotes }) }),

  // Reports
  getPartnerReports: () => request<PartnerReport[]>('/api/partner/reports'),
  generatePartnerReportDraft: (report_type: 'WEEKLY' | 'MONTHLY') =>
    request<Partial<PartnerReport>>('/api/partner/reports/generate-draft', { method: 'POST', body: JSON.stringify({ report_type }) }),
  submitPartnerReport: (data: any) =>
    request<PartnerReport>('/api/partner/reports', { method: 'POST', body: JSON.stringify(data) }),
  reviewPartnerReport: (id: string, data: { founder_feedback: string }) =>
    request<any>(`/api/partner/reports/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Support Tickets
  getPartnerSupportTickets: () => request<SupportTicket[]>('/api/partner/support-tickets'),
  createSupportTicket: (data: Partial<SupportTicket>) =>
    request<SupportTicket>('/api/partner/support-tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateSupportTicketStatus: (id: string, data: { status: string; resolution_notes?: string }) =>
    request<SupportTicket>(`/api/partner/support-tickets/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),

  // KPIs & Audit
  getOperatingKPIs: () => request<OperatingPartnerKPI>('/api/partner/kpis'),
  getPartnerAuditLogs: (params?: { action?: string; target_type?: string }) => {
    const q = new URLSearchParams();
    if (params?.action) q.append('action', params.action);
    if (params?.target_type) q.append('target_type', params.target_type);
    return request<OperatingAuditLog[]>(`/api/partner/audit-logs?${q.toString()}`);
  },
  getPartnerTeamUsers: () => request<any[]>('/api/partner/team-users'),
  createPartnerTeamUser: (data: any) =>
    request<any>('/api/partner/team-users', { method: 'POST', body: JSON.stringify(data) }),

  // Live Queue Display (TV Screens)
  getBusinessScreens: () =>
    request<{ screens: import('./types').BusinessScreen[] }>('/api/business/screens'),
  createBusinessScreen: (data: { name: string; service_ids?: string[]; room_name?: string }) =>
    request<{ screen: import('./types').BusinessScreen }>('/api/business/screens', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateBusinessScreen: (id: string, data: { name?: string; service_ids?: string[]; room_name?: string; is_active?: boolean }) =>
    request<{ screen: import('./types').BusinessScreen }>(`/api/business/screens/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  regenerateScreenToken: (id: string) =>
    request<{ success: boolean; display_token: string; url: string }>(`/api/business/screens/${id}/regenerate-token`, {
      method: 'POST'
    }),
  deleteBusinessScreen: (id: string) =>
    request<{ success: boolean }>(`/api/business/screens/${id}`, {
      method: 'DELETE'
    }),
  getDisplayData: (token: string) =>
    request<import('./types').LiveDisplayData>(`/api/display/${token}`),

  // ==========================================
  // MONETIZATION MODULE API
  // ==========================================
  // Plans
  getAdminPlans: () => request<import('./types').SubscriptionPlan[]>('/api/admin/plans'),
  createAdminPlan: (data: any) =>
    request<import('./types').SubscriptionPlan>('/api/admin/plans', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminPlan: (id: string, data: any) =>
    request<import('./types').SubscriptionPlan>(`/api/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleAdminPlanStatus: (id: string, action: 'activate' | 'deactivate' | 'open_sales' | 'close_sales') =>
    request<import('./types').SubscriptionPlan>(`/api/admin/plans/${id}/status`, { method: 'PATCH', body: JSON.stringify({ action }) }),

  // Checkout (Click, Payme, Telegram)
  initiatePaymentCheckout: (data: { plan_code?: string; service_code?: string; ad_type?: string; duration_days?: number; payment_method: 'CLICK' | 'PAYME' | 'TELEGRAM' }) =>
    request<{
      success: boolean;
      transactionId: string;
      amount_uzs: number;
      payment_method: string;
      checkoutUrl?: string;
      qrPayload?: string;
      is_demo_mode?: boolean;
      message?: string;
    }>('/api/business/checkout/initiate', { method: 'POST', body: JSON.stringify(data) }),

  // Extra Services
  getExtraServices: () => request<import('./types').ExtraServiceItem[]>('/api/extra-services'),
  orderExtraService: (data: { service_code: string; notes?: string; payment_method?: string }) =>
    request<{ success: boolean; order: import('./types').ExtraServiceOrderItem; checkout?: any }>('/api/business/extra-services/order', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getBusinessExtraServiceOrders: () => request<import('./types').ExtraServiceOrderItem[]>('/api/business/extra-services/orders'),
  getAdminExtraServices: () => request<import('./types').ExtraServiceItem[]>('/api/admin/extra-services'),
  updateAdminExtraService: (id: string, data: any) =>
    request<import('./types').ExtraServiceItem>(`/api/admin/extra-services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAdminExtraServiceOrders: () => request<import('./types').ExtraServiceOrderItem[]>('/api/admin/extra-services/orders'),
  updateAdminExtraServiceOrderStatus: (id: string, status: string) =>
    request<any>(`/api/admin/extra-services/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Monetization Dashboard & Expenses
  getAdminMonetizationStats: () => request<import('./types').SuperAdminMonetizationStats>('/api/admin/monetization/stats'),
  getAdminMonetizationExpenses: () => request<import('./types').MonetizationExpenseItem[]>('/api/admin/monetization/expenses'),
  addAdminMonetizationExpense: (data: { category: string; title: string; amount_uzs: number; expense_date: string; notes?: string }) =>
    request<import('./types').MonetizationExpenseItem>('/api/admin/monetization/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteAdminMonetizationExpense: (id: string) =>
    request<{ success: boolean }>(`/api/admin/monetization/expenses/${id}`, { method: 'DELETE' }),

  // Telegram Queue & Alerts
  triggerSubscriptionAlertCheck: () => request<{ success: boolean; processed: number; message: string }>('/api/admin/subscription-alerts/check', { method: 'POST' }),
  getTelegramQueueStatus: () => request<{ queue: any[]; count: number }>('/api/admin/telegram-queue')
};

