import React, { useState, useEffect } from 'react';
import { 
  Tv, X, Plus, Copy, Check, RefreshCw, Trash2, 
  ExternalLink, Sparkles, Shield, Info, QrCode, Sliders,
  Play, Radio, Volume2
} from 'lucide-react';
import { api } from '../api';
import { BusinessScreen, ServiceItem } from '../types';
import { LiveQueueDisplay } from './LiveQueueDisplay';

interface QueueBoardModalProps {
  businessSlug: string;
  businessName?: string;
  onClose: () => void;
}

export const QueueBoardModal: React.FC<QueueBoardModalProps> = ({
  businessSlug,
  businessName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'screens' | 'tv-instructions'>('screens');
  const [screens, setScreens] = useState<BusinessScreen[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeDisplayToken, setActiveDisplayToken] = useState<string | null>(null);

  // New screen form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newScreenName, setNewScreenName] = useState<string>('');
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // QR Code preview modal
  const [qrScreen, setQrScreen] = useState<BusinessScreen | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [screensRes, servicesRes] = await Promise.all([
        api.getBusinessScreens(),
        api.getBusinessServices().catch(() => [])
      ]);
      setScreens(screensRes.screens || []);
      setServices(servicesRes || []);
    } catch (err) {
      console.error('Error loading screens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyLink = (token: string, id: string) => {
    const origin = window.location.origin;
    const fullUrl = `${origin}/#display/${token}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScreenName.trim()) return;
    try {
      setSubmitting(true);
      await api.createBusinessScreen({
        name: newScreenName.trim(),
        room_name: newRoomName.trim(),
        service_ids: newServiceIds
      });
      setNewScreenName('');
      setNewRoomName('');
      setNewServiceIds([]);
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      console.error('Error creating screen:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateToken = async (screenId: string) => {
    if (!confirm('Haqiqatan ham ushbu ekran tokenini yangilamoqchimisiz? Eski havola ulangan televizorlarda ishlamay qoladi.')) {
      return;
    }
    try {
      await api.regenerateScreenToken(screenId);
      await loadData();
    } catch (err) {
      console.error('Error regenerating token:', err);
    }
  };

  const handleDeleteScreen = async (screenId: string) => {
    if (!confirm('Ushbu ekranni o‘chirishni tasdiqlaysizmi?')) return;
    try {
      await api.deleteBusinessScreen(screenId);
      await loadData();
    } catch (err) {
      console.error('Error deleting screen:', err);
    }
  };

  const handleToggleActive = async (screen: BusinessScreen) => {
    try {
      await api.updateBusinessScreen(screen.id, {
        is_active: !screen.is_active
      });
      await loadData();
    } catch (err) {
      console.error('Error updating screen:', err);
    }
  };

  // If viewing TV in direct full mode
  if (activeDisplayToken) {
    return (
      <LiveQueueDisplay
        token={activeDisplayToken}
        onClose={() => setActiveDisplayToken(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-md">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Live Queue Display (TV Tablo)</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Smart TV 16:9
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Klinika, salon va markazlardagi Smart TV va Android TV Box ekranlarida jonli navbatni ko‘rsatish
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <button
            onClick={() => setActiveTab('screens')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'screens'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Ekranlar Boshqaruvi ({screens.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tv-instructions')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tv-instructions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Televizorga Ulash Qo‘llanmasi</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'screens' ? (
            <div className="space-y-6">
              
              {/* Top Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Faol Televizor Ekranlari</h3>
                  <p className="text-xs text-slate-500">
                    Bitta biznesda bir nechta televizor o‘rnatilgan bo‘lsa, har bir xona yoki qavat uchun alohida ekran qo‘shishingiz mumkin.
                  </p>
                </div>
                {!showAddForm && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Yangi Ekran Qo‘shish</span>
                  </button>
                )}
              </div>

              {/* Add New Screen Form */}
              {showAddForm && (
                <form 
                  onSubmit={handleCreateScreen}
                  className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Yangi Televizor Ekrani Parametrlari</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                    >
                      Bekor qilish
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ekran Nomi *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Masalan: 1-qavat Katta Zali"
                        value={newScreenName}
                        onChange={(e) => setNewScreenName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Xona / Operator Nomi (Ovozli e’lon uchun)
                      </label>
                      <input
                        type="text"
                        placeholder="Masalan: 104-xona yoki 1-operator"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Service Filtering */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ushbu ekranda qaysi xizmatlar navbati ko‘rinsin? (Bo‘sh qolsa — barcha xizmatlar)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {services.map((srv) => {
                        const isSelected = newServiceIds.includes(srv.id);
                        return (
                          <button
                            type="button"
                            key={srv.id}
                            onClick={() => {
                              if (isSelected) {
                                setNewServiceIds(newServiceIds.filter(id => id !== srv.id));
                              } else {
                                setNewServiceIds([...newServiceIds, srv.id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {srv.name}
                          </button>
                        );
                      })}
                      {services.length === 0 && (
                        <span className="text-xs text-slate-400">Xizmatlar ro‘yxati mavjud emas (barchasi ko‘rsatiladi)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !newScreenName.trim()}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition shadow-sm"
                    >
                      {submitting ? 'Yaratilmoqda...' : 'Ekranni Yaratish'}
                    </button>
                  </div>
                </form>
              )}

              {/* Screens Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {screens.map((screen) => {
                  const origin = window.location.origin;
                  const displayUrl = `${origin}/#display/${screen.display_token}`;

                  return (
                    <div
                      key={screen.id}
                      className="bg-white border-2 border-slate-200 hover:border-indigo-400 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all space-y-4"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-slate-900">{screen.name}</h4>
                            <button
                              onClick={() => handleToggleActive(screen)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase cursor-pointer transition ${
                                screen.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {screen.is_active ? 'Faol' : 'O‘chirilgan'}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Xona / Operator: <strong className="text-slate-800">{screen.room_name || 'Standart'}</strong>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Xizmatlar: {screen.service_ids && screen.service_ids.length > 0 ? `${screen.service_ids.length} ta xizmat ajratilgan` : 'Barcha xizmatlar'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setQrScreen(screen)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="TV QR kodini ko‘rish"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteScreen(screen.id)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Ekranni o‘chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Token & Security Bar */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 text-slate-600 font-semibold">
                            <Shield className="w-3.5 h-3.5 text-emerald-600" />
                            Xavfsiz Ekran Tokeni
                          </span>
                          <button
                            onClick={() => handleRegenerateToken(screen.id)}
                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                            title="Tokenni yangilash eski havolani bekor qiladi"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Yangilash</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={displayUrl}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-600 select-all outline-none"
                          />
                          <button
                            onClick={() => handleCopyLink(screen.display_token, screen.id)}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === screen.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === screen.id ? 'Nusxalandi' : 'Nusxa'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setActiveDisplayToken(screen.display_token)}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 active:scale-95 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Bu Ekranni Ochish (TV Rejimi)</span>
                        </button>
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                          title="Yangi oynada ochish"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {screens.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-400">
                  <Tv className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-600">Hali birorta ekran qo‘shilmagan</p>
                  <p className="text-xs text-slate-400 mt-1">«Yangi Ekran Qo‘shish» tugmasi orqali Smart TV uchun ekran yarating.</p>
                </div>
              )}
            </div>
          ) : (
            /* TV Setup Instructions Tab */
            <div className="space-y-6 text-slate-700 text-xs leading-relaxed max-w-2xl mx-auto py-2">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-blue-900 text-sm">Oddiy va Qulay Ulash</h4>
                  <p className="text-blue-800 text-xs mt-1">
                    NavbatBor Smart TV moduli maxsus ilova o‘rnatishni talab qilmaydi. Televizoringizdagi standart brauzer orqali bir marta havolani ochish kifoya.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>1️⃣ Smart TV (Samsung, LG, Sony, Artel)</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 mt-2 text-slate-600">
                    <li>Televizor pultidagi <strong>Home / Menu</strong> tugmasini bosing va <strong>Internet (Brauzer)</strong> ilovasini oching.</li>
                    <li>Ekran havolasini manzil qatoriga kiriting (yoki telefoningizdan QR kodni skanerlab havolani oling).</li>
                    <li>Sahifa ochilgach, to‘liq ekran qilish uchun pultdan <strong>Fullscreen (⛶)</strong> tugmasini bosing.</li>
                    <li>Brauzer xatcho‘plariga (Bookmarks) saqlab qo‘ysangiz, keyingi safar avtomatik ochiladi.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>2️⃣ Android TV Box / Xiaomi Mi Box / HDMI Kompyuter</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 mt-2 text-slate-600">
                    <li>Google Chrome yoki TV Bro brauzerini oching.</li>
                    <li>Ekran havolasini kiriting.</li>
                    <li>Klaviatura yoki pultdan <strong>F11</strong> bosib to‘liq ekran qiling.</li>
                    <li>Ekranda ovozli chaqiruvni faollashtirish uchun bir marta pultdagi <strong>OK</strong> tugmasini bosing.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>3️⃣ Xavfsizlik & Cheklovlar</span>
                  </h4>
                  <p className="mt-1 text-slate-600">
                    Ekran tokeni faqat ommaviy navbat ma’lumotlarini (chipta raqami, xona nomi, xizmat turi) ko‘rsatadi. Televizor orqali biznes kabinetiga kirish yoki mijozlarning shaxsiy ma’lumotlarini ko‘rish mutlaqo mumkin emas.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            Real-time Server-Sent Events (SSE) Sinxronizatsiyasi
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Yopish
          </button>
        </div>

      </div>

      {/* QR Code Modal for Smart TV Browser */}
      {qrScreen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setQrScreen(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">{qrScreen.name}</h3>
            <p className="text-xs text-slate-500">
              Smart TV kamerasi yoki telefoningiz orqali skanerlang va televizor brauzeriga uzating.
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}/#display/${qrScreen.display_token}`
                )}`}
                alt="Display QR Code"
                className="w-48 h-48 rounded-xl shadow-inner bg-white p-2"
              />
            </div>

            <button
              onClick={() => setQrScreen(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold transition"
            >
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
