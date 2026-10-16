import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, MapPin, AlertCircle, CheckCircle2, 
  XCircle, Star, Phone, RefreshCw, ChevronRight, Share2,
  Send, Bell, Smartphone, Heart, User as UserIcon, Check,
  Trash2, ExternalLink, History, RotateCcw, CalendarPlus,
  CalendarCheck, X, Sparkles, Mail, ShieldCheck
} from 'lucide-react';
import { api } from '../api';
import { Booking, QueueEntry, User, FavoriteBusiness, NotificationItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { ReviewModal } from './ReviewModal';
import { formatPhoneNumber, formatRole, sanitizeName } from '../utils/formatters';

export type CustomerDashboardTab = 'bookings' | 'queue' | 'favorites' | 'history' | 'profile';

interface CustomerDashboardProps {
  currentUser: User;
  initialTab?: CustomerDashboardTab;
  onExploreBusinesses: () => void;
  onSelectBusiness?: (business: any) => void;
  onUserUpdate?: (user: User) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  currentUser,
  initialTab = 'bookings',
  onExploreBusinesses,
  onSelectBusiness,
  onUserUpdate,
}) => {
  const { t, translateCategory, translateCity } = useTranslation();
  const [activeTab, setActiveTab] = useState<CustomerDashboardTab>(initialTab || 'bookings');
  
  // Data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeQueue, setActiveQueue] = useState<any | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CONFIRMED' | 'PENDING'>('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Customer Profile & Telegram Form
  const [profileName, setProfileName] = useState<string>(currentUser.name || '');
  const [profilePhone, setProfilePhone] = useState<string>(currentUser.phone || '');
  const [profileTelegram, setProfileTelegram] = useState<string>(currentUser.telegram_chat_id || '');
  const [reminder30mEnabled, setReminder30mEnabled] = useState<boolean>(
    currentUser.reminder_30m_enabled !== undefined ? currentUser.reminder_30m_enabled === 1 : true
  );
  const [togglingReminder, setTogglingReminder] = useState<boolean>(false);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');
  const [testTgStatus, setTestTgStatus] = useState<string | null>(null);
  const [testingTg, setTestingTg] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Re-booking Modal State
  const [rebookModalOpen, setRebookModalOpen] = useState<boolean>(false);
  const [selectedHistoryBooking, setSelectedHistoryBooking] = useState<Booking | null>(null);
  const [rebookDate, setRebookDate] = useState<string>('');
  const [rebookTime, setRebookTime] = useState<string>('10:00');
  const [rebookingInProgress, setRebookingInProgress] = useState<boolean>(false);
  const [rebookingSuccessData, setRebookingSuccessData] = useState<any | null>(null);
  const [rebookingError, setRebookingError] = useState<string | null>(null);

  // Notifications modal
  const [notificationsModalOpen, setNotificationsModalOpen] = useState<boolean>(false);

  // Synchronize when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bList, qRes, favs, notifs, profile] = await Promise.all([
        api.getCustomerBookings(),
        api.getMyActiveQueue(),
        api.getCustomerFavorites().catch(() => []),
        api.getNotifications().catch(() => []),
        api.getCustomerProfile().catch(() => null),
      ]);
      setBookings(bList || []);
      setActiveQueue(qRes?.activeQueue || null);
      setFavorites(favs || []);
      setNotifications(notifs || []);
      if (profile) {
        if (profile.name) setProfileName(profile.name);
        if (profile.phone) setProfilePhone(profile.phone);
        if (profile.telegram_chat_id) setProfileTelegram(profile.telegram_chat_id);
        if (profile.reminder_30m_enabled !== undefined) {
          setReminder30mEnabled(profile.reminder_30m_enabled === 1);
        }
      }
    } catch (err) {
      console.error('Customer dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle30mReminder = async () => {
    const nextVal = !reminder30mEnabled;
    setReminder30mEnabled(nextVal);
    setTogglingReminder(true);
    try {
      const res = await api.updateCustomerProfile({
        name: profileName,
        phone: profilePhone,
        telegram_chat_id: profileTelegram,
        reminder_30m_enabled: nextVal ? 1 : 0,
      });
      if (res.user && onUserUpdate) {
        onUserUpdate(res.user);
      }
      setProfileSuccess(nextVal ? '30 daqiqa oldin Telegram eslatma yoqildi' : '30 daqiqa oldin Telegram eslatma o‘chirildi');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setReminder30mEnabled(!nextVal);
      setProfileError(err.message || 'Xatolik yuz berdi');
      setTimeout(() => setProfileError(''), 4000);
    } finally {
      setTogglingReminder(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      const res = await api.updateCustomerProfile({
        name: profileName,
        phone: profilePhone,
        telegram_chat_id: profileTelegram,
        reminder_30m_enabled: reminder30mEnabled ? 1 : 0,
      });
      if (res.user && onUserUpdate) {
        onUserUpdate(res.user);
      }
      setProfileSuccess(t('saved'));
      setTimeout(() => setProfileSuccess(''), 4000);
      if (profileTelegram) {
        api.sendTestTelegram({ chat_id: profileTelegram }).catch(() => {});
      }
    } catch (err: any) {
      setProfileError(err.message || 'Xatolik yuz berdi');
      setTimeout(() => setProfileError(''), 5000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemoveFavorite = async (businessId: string) => {
    try {
      await api.toggleCustomerFavorite(businessId);
      setFavorites(prev => prev.filter(f => f.id !== businessId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleCancelBooking = async (id: string) => {
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!window.confirm(t('confirm_cancel_booking'))) return;
      }
    } catch {
      // Proceed if confirm is blocked
    }
    try {
      await api.cancelBooking(id, 'Cancelled by customer');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Bandlikni bekor qilishda xatolik yuz berdi');
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newDate || !newTime) return;

    setRescheduleError(null);
    try {
      await api.rescheduleBooking(rescheduleBooking.id, newDate, newTime);
      setRescheduleBooking(null);
      loadData();
    } catch (err: any) {
      setRescheduleError(err.message || 'Xatolik yuz berdi');
    }
  };

  // Google Calendar link generator
  const getGoogleCalendarUrl = (b: Booking) => {
    const title = encodeURIComponent(`${b.service_name} — ${b.business_name}`);
    const details = encodeURIComponent(`NavbatBor: ${b.staff_name}, #${b.booking_number}`);
    const location = encodeURIComponent(b.business_address || '');
    
    const startDate = b.booking_date.replace(/-/g, '');
    const startTime = (b.start_time || '10:00').replace(':', '') + '00';
    const endTime = (b.end_time || '11:00').replace(':', '') + '00';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}T${startTime}/${startDate}T${endTime}&details=${details}&location=${location}`;
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isPastBooking = (b: Booking) => {
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(b.status)) return true;
    if (b.booking_date < todayStr) return true;
    return false;
  };

  const upcomingBookings = bookings.filter((b) => !isPastBooking(b));
  const pastBookings = bookings.filter((b) => isPastBooking(b));

  const filteredUpcomingBookings = upcomingBookings.filter((b) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (filterStatus === 'PENDING') return b.status === 'PENDING';
    return true;
  });

  const filteredPastBookings = pastBookings.filter((b) => {
    if (historyFilterStatus === 'ALL') return true;
    if (historyFilterStatus === 'COMPLETED') return b.status === 'COMPLETED';
    if (historyFilterStatus === 'CANCELLED') return ['CANCELLED', 'NO_SHOW'].includes(b.status);
    return true;
  });

  const handleOpenRebook = (b: Booking) => {
    setSelectedHistoryBooking(b);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRebookDate(tomorrow.toISOString().slice(0, 10));
    setRebookTime(b.start_time || '10:00');
    setRebookingError(null);
    setRebookingSuccessData(null);
    setRebookModalOpen(true);
  };

  const handleConfirmRebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHistoryBooking || !rebookDate || !rebookTime) return;

    setRebookingInProgress(true);
    setRebookingError(null);
    try {
      const res = await api.createBooking({
        business_id: selectedHistoryBooking.business_id,
        service_id: selectedHistoryBooking.service_id,
        staff_id: selectedHistoryBooking.staff_id,
        booking_date: rebookDate,
        start_time: rebookTime,
        customer_name: currentUser.name,
        customer_phone: currentUser.phone,
      });
      setRebookingSuccessData(res.booking || res);
      await loadData();
    } catch (err: any) {
      setRebookingError(err.message || 'Bron qilishda xatolik yuz berdi');
    } finally {
      setRebookingInProgress(false);
    }
  };

  const unreadNotifsCount = notifications.filter(n => n.is_read === 0).length;

  // The 5 Customer Dashboard tabs strictly following requirement 3:
  const dashboardTabs: { id: CustomerDashboardTab; label: string; icon: any; count?: number; countColor?: string }[] = [
    { id: 'bookings', label: t('tab_my_bookings'), icon: Calendar, count: upcomingBookings.length },
    { id: 'queue', label: t('tab_live_queue'), icon: Clock, count: activeQueue ? 1 : 0, countColor: 'bg-amber-500 text-white' },
    { id: 'favorites', label: t('tab_saved'), icon: Heart, count: favorites.length },
    { id: 'history', label: t('tab_history'), icon: History, count: pastBookings.length },
    { id: 'profile', label: t('tab_profile'), icon: UserIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 md:py-8">
      {/* Title & Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {t('my_cabinet')}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {formatRole(currentUser.role, t)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t('welcome_user', { name: sanitizeName(currentUser.name) })}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Notifications Trigger */}
          <button
            id="customer-notifications-btn"
            onClick={() => setNotificationsModalOpen(true)}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 relative transition shadow-2xs cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title={t('notifications')}
            aria-label={t('notifications')}
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Quick Search / Explore */}
          <button
            id="customer-explore-btn"
            onClick={onExploreBusinesses}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer min-h-[40px]"
          >
            <span>{t('search_button')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Bar: Exactly 5 items (Bronlarim, Jonli navbatim, Saqlanganlar, Bronlar tarixi, Profilim) */}
      <div 
        role="tablist"
        aria-label="Mijoz bo‘limlari"
        className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto no-scrollbar text-xs"
      >
        {dashboardTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`customer-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 sm:px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap relative cursor-pointer min-h-[40px] ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive 
                    ? 'bg-white text-blue-700' 
                    : (tab.countColor || 'bg-slate-200 text-slate-700')
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. BRONLARIM — Kelajakdagi va faol bronlar                              */}
      {/* ========================================================================= */}
      {activeTab === 'bookings' && (
        <div className="space-y-5">
          {/* Status Filter Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs w-full sm:w-auto">
              {[
                { id: 'ALL', label: t('cat_all'), count: upcomingBookings.length },
                { id: 'CONFIRMED', label: t('status_confirmed'), count: upcomingBookings.filter(b => b.status === 'CONFIRMED').length },
                { id: 'PENDING', label: t('status_pending'), count: upcomingBookings.filter(b => b.status === 'PENDING').length },
              ].map((f) => {
                const isSelected = filterStatus === f.id;
                return (
                  <button
                    key={f.id}
                    id={`upcoming-filter-${f.id.toLowerCase()}`}
                    onClick={() => setFilterStatus(f.id as any)}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Switch to History link */}
            {pastBookings.length > 0 && (
              <button
                onClick={() => setActiveTab('history')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>{t('tab_history')} ({pastBookings.length}) →</span>
              </button>
            )}
          </div>

          {/* Bookings List or Empty State */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span>{t('loading')}</span>
            </div>
          ) : upcomingBookings.length === 0 ? (
            /* Empty State as requested: Faol bronlaringiz yo‘q. Kerakli xizmatni topib, bron qilishingiz mumkin. */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {t('no_active_bookings_title')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                {t('no_active_bookings_desc')}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  id="empty-search-btn"
                  onClick={onExploreBusinesses}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer min-h-[40px] flex items-center gap-1.5"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>{t('search_button')}</span>
                </button>
                {pastBookings.length > 0 && (
                  <button
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer min-h-[40px] flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{t('tab_history')} ({pastBookings.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : filteredUpcomingBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Ushbu holatda faol bronlar topilmadi</p>
              <button
                onClick={() => setFilterStatus('ALL')}
                className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Barchasini ko‘rish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUpcomingBookings.map((b) => (
                <div 
                  key={b.id} 
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                        #{b.booking_number}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {b.status === 'CONFIRMED' ? t('status_confirmed') : t('status_pending')}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base">{b.business_name}</h3>
                    <p className="text-xs text-blue-600 font-bold mt-0.5">{b.service_name}</p>

                    <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {b.booking_date}, {b.start_time} - {b.end_time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Mutaxassis: <strong className="text-slate-700">{b.staff_name}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{b.business_address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black text-slate-900">
                      {Number(b.total_price_uzs).toLocaleString('uz-UZ')} UZS
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Google Calendar Link */}
                      <a
                        href={getGoogleCalendarUrl(b)}
                        target="_blank"
                        rel="noreferrer"
                        title="Google Calendar"
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      {/* Reschedule */}
                      <button
                        onClick={() => {
                          setRescheduleBooking(b);
                          setNewDate(b.booking_date);
                          setNewTime(b.start_time);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer min-h-[36px]"
                      >
                        {t('reschedule_booking')}
                      </button>

                      {/* Cancel */}
                      <button
                        onClick={() => handleCancelBooking(b.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer min-h-[36px]"
                      >
                        {t('cancel_booking')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. JONLI NAVBATIM — Navbat raqami, holati va taxminiy kutish vaqti        */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {activeQueue ? (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-amber-500/15">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    <span>{t('tab_live_queue')}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black">{activeQueue.business_name}</h2>
                  <p className="text-xs text-white/90">
                    {activeQueue.service_name} • {activeQueue.business_address}
                  </p>
                </div>

                <div className="flex items-center justify-around sm:justify-start gap-4 sm:gap-6 bg-black/20 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-white/80">{t('your_ticket')}</span>
                    <div className="text-3xl sm:text-4xl font-black font-mono mt-1">{activeQueue.queue_number}</div>
                  </div>
                  <div className="h-10 sm:h-12 w-px bg-white/20" />
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-white/80">{t('people_ahead')}</span>
                    <div className="text-2xl sm:text-3xl font-bold mt-1">{activeQueue.peopleAhead}</div>
                  </div>
                  <div className="h-10 sm:h-12 w-px bg-white/20" />
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-white/80">{t('est_wait_time')}</span>
                    <div className="text-2xl sm:text-3xl font-bold mt-1">{activeQueue.estimatedWaitMinutes} {t('minute_unit')}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-white shrink-0" />
                  <span>
                    {activeQueue.telegram_chat_id || currentUser?.telegram_chat_id 
                      ? `Telegram ulangan (${activeQueue.telegram_chat_id || currentUser?.telegram_chat_id}) — Navbat kelganda bot xabar yuboradi`
                      : 'Telegram ulanmagan — xabarlarni o‘tkazib yubormaslik uchun botni faollashtiring'}
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={`https://t.me/Navbat1Uzb_bot?start=queue_${activeQueue.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-white text-amber-800 hover:bg-amber-50 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-xs min-h-[38px]"
                  >
                    <Send className="w-3.5 h-3.5 fill-amber-800" />
                    <span>{activeQueue.telegram_chat_id || currentUser?.telegram_chat_id ? 'Botni ochish' : 'Botda faollashtirish'}</span>
                  </a>
                  <button
                    onClick={loadData}
                    className="px-3.5 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('apply')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Jonli navbatingiz yo‘q</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Hozirda hech qanday muassasada navbatda emassiz. Joyida QR kodni skanerlab yoki katalog orqali jonli navbat olishingiz mumkin.
              </p>
              <button
                onClick={onExploreBusinesses}
                className="mt-5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer min-h-[40px]"
              >
                {t('search_button')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SAQLANGANLAR — Foydalanuvchi saqlagan xizmatlar yoki bizneslar           */}
      {/* ========================================================================= */}
      {activeTab === 'favorites' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('tab_saved')}</h2>
              <p className="text-xs text-slate-500">Tezkor bron qilish uchun saqlangan muassasalar</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {favorites.length} ta
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Saqlanganlar yo‘q</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Sizga yoqqan xizmat va muassasalarni keyinchalik tezkor topish uchun saqlab qo‘yishingiz mumkin.
              </p>
              <button
                onClick={onExploreBusinesses}
                className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer min-h-[40px]"
              >
                {t('search_button')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((fav) => (
                <div key={fav.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                        {translateCategory(fav.category_slug || fav.category_name)}
                      </span>
                      <button
                        onClick={() => handleRemoveFavorite(fav.id)}
                        title="O‘chirish"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{fav.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {fav.district ? `${fav.district}, ` : ''}{fav.address}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-amber-500 font-bold mt-2">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{Number(fav.avg_rating || 5).toFixed(1)}</span>
                      <span className="text-slate-400 text-[10px] font-normal">({fav.review_count || 0})</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => onSelectBusiness && onSelectBusiness(fav)}
                      className="w-full py-2.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[38px]"
                    >
                      {t('book_time')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BRONLAR TARIXI — Yakunlangan va bekor qilingan tarixiy bronlar         */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* Sub-filter row */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            {[
              { id: 'ALL', label: t('cat_all'), count: pastBookings.length },
              { id: 'COMPLETED', label: t('status_completed'), count: pastBookings.filter(b => b.status === 'COMPLETED').length },
              { id: 'CANCELLED', label: t('status_cancelled'), count: pastBookings.filter(b => ['CANCELLED', 'NO_SHOW'].includes(b.status)).length },
            ].map((f) => {
              const isSelected = historyFilterStatus === f.id;
              return (
                <button
                  key={f.id}
                  id={`history-filter-${f.id.toLowerCase()}`}
                  onClick={() => setHistoryFilterStatus(f.id as any)}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {pastBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <History className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {t('no_history_bookings_title')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {t('no_history_bookings_desc')}
              </p>
              <button
                onClick={onExploreBusinesses}
                className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer min-h-[40px]"
              >
                {t('search_button')}
              </button>
            </div>
          ) : filteredPastBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <p className="text-xs font-bold text-slate-700">Ushbu holatda o‘tgan bronlar topilmadi</p>
              <button
                onClick={() => setHistoryFilterStatus('ALL')}
                className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Barchasini ko‘rish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPastBookings.map((b) => (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        #{b.booking_number}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        b.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'CANCELLED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {b.status === 'COMPLETED' ? t('status_completed') : b.status === 'CANCELLED' ? t('status_cancelled') : b.status}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{b.business_name}</h3>
                        <p className="text-xs text-blue-600 font-bold mt-0.5">{b.service_name}</p>
                      </div>

                      {/* Review status */}
                      {b.status === 'COMPLETED' && !b.review_id && (
                        <button
                          onClick={() => setReviewBooking(b)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0 min-h-[30px]"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{t('leave_review')}</span>
                        </button>
                      )}
                      {b.status === 'COMPLETED' && b.review_id && (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{b.review_rating}★</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700">Qabul sanasi: {b.booking_date}, {b.start_time} - {b.end_time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Mutaxassis: <strong className="text-slate-700">{b.staff_name}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{b.business_address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Re-book Action Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black text-slate-900">
                      {Number(b.total_price_uzs).toLocaleString('uz-UZ')} UZS
                    </div>

                    <button
                      id={`rebook-btn-${b.id}`}
                      onClick={() => handleOpenRebook(b)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 min-h-[36px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('rebook')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PROFILIM — Shaxsiy ma’lumotlar va sozlamalar                          */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-2xl">
          {/* User Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                {(currentUser.name || 'M')[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {sanitizeName(currentUser.name)}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {formatRole(currentUser.role, t)}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {formatPhoneNumber(currentUser.phone)}
                  </span>
                </div>
              </div>
            </div>

            {currentUser.email && (
              <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Email</span>
                <p className="text-xs font-semibold text-slate-700 break-all">{currentUser.email}</p>
              </div>
            )}
          </div>

          {/* Profile Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">{t('profile_settings')}</h2>
            <p className="text-xs text-slate-500 mb-5">
              Shaxsiy ma’lumotlaringiz va Telegram eslatma parametrlarini yangilang
            </p>

            {profileSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {actionError && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('full_name')}</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5 focus:outline-blue-600 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('phone_number')}</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+998"
                  className="w-full border border-slate-300 rounded-xl p-2.5 focus:outline-blue-600 text-xs font-medium"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700 uppercase flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#0088cc]" />
                    <span>{t('telegram_bot')}</span>
                  </label>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    profileTelegram ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {profileTelegram ? 'Faol / Ulangan' : 'Ulanmagan'}
                  </span>
                </div>

                {/* 1-Click Bot Connect Banner */}
                <div className="p-3.5 bg-gradient-to-r from-[#2AABEE]/10 to-indigo-50 border border-[#2AABEE]/30 rounded-2xl mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-[#0088cc] fill-[#0088cc]" />
                      <span>Telegram Bot: @Navbat1Uzb_bot</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Bron eslatmalari va jonli navbat xabarlarini bepul qabul qiling
                    </p>
                  </div>
                  <button
                    type="button"
                    id="customer-connect-tg-btn"
                    onClick={async () => {
                      try {
                        const res = await api.generateTelegramLinkToken();
                        if (res.deepLink) {
                          window.location.href = res.deepLink;
                        }
                      } catch (e: any) {
                        setProfileError(e.message || 'Telegram xatosi');
                        setTimeout(() => setProfileError(''), 5000);
                      }
                    }}
                    className="px-4 py-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer min-h-[36px]"
                  >
                    <Send className="w-3.5 h-3.5 fill-white" />
                    <span>Telegram botga ulash</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Telegram Chat ID:
                  </label>
                  <input
                    type="text"
                    value={profileTelegram}
                    onChange={(e) => setProfileTelegram(e.target.value)}
                    placeholder="Chat ID (masalan: 987654321)"
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-xs focus:outline-blue-600"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                  <p className="text-[11px] text-slate-500">
                    Botga <code>/navbat</code> buyrug‘ini yuboring
                  </p>
                  {profileTelegram && (
                    <button
                      type="button"
                      disabled={testingTg}
                      onClick={async () => {
                        setTestingTg(true);
                        try {
                          await api.sendTestTelegram({ chat_id: profileTelegram });
                          setTestTgStatus('Xabar yuborildi!');
                          setTimeout(() => setTestTgStatus(null), 3500);
                        } catch (err: any) {
                          setTestTgStatus('Xatolik: ' + (err.message || 'Yuborilmadi'));
                          setTimeout(() => setTestTgStatus(null), 4000);
                        } finally {
                          setTestingTg(false);
                        }
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline self-start sm:self-auto cursor-pointer"
                    >
                      {testingTg ? 'Yuborilmoqda...' : testTgStatus ? testTgStatus : 'Sinov xabarini tekshirish'}
                    </button>
                  )}
                </div>
              </div>

              {/* 30-Minute Telegram Reminder Toggle */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-slate-800 text-xs">
                        {t('reminder_30m_title')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        reminder30mEnabled ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {reminder30mEnabled ? 'Faol (30 daqiqa oldin)' : 'O‘chirilgan'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-lg">
                      {t('reminder_30m_desc')}
                    </p>
                    {!profileTelegram && (
                      <p className="text-[10px] text-amber-700 font-medium pt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Telegram eslatmalarini qabul qilish uchun hisobingizni yuqoridagi botga ulang.</span>
                      </p>
                    )}
                  </div>

                  {/* Interactive Switch Toggle */}
                  <button
                    type="button"
                    id="toggle-30m-telegram-reminder"
                    role="switch"
                    aria-checked={reminder30mEnabled}
                    disabled={togglingReminder}
                    onClick={handleToggle30mReminder}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 self-start sm:self-center ${
                      reminder30mEnabled ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                    title={reminder30mEnabled ? "Eslatmani o‘chirish" : "Eslatmani yoqish"}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        reminder30mEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer min-h-[40px]"
                >
                  {savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{savingProfile ? t('loading') : t('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Modal Drawer */}
      {notificationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                <h3 className="font-extrabold text-sm">{t('notifications')}</h3>
                {unreadNotifsCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-black">
                    {unreadNotifsCount} ta yangi
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifsCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-semibold text-blue-300 hover:text-white transition cursor-pointer"
                  >
                    {t('mark_all_read')}
                  </button>
                )}
                <button
                  onClick={() => setNotificationsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span>Bildirishnomalar mavjud emas</span>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkNotificationRead(notif.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                      notif.is_read === 0 
                        ? 'bg-blue-50/50 border-blue-200' 
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      notif.is_read === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block">
                        {notif.created_at ? notif.created_at.slice(0, 16) : ''}
                      </span>
                    </div>
                    {notif.is_read === 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">{t('reschedule_booking')}</h3>
            <p className="text-xs text-slate-500 mb-4">{rescheduleBooking.business_name} — {rescheduleBooking.service_name}</p>

            {rescheduleError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <form onSubmit={handleReschedule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('date_and_time')}</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('date_and_time')}</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleBooking(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer min-h-[40px]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer min-h-[40px]"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSuccess={() => {
            setReviewBooking(null);
            loadData();
          }}
        />
      )}

      {/* 1-Click Quick Re-book Modal */}
      {rebookModalOpen && selectedHistoryBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-blue-200" />
                <h3 className="font-extrabold text-base">{t('rebook_modal_title')}</h3>
              </div>
              <button
                onClick={() => setRebookModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {rebookingSuccessData ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-1">{t('rebook_success')}</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Qabulingiz muvaffaqiyatli ro‘yxatga olindi.
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left mb-6 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="text-slate-500">Bron raqami:</span>
                      <strong className="font-mono text-blue-600 font-extrabold text-sm">
                        #{rebookingSuccessData.booking_number}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Muassasa:</span>
                      <strong className="text-slate-800">{selectedHistoryBooking.business_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Xizmat:</span>
                      <strong className="text-slate-800">{selectedHistoryBooking.service_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Sana va vaqt:</span>
                      <strong className="text-slate-800">{rebookingSuccessData.booking_date || rebookDate}, {rebookingSuccessData.start_time || rebookTime}</strong>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setRebookModalOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer min-h-[40px]"
                    >
                      {t('close')}
                    </button>
                    <button
                      onClick={() => {
                        setRebookModalOpen(false);
                        setActiveTab('bookings');
                      }}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer min-h-[40px]"
                    >
                      {t('active_bookings')}ga o‘tish
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmRebook} className="space-y-4">
                  {/* Summary of past appointment */}
                  <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Muassasa:</span>
                      <strong className="text-slate-900 font-bold">{selectedHistoryBooking.business_name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Xizmat:</span>
                      <strong className="text-blue-700 font-bold">{selectedHistoryBooking.service_name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Mutaxassis:</span>
                      <strong className="text-slate-800">{selectedHistoryBooking.staff_name}</strong>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-blue-200/60">
                      <span className="text-slate-600 font-medium">Xizmat narxi:</span>
                      <strong className="text-slate-900 font-extrabold">{Number(selectedHistoryBooking.total_price_uzs).toLocaleString('uz-UZ')} UZS</strong>
                    </div>
                  </div>

                  {rebookingError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{rebookingError}</span>
                    </div>
                  )}

                  {/* Date Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">Qabul sanasini tanlang:</label>
                      <span className="text-[10px] text-slate-400">Yangi sana</span>
                    </div>

                    {/* Quick date presets */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2 text-xs">
                      {[
                        { label: 'Bugun', offset: 0 },
                        { label: 'Ertaga', offset: 1 },
                        { label: 'Indinga', offset: 2 },
                      ].map((item) => {
                        const d = new Date();
                        d.setDate(d.getDate() + item.offset);
                        const isoStr = d.toISOString().slice(0, 10);
                        const isSelected = rebookDate === isoStr;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setRebookDate(isoStr)}
                            className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer min-h-[32px] ${
                              isSelected 
                                ? 'bg-blue-600 text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="date"
                      value={rebookDate}
                      min={todayStr}
                      onChange={(e) => setRebookDate(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-blue-600"
                    />
                  </div>

                  {/* Time Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">Qulay vaqtni tanlang:</label>
                      <span className="text-[10px] text-slate-400">Boshlanish vaqti</span>
                    </div>

                    {/* Quick time slots */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2 text-xs">
                      {['09:00', '11:00', '14:00', '16:00'].map((timeSlot) => {
                        const isSelected = rebookTime === timeSlot;
                        return (
                          <button
                            key={timeSlot}
                            type="button"
                            onClick={() => setRebookTime(timeSlot)}
                            className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer min-h-[32px] ${
                              isSelected 
                                ? 'bg-blue-600 text-white shadow-2xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {timeSlot}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="time"
                      value={rebookTime}
                      onChange={(e) => setRebookTime(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-blue-600"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRebookModalOpen(false)}
                      disabled={rebookingInProgress}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer min-h-[40px]"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={rebookingInProgress || !rebookDate || !rebookTime}
                      className="flex-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
                    >
                      {rebookingInProgress ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Band qilinmoqda...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Qayta bron qilish</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
