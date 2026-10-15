import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Tv, Volume2, VolumeX, Maximize2, Minimize2, 
  Wifi, WifiOff, Clock, Building2, AlertCircle, ArrowLeft,
  Sparkles, BellRing, Users
} from 'lucide-react';
import { api } from '../api';
import { LiveDisplayData, DisplayQueueItem } from '../types';

interface LiveQueueDisplayProps {
  token: string;
  onClose?: () => void;
}

export const LiveQueueDisplay: React.FC<LiveQueueDisplayProps> = ({ token, onClose }) => {
  const [data, setData] = useState<LiveDisplayData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [lastAnnouncedId, setLastAnnouncedId] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<any>(null);
  const lastAnnouncedTicketRef = useRef<string | null>(null);

  // 1. Digital Clock (Tashkent/Uzbekistan time)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('uz-UZ', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Web Audio API Chime Synthesizer
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pleasant airport/hospital chime chords (D5 -> A5)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.22); // E5

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.4);
      osc2.stop(now + 1.4);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  }, []);

  // 3. Uzbek Voice Speech Announcement
  const speakUzbekAnnouncement = useCallback((ticketNumber: string, roomOrStaff: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      // Clean ticket number for natural reading (e.g., A-15 -> A 15)
      const spokenTicket = ticketNumber.replace('-', ' ');
      const roomText = roomOrStaff ? `${roomOrStaff}ga` : 'qabulxona zaliga';
      const speechText = `Navbat raqami ${spokenTicket}. ${roomText} marhamat.`;

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 0.92; // Clear, calm pace for TV speakers
      utterance.pitch = 1.05;

      // Search for Uzbek or natural speech voice
      const voices = window.speechSynthesis.getVoices();
      const uzVoice = voices.find(v => v.lang.startsWith('uz') || v.lang.includes('UZ'));
      if (uzVoice) {
        utterance.voice = uzVoice;
      } else {
        // Fallback to clear neutral voice
        const fallbackVoice = voices.find(v => v.lang.startsWith('tr') || v.lang.startsWith('ru') || v.default);
        if (fallbackVoice) utterance.voice = fallbackVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis warning:', err);
    }
  }, []);

  // 4. Trigger Ticket Calling Alert (Visual Flash + Audio + Voice)
  const triggerCallAlert = useCallback((item: DisplayQueueItem) => {
    if (!item) return;

    // Visual Flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 3500);

    // Audio & Voice
    if (soundEnabled && audioUnlocked) {
      playChime();
      setTimeout(() => {
        const roomName = item.room_name || item.staff_name || '1-xona';
        speakUzbekAnnouncement(item.queue_number, roomName);
      }, 700);
    }
  }, [soundEnabled, audioUnlocked, playChime, speakUzbekAnnouncement]);

  // Unlock Audio on First User/Remote Click (Bypasses Smart TV autoplay policy)
  const unlockAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx && !audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setAudioUnlocked(true);
      playChime();
    } catch (e) {
      setAudioUnlocked(true);
    }
  };

  // 5. Fetch Snapshot from REST API
  const fetchDisplaySnapshot = useCallback(async () => {
    try {
      const res = await api.getDisplayData(token);
      setData(res);
      setIsConnected(true);
      setError(null);

      // Check if newly called ticket arrived
      if (res.currentCalled && res.currentCalled.length > 0) {
        const topTicket = res.currentCalled[0];
        if (topTicket.id !== lastAnnouncedTicketRef.current) {
          lastAnnouncedTicketRef.current = topTicket.id;
          setLastAnnouncedId(topTicket.id);
          triggerCallAlert(topTicket);
        }
      }
    } catch (err: any) {
      console.error('Display snapshot error:', err);
      setIsConnected(false);
      if (err?.code === 'INVALID_TOKEN' || err?.message?.includes('404')) {
        setError('Ushbu ekran havolasi topilmadi yoki token bekor qilingan. Iltimos, biznes kabinetidan yangi token oling.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, triggerCallAlert]);

  // 6. Connect Real-Time SSE Stream with Auto-Reconnect
  useEffect(() => {
    fetchDisplaySnapshot();

    const connectSSE = () => {
      if (sseRef.current) {
        sseRef.current.close();
      }

      const streamUrl = `/api/display/stream/${token}`;
      const es = new EventSource(streamUrl);
      sseRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'CONNECTED' && payload.data) {
            setData(payload.data);
            setIsConnected(true);
          } else {
            // Queue state update broadcasted
            fetchDisplaySnapshot();
          }
        } catch (e) {
          // Keep-alive or raw string
          fetchDisplaySnapshot();
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        // Exponential backoff reconnect
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(connectSSE, 4000);
      };
    };

    connectSSE();

    // Fallback polling every 7 seconds for maximum resilience
    const pollInterval = setInterval(() => {
      fetchDisplaySnapshot();
    }, 7000);

    return () => {
      if (sseRef.current) sseRef.current.close();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      clearInterval(pollInterval);
    };
  }, [token, fetchDisplaySnapshot]);

  // Toggle Fullscreen (Smart TV remote friendly)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const primaryCalled = data?.currentCalled?.[0];
  const secondaryCalled = data?.currentCalled?.slice(1, 4) || [];
  const waitingList = data?.waitingList || [];

  if (loading && !data) {
    return (
      <div className="fixed inset-0 bg-[#070d18] text-white flex flex-col items-center justify-center p-6 select-none">
        <Tv className="w-20 h-20 text-blue-500 animate-pulse mb-6" />
        <h2 className="text-3xl font-black tracking-wider text-slate-100">NAVBATBOR LIVE DISPLAY</h2>
        <p className="text-slate-400 mt-2 text-lg">Smart TV ekrani yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#070d18] text-white flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-rose-400" />
        </div>
        <h2 className="text-3xl font-black text-white">Ekran Xatosi</h2>
        <p className="text-slate-300 max-w-lg mt-3 text-lg leading-relaxed">{error}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-8 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-base transition cursor-pointer"
          >
            Orqaga qaytish
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-[#070d18] text-white flex flex-col font-sans select-none overflow-hidden transition-colors duration-500 ${
        isFlashing ? 'ring-8 ring-emerald-500/80 ring-inset' : ''
      }`}
    >
      {/* Autoplay Audio Safety Activator Banner */}
      {!audioUnlocked && (
        <div 
          onClick={unlockAudio}
          className="bg-gradient-to-r from-amber-600 via-emerald-600 to-blue-600 px-6 py-2.5 text-center text-sm font-black tracking-wide text-white cursor-pointer shadow-lg flex items-center justify-center gap-3 animate-pulse hover:opacity-95 transition"
        >
          <BellRing className="w-5 h-5 animate-bounce" />
          <span>🔊 Smart TV ovozli chaqirishni yoqish uchun ekranni yoki pultdagi OK tugmasini bosing!</span>
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest">Faollashtirish</span>
        </div>
      )}

      {/* 1. TOP HEADER (16:9 TV Header) */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-8 py-4 flex items-center justify-between shadow-2xl">
        {/* Left: Business Branding */}
        <div className="flex items-center gap-4">
          {data?.business.logo_url ? (
            <img 
              src={data.business.logo_url} 
              alt={data.business.name} 
              className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 shadow-md bg-white/5" 
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-2xl shadow-md border border-white/10">
              {data?.business.name?.slice(0, 1) || 'N'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                {data?.business.name}
              </h1>
              <span className="px-3 py-1 rounded-xl bg-blue-950/80 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-wider">
                {data?.screen.name || 'Jonli Tablo'}
              </span>
            </div>
            <p className="text-slate-400 text-xs lg:text-sm mt-0.5 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{data?.business.address || 'Qarshi shahri'}</span>
            </p>
          </div>
        </div>

        {/* Center: Live Real-Time Connection Indicator */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
          {isConnected ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>JONLI ULANGAN</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-wider animate-pulse">
              <WifiOff className="w-4 h-4 text-rose-400" />
              <span>ALOQA UZILDI — QAYTA ULANMOQDA...</span>
            </div>
          )}
        </div>

        {/* Right: Clock & TV Controls */}
        <div className="flex items-center gap-5">
          {/* Digital Clock */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-800/90 border border-slate-700 shadow-inner text-white font-mono">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-2xl font-black tracking-widest">{currentTime}</span>
          </div>

          {/* Quick TV Control Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!audioUnlocked) unlockAudio();
                setSoundEnabled(!soundEnabled);
              }}
              className={`p-3 rounded-2xl border transition cursor-pointer ${
                soundEnabled && audioUnlocked 
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
              title={soundEnabled ? 'Ovoz yoqilgan' : 'Ovoz o‘chirilgan'}
            >
              {soundEnabled && audioUnlocked ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              title="To‘liq ekran (Fullscreen)"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 transition cursor-pointer"
                title="Yopish"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN 16:9 SPLIT DISPLAY CONTENT */}
      <main className="flex-1 p-6 lg:p-8 grid grid-cols-12 gap-6 lg:gap-8 overflow-hidden min-h-0">
        
        {/* LEFT / HERO SECTION: CURRENTLY CALLED TICKET (7 Cols) */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-6 h-full justify-between">
          
          {/* Main Calling Spotlight Card */}
          <div className="flex-1 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border-2 border-slate-800 rounded-3xl p-8 lg:p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Ambient Spotlight Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 blur-3xl pointer-events-none rounded-full" />

            {/* Sub-header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full bg-emerald-500 animate-ping inline-block" />
                <h2 className="text-lg lg:text-xl font-black uppercase tracking-widest text-emerald-400">
                  HOZIR CHAQIRILAYOTGAN NAVBAT
                </h2>
              </div>
              {primaryCalled && (
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs lg:text-sm font-black uppercase tracking-wider animate-pulse">
                  {primaryCalled.status === 'CALLED' ? '📢 CHAQIRILDI' : '⚡️ QABULDA'}
                </span>
              )}
            </div>

            {/* Giant Center Ticket Number */}
            <div className="my-auto py-6 text-center relative z-10">
              {primaryCalled ? (
                <div className="space-y-4">
                  <div className="inline-block px-10 py-4 rounded-3xl bg-slate-950/80 border-4 border-emerald-500 shadow-2xl shadow-emerald-500/30 transition-transform duration-300 transform scale-100 hover:scale-[1.02]">
                    <span className="text-8xl lg:text-[11rem] font-black tracking-tight text-white leading-none drop-shadow-[0_10px_20px_rgba(16,185,129,0.4)]">
                      {primaryCalled.queue_number}
                    </span>
                  </div>

                  <div className="pt-4 space-y-2">
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-200">
                      {primaryCalled.service_name}
                    </div>

                    <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-300 text-lg lg:text-2xl font-black shadow-inner">
                      <Sparkles className="w-6 h-6 text-blue-400" />
                      <span>{primaryCalled.room_name || primaryCalled.staff_name || data?.screen.room_name || '1-xona'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-slate-800/80 border-2 border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                    <Tv className="w-12 h-12" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-400">Navbat Kutilmoqda</h3>
                  <p className="text-slate-500 text-lg max-w-md mx-auto">
                    Hozircha chaqirilgan mijoz yo‘q. Operator yangi navbatni chaqirganda ushbu ekranda katta raqam va ovozli xabar yangraydi.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Status Ticker */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs lg:text-sm text-slate-400 relative z-10">
              <span>Navbat tizimi: <strong className="text-slate-200">NavbatBor.uz</strong></span>
              <span>Xizmat ko‘rsatish: <strong className="text-emerald-400 font-bold">Avtomatlashtirilgan</strong></span>
            </div>
          </div>

          {/* Secondary Parallel Counters (If multiple tickets in service) */}
          {secondaryCalled.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {secondaryCalled.map((item) => (
                <div 
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg"
                >
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">
                    {item.room_name || item.staff_name || 'Xizmat xonasi'}
                  </div>
                  <div className="text-3xl lg:text-4xl font-black text-emerald-400 my-1">
                    {item.queue_number}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {item.service_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT SECTION: UPCOMING WAITING QUEUES (5 Cols) */}
        <section className="col-span-12 lg:col-span-5 h-full flex flex-col bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg lg:text-xl font-black uppercase tracking-widest text-slate-200">
                KEYINGI NAVBATLAR
              </h2>
            </div>
            <span className="px-3 py-1 rounded-xl bg-blue-950 border border-blue-500/30 text-blue-300 text-xs font-black">
              {data?.totalWaiting || 0} ta kutmoqda
            </span>
          </div>

          {/* Ticket Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {waitingList.length > 0 ? (
              waitingList.map((item, index) => (
                <div 
                  key={item.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all shadow-md ${
                    index === 0 
                      ? 'bg-blue-950/60 border-blue-500/60 text-white shadow-blue-950/50' 
                      : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Position & Ticket */}
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                        {item.queue_number}
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[200px] lg:max-w-[240px]">
                        {item.service_name}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                      index === 0 ? 'bg-blue-500/30 text-blue-300 border border-blue-400/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {index === 0 ? 'KEYINGI' : 'KUTMOQDA'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-500">
                <Users className="w-12 h-12 opacity-40" />
                <p className="text-base font-bold text-slate-400">Navbatda kutayotganlar yo‘q</p>
                <p className="text-xs text-slate-500">Yangi mijozlar qo‘shilganda ushbu ro‘yxatda avtomatik ko‘rinadi.</p>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Iltimos, navbatingizni kuting</span>
            <span className="text-blue-400 font-bold">16:9 Smart TV Format</span>
          </div>
        </section>

      </main>
    </div>
  );
};
