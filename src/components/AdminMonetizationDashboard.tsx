import React, { useState, useEffect } from 'react';
import {
  CreditCard, TrendingUp, DollarSign, AlertTriangle, CheckCircle2, XCircle,
  Clock, ShieldAlert, Sparkles, Plus, Edit2, ToggleLeft, ToggleRight,
  Layers, Package, RefreshCw, Send, Trash2, Calendar, FileText, Check,
  Info, ArrowUpRight, ArrowDownRight, Eye, Smartphone, Printer, MessageSquare, BarChart3
} from 'lucide-react';
import { api } from '../api';
import { 
  SubscriptionPlan, SuperAdminMonetizationStats, MonetizationExpenseItem, 
  ExtraServiceItem, ExtraServiceOrderItem 
} from '../types';
import { EXPENSE_CATEGORIES, formatUzs } from '../monetizationConfig';

interface AdminMonetizationDashboardProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang?: 'uz' | 'ru' | 'en';
}

export const AdminMonetizationDashboard: React.FC<AdminMonetizationDashboardProps> = ({
  onShowToast,
  lang = 'uz'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'plans' | 'expenses' | 'extra_services' | 'subscriptions'>('overview');
  const [stats, setStats] = useState<SuperAdminMonetizationStats | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [expenses, setExpenses] = useState<MonetizationExpenseItem[]>([]);
  const [extraServices, setExtraServices] = useState<ExtraServiceItem[]>([]);
  const [extraOrders, setExtraOrders] = useState<ExtraServiceOrderItem[]>([]);
  const [subscriptionsData, setSubscriptionsData] = useState<{ subscriptions: any[]; pendingTransactions: any[]; transactions: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    code: '',
    price_uzs: 99000,
    max_staff: 3,
    max_monthly_bookings: 300,
    features_list: '',
  });

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'SERVER_HOSTING',
    title: '',
    amount_uzs: 100000,
    expense_date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [showExtendModal, setShowExtendModal] = useState<string | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);

  // Load all monetization data
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, plansRes, expensesRes, servicesRes, ordersRes, subsRes] = await Promise.all([
        api.getAdminMonetizationStats().catch(() => null),
        api.getAdminPlans().catch(() => []),
        api.getAdminMonetizationExpenses().catch(() => []),
        api.getAdminExtraServices().catch(() => []),
        api.getAdminExtraServiceOrders().catch(() => []),
        api.getAdminSubscriptions().catch(() => null)
      ]);

      setStats(statsRes);
      setPlans(plansRes || []);
      setExpenses(expensesRes || []);
      setExtraServices(servicesRes || []);
      setExtraOrders(ordersRes || []);
      setSubscriptionsData(subsRes);
    } catch (err: any) {
      onShowToast(err.message || 'Ma’lumotlarni yuklashda xatolik yuz berdi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save-plan');
    try {
      const featuresArray = planForm.features_list
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean);

      if (editingPlan) {
        await api.updateAdminPlan(editingPlan.id, {
          name: planForm.name,
          price_uzs: Number(planForm.price_uzs),
          max_staff: Number(planForm.max_staff),
          max_monthly_bookings: Number(planForm.max_monthly_bookings),
          features_list: featuresArray
        });
        onShowToast('Tarif muvaffaqiyatli yangilandi!', 'success');
      } else {
        await api.createAdminPlan({
          name: planForm.name,
          code: planForm.code,
          price_uzs: Number(planForm.price_uzs),
          max_staff: Number(planForm.max_staff),
          max_monthly_bookings: Number(planForm.max_monthly_bookings),
          features_list: featuresArray
        });
        onShowToast('Yangi tarif yaratildi!', 'success');
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Tarifni saqlashda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Plan Status
  const handleTogglePlan = async (id: string, action: 'activate' | 'deactivate' | 'open_sales' | 'close_sales') => {
    setActionLoading(`plan-${id}-${action}`);
    try {
      await api.toggleAdminPlanStatus(id, action);
      onShowToast('Tarif holati muvaffaqiyatli o‘zgartirildi', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Holatni o‘zgartirishda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save-expense');
    try {
      await api.addAdminMonetizationExpense({
        category: expenseForm.category,
        title: expenseForm.title,
        amount_uzs: Number(expenseForm.amount_uzs),
        expense_date: expenseForm.expense_date,
        notes: expenseForm.notes
      });
      onShowToast('Xarajat muvaffaqiyatli qayd etildi!', 'success');
      setShowExpenseModal(false);
      setExpenseForm({
        category: 'SERVER_HOSTING',
        title: '',
        amount_uzs: 100000,
        expense_date: new Date().toISOString().slice(0, 10),
        notes: ''
      });
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Xarajatni saqlashda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Ushbu xarajat yozuvini o‘chirmoqchimisiz?')) return;
    setActionLoading(`del-exp-${id}`);
    try {
      await api.deleteAdminMonetizationExpense(id);
      onShowToast('Xarajat o‘chirildi', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'O‘chirishda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Update Extra Service Order Status
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    setActionLoading(`order-${orderId}`);
    try {
      await api.updateAdminExtraServiceOrderStatus(orderId, status);
      onShowToast('Buyurtma holati yangilandi', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Holatni yangilashda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Trigger manual Telegram queue & alert check
  const handleTriggerAlertCheck = async () => {
    setActionLoading('check-alerts');
    try {
      const res = await api.triggerSubscriptionAlertCheck();
      onShowToast(res.message || 'Obunalar tekshirildi va xabarnomalar navbati yangilandi', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Tekshirishda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Confirm manual payment
  const handleConfirmPayment = async (txId: string) => {
    setActionLoading(`tx-conf-${txId}`);
    try {
      await api.confirmAdminPayment(txId);
      onShowToast('To‘lov tasdiqlandi va tarif +30 kunga faollashtirildi!', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Tasdiqlashda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel payment
  const handleCancelPayment = async (txId: string) => {
    if (!confirm('Ushbu to‘lov so‘rovini bekor qilmoqchimisiz?')) return;
    setActionLoading(`tx-cancel-${txId}`);
    try {
      await api.cancelAdminPayment(txId);
      onShowToast('To‘lov so‘rovi bekor qilindi', 'info');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Bekor qilishda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Manual extend subscription
  const handleExtendBiz = async (bizId: string) => {
    setActionLoading(`biz-ext-${bizId}`);
    try {
      await api.extendAdminSubscription(bizId, { months: extendMonths });
      onShowToast(`Obuna ${extendMonths} oyga (+${extendMonths * 30} kun) muvaffaqiyatli uzaytirildi!`, 'success');
      setShowExtendModal(null);
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Uzaytirishda xatolik', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & QUICK ACTIONS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">SUPER_ADMIN Moduli</span>
              <h2 className="text-xl sm:text-2xl font-black">Monetizatsiya va Moliyaviy Boshqaruv</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Tariflar, 14 kunlik sinov va faol obunalar, Click & Payme to‘lovlari, real xarajatlar va haqiqiy sof foyda hisobi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerAlertCheck}
            disabled={actionLoading === 'check-alerts'}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Send className={`w-3.5 h-3.5 ${actionLoading === 'check-alerts' ? 'animate-spin' : ''}`} />
            <span>{actionLoading === 'check-alerts' ? 'Yuborilmoqda...' : 'Telegram Alertlarni Ishga Tushirish'}</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: '📊 Moliyaviy Ko‘rsatkichlar & Sof Foyda' },
          { id: 'plans', label: `💎 Tariflar Rejasi (${plans.length})` },
          { id: 'expenses', label: `📉 Real Xarajatlar Jurnali (${expenses.length})` },
          { id: 'extra_services', label: `⚡️ Qo‘shimcha Xizmatlar (${extraServices.length})` },
          { id: 'subscriptions', label: `🏢 Obunalar & Tranzaksiyalar (${subscriptionsData?.subscriptions?.length || 0})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 1. FINANCIAL OVERVIEW & REAL NET PROFIT TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Main Profit Engine Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami Tushum (Gross Revenue)</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {formatUzs(stats.totalGrossRevenue)}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                <span>Obunalar: <strong>{formatUzs(stats.confirmedPaymentsSum)}</strong></span>
                <span>Reklama: <strong>{formatUzs(stats.adRevenueTotal)}</strong></span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Jami Real Xarajatlar</span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                {formatUzs(stats.totalExpensesSum + stats.partnerCommissionsSum)}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                <span>Infratuzilma: <strong>{formatUzs(stats.totalExpensesSum)}</strong></span>
                <span>Hamkorlar (30%): <strong>{formatUzs(stats.partnerCommissionsSum)}</strong></span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">HAQIQIY SOF FOYDA (NET PROFIT)</span>
                <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full">
                  {stats.profitMarginPercent}% Rentabellik
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1">
                {formatUzs(stats.realNetProfit)}
              </div>
              <p className="text-[11px] text-emerald-100 mt-3 pt-3 border-t border-white/20">
                Jami tushumdan server, SMS, to‘lov tizimi va hamkor komissiyalari chegirilgan holda hisoblangan.
              </p>
            </div>
          </div>

          {/* Subscriptions Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Faol Obunalar</span>
              <div className="text-xl font-black text-emerald-600 mt-0.5">{stats.activeSubscriptionsCount} ta</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">14 Kunlik Sinov</span>
              <div className="text-xl font-black text-indigo-600 mt-0.5">{stats.trialBusinessesCount} ta</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tugayotgan (≤3 kun)</span>
              <div className="text-xl font-black text-amber-500 mt-0.5">{stats.expiringSubscriptionsCount} ta</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Muddati O‘tgan</span>
              <div className="text-xl font-black text-rose-600 mt-0.5">{stats.expiredSubscriptionsCount} ta</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tasdiqlangan To‘lov</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{stats.confirmedPaymentsCount} ta</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Muvaffaqiyatsiz</span>
              <div className="text-xl font-black text-rose-500 mt-0.5">{stats.failedPaymentsCount} ta</div>
            </div>
          </div>

          {/* Plan Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">
              Tariflar Bo‘yicha Daromad va Mijozlar Taqsimoti
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Tarif</th>
                    <th className="py-2.5 px-4">Oylik Narx</th>
                    <th className="py-2.5 px-4">Faol Bizneslar</th>
                    <th className="py-2.5 px-4">Jami Yig‘ilgan Tushum</th>
                    <th className="py-2.5 px-4 text-right">Ulashuv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.planBreakdown.map(p => (
                    <tr key={p.code} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-indigo-700">{p.name} ({p.code})</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{formatUzs(p.price_uzs)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{p.active_count} ta biznes</td>
                      <td className="py-3 px-4 font-black text-slate-900">{formatUzs(p.revenue)}</td>
                      <td className="py-3 px-4 text-right text-slate-500 font-bold">
                        {stats.totalGrossRevenue > 0 ? ((p.revenue / stats.totalGrossRevenue) * 100).toFixed(1) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PLANS MANAGEMENT TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Platforma Tarif Rejalari Konfiguratsiyasi</h3>
              <p className="text-xs text-slate-500">START (99k), BUSINESS (199k), PRO (349k), PREMIUM (599k) va maxsus tariflar</p>
            </div>
            <button
              onClick={() => {
                setEditingPlan(null);
                setPlanForm({
                  name: '',
                  code: '',
                  price_uzs: 99000,
                  max_staff: 3,
                  max_monthly_bookings: 300,
                  features_list: 'Onlayn bron qilish\nJonli navbat\nTelegram xabarnomalar'
                });
                setShowPlanModal(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi Tarif Yaratish</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(p => {
              const features = JSON.parse(p.features_json || '[]');
              const limits = p.limits_json ? JSON.parse(p.limits_json) : null;
              const isAvailable = p.is_available_for_purchase !== 0;
              const isActive = p.is_active !== 0;

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition shadow-xs ${
                    !isActive ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-black uppercase">
                        {p.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isActive ? 'Faol' : 'Nofaol'}
                        </span>
                        {!isAvailable && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                            Sotuv yopiq
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xl font-black text-slate-900">{p.name}</div>
                    <div className="text-2xl font-black text-indigo-600 my-1">
                      {formatUzs(p.price_uzs)} <span className="text-xs font-normal text-slate-500">/oy</span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 my-3 py-3 border-y border-slate-100">
                      <div>👥 Xodimlar: <strong>{p.max_staff >= 999 ? 'Cheksiz' : `${p.max_staff} tagacha`}</strong></div>
                      <div>📅 Oylik bronlar: <strong>{p.max_monthly_bookings >= 99999 ? 'Cheksiz' : p.max_monthly_bookings}</strong></div>
                      {limits && (
                        <>
                          <div>📺 Smart TV ekranlar: <strong>{limits.max_tv_screens || 0} ta</strong></div>
                          <div>💬 Oylik SMS: <strong>{limits.sms_package_monthly || 0} ta</strong></div>
                        </>
                      )}
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-500">
                      {features.slice(0, 4).map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setEditingPlan(p);
                          setPlanForm({
                            name: p.name,
                            code: p.code,
                            price_uzs: p.price_uzs,
                            max_staff: p.max_staff,
                            max_monthly_bookings: p.max_monthly_bookings,
                            features_list: features.join('\n')
                          });
                          setShowPlanModal(true);
                        }}
                        className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Tahrirlash</span>
                      </button>

                      <button
                        onClick={() => handleTogglePlan(p.id, isActive ? 'deactivate' : 'activate')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          isActive ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <span>{isActive ? 'O‘chirish' : 'Faollashtirish'}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleTogglePlan(p.id, isAvailable ? 'close_sales' : 'open_sales')}
                      className="w-full py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      {isAvailable ? '🔒 Yangi sotuvlar uchun yopish' : '🔓 Sotuvni ochish'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. REAL EXPENSES & NET PROFIT MANAGER TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Real Operatsion Xarajatlar Jurnali</h3>
              <p className="text-xs text-slate-500">
                Sof foydani hisoblash uchun faqat haqiqiy xarajatlar kiritiladi (Server, SMS Gateway, Telegram, Ofis va b.)
              </p>
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Xarajat Kiritish</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Sana</th>
                  <th className="py-2.5 px-4">Kategoriya</th>
                  <th className="py-2.5 px-4">Nomi / Maqsadi</th>
                  <th className="py-2.5 px-4">Izoh</th>
                  <th className="py-2.5 px-4">Summa</th>
                  <th className="py-2.5 px-4 text-right">O‘chirish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Hali xarajatlar kiritilmagan.
                    </td>
                  </tr>
                ) : (
                  expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-500">{exp.expense_date}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                          {EXPENSE_CATEGORIES[exp.category]?.label || exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{exp.title}</td>
                      <td className="py-3 px-4 text-slate-500">{exp.notes || '—'}</td>
                      <td className="py-3 px-4 font-black text-rose-600">{formatUzs(exp.amount_uzs)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          disabled={actionLoading === `del-exp-${exp.id}`}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. EXTRA SERVICES TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'extra_services' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Qo‘shimcha Xizmatlar Moduli</h3>
              <p className="text-xs text-slate-500">Dastlabki sozlash, SMS paketlar, kengaytirilgan statistika va printer sozlash</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {extraServices.map(svc => (
              <div key={svc.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-black uppercase">
                      {svc.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      svc.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {svc.is_active ? 'Faol' : 'Nofaol'}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900">{svc.name}</h4>
                  <div className="text-xl font-black text-emerald-600 my-1">
                    {formatUzs(svc.price_uzs)} <span className="text-xs font-normal text-slate-500">/ {svc.unit}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{svc.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">Kod: {svc.code}</span>
                  <button
                    onClick={async () => {
                      const newPrice = prompt(`${svc.name} yangi narxi (so‘m):`, String(svc.price_uzs));
                      if (newPrice && !isNaN(Number(newPrice))) {
                        await api.updateAdminExtraService(svc.id, { price_uzs: Number(newPrice) });
                        onShowToast('Narx yangilandi', 'success');
                        await loadData();
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Narxni o‘zgartirish
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Orders from businesses */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mt-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">
              Bizneslar Tomonidan Berilgan Qo‘shimcha Xizmat Buyurtmalari
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Sana</th>
                    <th className="py-2.5 px-4">Biznes & Egasi</th>
                    <th className="py-2.5 px-4">Buyurtma Xizmati</th>
                    <th className="py-2.5 px-4">Summa</th>
                    <th className="py-2.5 px-4">To‘lov Usuli</th>
                    <th className="py-2.5 px-4">Holat</th>
                    <th className="py-2.5 px-4 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extraOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        Hozircha buyurtmalar yo‘q.
                      </td>
                    </tr>
                  ) : (
                    extraOrders.map(ord => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-slate-500">{ord.created_at?.slice(0, 16)}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{ord.business_name}</div>
                          <div className="text-[11px] text-slate-500">{ord.owner_name} ({ord.owner_phone})</div>
                        </td>
                        <td className="py-3 px-4 font-black text-indigo-700">{ord.service_name}</td>
                        <td className="py-3 px-4 font-bold text-emerald-700">{formatUzs(ord.amount_uzs)}</td>
                        <td className="py-3 px-4 uppercase text-slate-600 font-bold">{ord.payment_method}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            ord.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                            ord.status === 'CONFIRMED' ? 'bg-indigo-100 text-indigo-800' :
                            ord.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {ord.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'CONFIRMED')}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Tasdiqlash
                            </button>
                          )}
                          {ord.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Yetkazildi
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. SUBSCRIPTIONS & TRANSACTIONS TAB */}
      {/* ======================================================== */}
      {activeSubTab === 'subscriptions' && subscriptionsData && (
        <div className="space-y-6">
          {/* Pending Payments Section */}
          {((subscriptionsData.pendingTransactions?.length || 0) > 0) && (
            <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-amber-700" />
                <h4 className="text-sm font-black text-amber-900 uppercase">
                  Tasdiqlash Kutilayotgan To‘lov So‘rovlari ({subscriptionsData.pendingTransactions.length} ta)
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/60 text-amber-900 font-bold uppercase border-b border-amber-200">
                    <tr>
                      <th className="py-2.5 px-4">Sana</th>
                      <th className="py-2.5 px-4">Biznes</th>
                      <th className="py-2.5 px-4">Tarif</th>
                      <th className="py-2.5 px-4">Summa</th>
                      <th className="py-2.5 px-4">Usul</th>
                      <th className="py-2.5 px-4 text-right">Tasdiqlash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {subscriptionsData.pendingTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-amber-100/40">
                        <td className="py-3 px-4 font-mono text-slate-600">{tx.created_at?.slice(0, 16)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{tx.business_name}</td>
                        <td className="py-3 px-4 font-black text-indigo-700">{tx.plan_code}</td>
                        <td className="py-3 px-4 font-black text-emerald-800">{formatUzs(tx.amount_uzs)}</td>
                        <td className="py-3 px-4 uppercase text-slate-700 font-bold">{tx.payment_method}</td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleConfirmPayment(tx.id)}
                            disabled={actionLoading === `tx-conf-${tx.id}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            ✅ Tasdiqlash (+30 kun)
                          </button>
                          <button
                            onClick={() => handleCancelPayment(tx.id)}
                            disabled={actionLoading === `tx-cancel-${tx.id}`}
                            className="px-2.5 py-1.5 bg-rose-100 text-rose-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                          >
                            Bekor qilish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Subscriptions List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">
              Barcha Biznes Obunalarining Haqiqiy Holati
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Biznes Nomi</th>
                    <th className="py-2.5 px-4">Egasi & Telefon</th>
                    <th className="py-2.5 px-4">Tarif</th>
                    <th className="py-2.5 px-4">Holat</th>
                    <th className="py-2.5 px-4">Tugash Sanasi</th>
                    <th className="py-2.5 px-4">Qolgan Vaqt</th>
                    <th className="py-2.5 px-4 text-right">Uzaytirish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptionsData.subscriptions.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{s.owner_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{s.phone || s.owner_phone}</div>
                      </td>
                      <td className="py-3 px-4 font-black text-indigo-700">{s.subscription_plan_code || 'PRO'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          s.subscription_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                          s.subscription_status === 'TRIAL' ? 'bg-indigo-100 text-indigo-800' :
                          s.subscription_status === 'PAST_DUE' ? 'bg-amber-100 text-amber-800' :
                          s.subscription_status === 'EXPIRED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {s.subscription_status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {s.subscription_expires_at ? s.subscription_expires_at.slice(0, 10) : 'Cheksiz'}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={s.days_left <= 0 ? 'text-rose-600' : s.days_left <= 3 ? 'text-amber-600' : 'text-emerald-600'}>
                          {s.days_left <= 0 ? 'Muddati tugagan' : `${s.days_left} kun`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setShowExtendModal(s.id);
                            setExtendMonths(1);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                        >
                          Uzaytirish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-4">
              {editingPlan ? 'Tarifni Tahrirlash' : 'Yangi Tarif Rejasi Yaratish'}
            </h3>
            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tarif Nomi</label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                    placeholder="Masalan: START"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Kodi (UNIQUE)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlan}
                    value={planForm.code}
                    onChange={e => setPlanForm({ ...planForm, code: e.target.value })}
                    className="w-full text-xs font-mono uppercase border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600 disabled:bg-slate-100"
                    placeholder="START"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Oylik Narx (UZS)</label>
                  <input
                    type="number"
                    required
                    value={planForm.price_uzs}
                    onChange={e => setPlanForm({ ...planForm, price_uzs: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Maks. Xodim</label>
                  <input
                    type="number"
                    required
                    value={planForm.max_staff}
                    onChange={e => setPlanForm({ ...planForm, max_staff: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Oylik Bronlar</label>
                  <input
                    type="number"
                    required
                    value={planForm.max_monthly_bookings}
                    onChange={e => setPlanForm({ ...planForm, max_monthly_bookings: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Imkoniyatlar ro‘yxati (Har bir satrda bittadan)
                </label>
                <textarea
                  rows={4}
                  value={planForm.features_list}
                  onChange={e => setPlanForm({ ...planForm, features_list: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl p-3 focus:outline-indigo-600 font-mono"
                  placeholder="3 tagacha xodim&#10;Oyiga 300 ta bron&#10;Telegram bot eslatmalari"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save-plan'}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {actionLoading === 'save-plan' ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-4">Haqiqiy Operatsion Xarajat Qayd Etish</h3>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Kategoriya</label>
                <select
                  value={expenseForm.category}
                  onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600 bg-white"
                >
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Xarajat Nomi / Maqsadi</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="Masalan: Hetzner Cloud oylik to‘lov"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Summa (UZS)</label>
                  <input
                    type="number"
                    required
                    value={expenseForm.amount_uzs}
                    onChange={e => setExpenseForm({ ...expenseForm, amount_uzs: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600 font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Sana</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.expense_date}
                    onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Izoh (ixtiyoriy)</label>
                <input
                  type="text"
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Chek raqami yoki qo‘shimcha ma’lumot"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save-expense'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {actionLoading === 'save-expense' ? 'Saqlanmoqda...' : 'Xarajatni Kiritish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXTEND BIZ MODAL */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 mb-3">Biznes Obunasini Uzaytirish</h3>
            <p className="text-xs text-slate-500 mb-4">
              Administrator huquqi bilan tanlangan biznes obunasini uzaytirish (+30 kun har bir oy uchun).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Davr</label>
                <select
                  value={extendMonths}
                  onChange={e => setExtendMonths(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 bg-white"
                >
                  <option value={1}>1 Oy (+30 kun)</option>
                  <option value={3}>3 Oy (+90 kun)</option>
                  <option value={6}>6 Oy (+180 kun)</option>
                  <option value={12}>1 Yil (+365 kun)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  onClick={() => setShowExtendModal(null)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => handleExtendBiz(showExtendModal)}
                  disabled={actionLoading === `biz-ext-${showExtendModal}`}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {actionLoading === `biz-ext-${showExtendModal}` ? 'Saqlanmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
