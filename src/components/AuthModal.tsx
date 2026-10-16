import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User, Phone, AlertCircle, Send, CheckCircle2, ArrowLeft, ExternalLink, Loader2, Copy, Check, Smartphone } from 'lucide-react';
import { api, setStoredToken } from '../api';
import { User as UserType } from '../types';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { useTranslation } from '../i18n/LanguageContext';
import { NavbatBorLogo } from './NavbatBorLogo';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  botType?: 'customer' | 'business';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onSuccess,
  botType = 'customer',
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [activeBotType, setActiveBotType] = useState<'customer' | 'business'>(botType);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('+998');

  const [loading, setLoading] = useState<boolean>(false);
  const [tgLoading, setTgLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram Quick Login state
  const [showTgView, setShowTgView] = useState<boolean>(false);
  const [tgSession, setTgSession] = useState<{
    sessionId: string;
    code: string;
    botUsername: string;
    botUrl: string;
    deepLink: string;
    tgDirect: string;
  } | null>(null);
  const [tgPhone, setTgPhone] = useState<string>('+998');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<'IDLE' | 'WAITING' | 'CONFIRMED' | 'TIMEOUT'>('IDLE');
  const [countdown, setCountdown] = useState<number>(90);
  const [botOpened, setBotOpened] = useState<boolean>(false);
  const pollTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  const { isTMA, tgUser, initData, hapticFeedback } = useTelegramWebApp();

  // Clean up polling and countdown timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // 1-Click Native Login inside Telegram WebApp
  const handleTelegramMiniAppLogin = async () => {
    if (!tgUser) return;
    setTgLoading(true);
    setError(null);
    hapticFeedback.impact('medium');

    try {
      const res = await api.loginWithTelegramWebApp({
        initData,
        user: tgUser,
      });
      setStoredToken(res.token);
      hapticFeedback.notification('success');
      onSuccess(res.user);
    } catch (err: any) {
      hapticFeedback.notification('error');
      setError(err.message || 'Telegram error');
    } finally {
      setTgLoading(false);
    }
  };

  // Start Telegram Browser Quick Login / Registration session
  const startTelegramBrowserLogin = async (targetBotType?: any) => {
    const selectedBot: 'customer' | 'business' =
      targetBotType === 'business' || targetBotType === 'customer'
        ? targetBotType
        : activeBotType === 'business'
        ? 'business'
        : 'customer';
    setActiveBotType(selectedBot);
    setTgLoading(true);
    setError(null);
    setShowTgView(true);
    setVerificationStatus('WAITING');
    setCountdown(300); // 5 minutes timeout matching backend
    setBotOpened(false);

    try {
      const session = await api.createTelegramAuthSession(selectedBot);
      setTgSession(session);

      if (session.expiresAt) {
        const diffSec = Math.max(10, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
        setCountdown(diffSec);
      }

      // Start countdown
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setVerificationStatus('TIMEOUT');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start server-side polling for verified confirmation
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await api.checkTelegramAuthSession(session.sessionId);
          if (res.status === 'CONFIRMED' && res.token && res.user) {
            clearInterval(pollTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setVerificationStatus('CONFIRMED');
            setStoredToken(res.token);
            hapticFeedback.notification('success');
            // Consume the single-use token on server
            try {
              await api.consumeTelegramAuthSession(session.sessionId);
            } catch (e) {}
            setTimeout(() => {
              onSuccess(res.user);
            }, 600);
          } else if (res.status === 'EXPIRED') {
            clearInterval(pollTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setVerificationStatus('TIMEOUT');
          }
        } catch (e) {
          // ignore transient poll error
        }
      }, 1500);

    } catch (err: any) {
      const errMsg = typeof err?.message === 'string' ? err.message : 'Telegram sessiyasini yaratishda xatolik yuz berdi';
      setError(errMsg);
      setVerificationStatus('TIMEOUT');
    } finally {
      setTgLoading(false);
    }
  };

  // Open real Telegram bot safely across platforms
  const handleOpenTelegramBot = () => {
    if (!tgSession) return;
    setBotOpened(true);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = tgSession.tgDirect;
      setTimeout(() => {
        window.open(tgSession.deepLink, '_blank');
      }, 600);
    } else {
      window.open(tgSession.deepLink, '_blank');
    }
  };

  // Standard Email/Password Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ email, password });
        setStoredToken(res.token);
        onSuccess(res.user);
      } else {
        const res = await api.register({
          email,
          password,
          name,
          phone,
          role: 'CUSTOMER',
        });
        setStoredToken(res.token);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!tgSession?.code) return;
    navigator.clipboard.writeText(tgSession.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar">
        <button
          id="close-auth-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TELEGRAM QUICK LOGIN VIEW */}
        {showTgView ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setShowTgView(false);
                  if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                }}
                className="p-1.5 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Orqaga"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#2AABEE] flex items-center justify-center text-white shadow-xs">
                  <Send className="w-3.5 h-3.5 fill-white -translate-x-0.2" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                  {mode === 'register' ? 'TELEGRAM ORQALI RO‘YXATDAN O‘TISH' : 'TELEGRAM ORQALI KIRISH'}
                </h3>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Telegram Bot Action Card */}
            <div className="bg-gradient-to-br from-sky-50 via-sky-50/70 to-blue-50/60 border border-sky-200 rounded-2xl p-4.5 mb-4 text-center">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-sky-100 flex items-center justify-center mx-auto mb-3 text-[#2AABEE]">
                <Send className="w-7 h-7 fill-[#2AABEE]" />
              </div>

              {/* Bot Mode Selector Toggle */}
              <div className="inline-flex items-center gap-1 p-1 bg-sky-100/70 border border-sky-200/80 rounded-xl mb-3 text-xs">
                <button
                  type="button"
                  onClick={() => startTelegramBrowserLogin('customer')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${activeBotType === 'customer' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  👤 Mijozlar boti
                </button>
                <button
                  type="button"
                  onClick={() => startTelegramBrowserLogin('business')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${activeBotType === 'business' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  🏢 Biznes boti
                </button>
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-1">
                {activeBotType === 'business'
                  ? 'NavbatBor Biznes boti orqali tasdiqlash'
                  : mode === 'register' ? 'Telegram boti orqali ro‘yxatdan o‘ting' : 'Telegram botingiz orqali tasdiqlang'}
              </h4>
              <p className="text-xs text-slate-600 mb-3.5">
                Pastdagi tugmani bosing va <b>@{tgSession?.botUsername || (activeBotType === 'business' ? 'navbatbor_bizness_bot' : 'Navbat1Uzb_bot')}</b> da <b>START</b> tugmasini bosing
              </p>

              {tgSession && (
                <div className="flex flex-col items-center gap-1.5 mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-sky-200 rounded-xl shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Tasdiqlash kodi:</span>
                    <span className="font-mono font-black text-base text-sky-700 tracking-wider">{tgSession.code}</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                      title="Nusxalash"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {tgSession.botUsername && (
                    <span className="text-[11px] text-slate-400">
                      Rasmiy bot: <span className="font-semibold text-sky-700">@{tgSession.botUsername}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Step 1: Open Telegram Bot Primary Button */}
              {tgSession && (
                <div className="flex flex-col gap-2">
                  <a
                    id="tg-open-bot-action-btn"
                    href={tgSession.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBotOpened(true)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] hover:from-[#229ED9] hover:to-[#1a89bf] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Send className="w-4 h-4 fill-white" />
                    <span>Telegram Botni ochish (@{tgSession.botUsername})</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </a>

                  <a
                    href={tgSession.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-medium underline py-1"
                  >
                    Telegram Web yoki brauzerda ochish
                  </a>
                </div>
              )}

              {/* Status State Indicator */}
              <div className="mt-4 pt-3.5 border-t border-sky-100 flex items-center justify-center gap-2">
                {verificationStatus === 'CONFIRMED' ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Tasdiqlandi ✓ Kirilmoqda...</span>
                  </div>
                ) : verificationStatus === 'TIMEOUT' ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Kod muddati tugadi</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startTelegramBrowserLogin(activeBotType)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      🔄 Qayta urinish
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                    <span>Telegram orqali tasdiqlash kutilmoqda... ({countdown}s)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Real Telegram Instructions Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-600 space-y-2 mb-3">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Qanday ishlaydi?
              </div>
              <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <span><b>«Telegram Botni ochish»</b> tugmasini bosing yoki botga kiring: <b>@{tgSession?.botUsername || 'Navbat1Uzb_bot'}</b></span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <span>Bot ochilgach, pastdagi <b>START</b> tugmasini bosing (yoki 6 xonali kodni yuboring).</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <span>Server shaxsingizni tasdiqlaydi va ushbu sahifa darhol avtomatik faollashadi!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowTgView(false);
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1.5 cursor-pointer"
            >
              Email va parol orqali kirishga qaytish
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN / REGISTRATION VIEW */
          <div>
            <div className="text-center mb-5">
              <NavbatBorLogo variant="emblem-card" size="md" className="mx-auto mb-3" />
              <h3 className="text-xl font-black text-slate-900">
                {mode === 'login' ? 'Tizimga kirish' : 'Ro‘yxatdan o‘tish'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'login'
                  ? 'NavbatBor hisobingizga kiring va navbatlaringizni boshqaring'
                  : 'Yangi hisob oching va klinika hamda xizmatlarga oson navbat oling'}
              </p>
            </div>

            {/* PRIMARY CTA: TELEGRAM QUICK LOGIN */}
            <div className="mb-4">
              {isTMA && tgUser ? (
                <button
                  type="button"
                  id="tg-tma-login-btn"
                  onClick={handleTelegramMiniAppLogin}
                  disabled={tgLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] hover:from-[#229ED9] hover:to-[#1a89bf] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md transition active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>
                    {tgLoading
                      ? 'Yuklanmoqda...'
                      : `TELEGRAM ORQALI ${mode === 'register' ? 'RO‘YXATDAN O‘TISH' : 'KIRISH'} (${tgUser.first_name})`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  id="tg-web-login-btn"
                  onClick={() => startTelegramBrowserLogin()}
                  disabled={tgLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] hover:from-[#229ED9] hover:to-[#1a89bf] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>{mode === 'register' ? 'TELEGRAM ORQALI RO‘YXATDAN O‘TISH' : 'TELEGRAM ORQALI TEZKOR KIRISH'}</span>
                </button>
              )}

              <button
                type="button"
                id="google-login-btn"
                onClick={() => {
                  window.location.href = '/api/auth/google/login';
                }}
                className="w-full mt-2.5 py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xs hover:shadow transition active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google orqali kirish</span>
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[11px] text-slate-400 font-medium uppercase">Yoki Email bilan</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">{t('full_name')}</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        id="auth-name-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alisher Zokirov"
                        required
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">{t('phone_number')}</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        id="auth-phone-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('email')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    id="auth-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@mail.uz"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('password')}</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    id="auth-password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="******"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="auth-submit-btn"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-xs mt-4 cursor-pointer disabled:opacity-50"
              >
                {loading ? t('loading') : mode === 'login' ? t('login') : t('register')}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-500">
              {mode === 'login' ? (
                <span>
                  {t('no_account_prompt')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {t('register')}
                  </button>
                </span>
              ) : (
                <span>
                  {t('have_account_prompt')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {t('login')}
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
