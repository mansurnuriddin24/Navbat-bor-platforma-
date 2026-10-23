import React from 'react';
import { 
  Home, Search, Clock, Calendar, Briefcase, Shield, User as UserIcon, QrCode
} from 'lucide-react';
import { User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface MobileBottomNavProps {
  activeView: 'home' | 'search' | 'business-detail' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business' | 'live-display';
  setActiveView: (view: 'home' | 'search' | 'customer-dashboard' | 'business-dashboard' | 'admin-panel' | 'operating-partner' | 'for-customers' | 'for-business') => void;
  currentUser?: User | null;
  user?: User | null;
  activeQueueCount?: number;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenScanQR: () => void;
  onNavigateToCustomerTab?: (tab: 'bookings' | 'queue' | 'favorites' | 'history' | 'profile') => void;
  customerActiveTab?: 'bookings' | 'queue' | 'favorites' | 'history' | 'profile';
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  setActiveView,
  currentUser,
  user: userProp,
  activeQueueCount = 0,
  onOpenAuth,
  onOpenScanQR,
  onNavigateToCustomerTab,
  customerActiveTab = 'bookings',
}) => {
  const user = currentUser ?? userProp ?? null;
  const { t } = useTranslation();

  // Active state conditions
  const isHomeActive = activeView === 'home';
  const isSearchActive = activeView === 'search';
  const isBookingsActive = activeView === 'customer-dashboard' && (customerActiveTab === 'bookings' || customerActiveTab === 'queue' || customerActiveTab === 'history');
  
  const isProfileActive = 
    (activeView === 'customer-dashboard' && (customerActiveTab === 'profile' || customerActiveTab === 'favorites')) ||
    (activeView === 'business-dashboard') ||
    (activeView === 'admin-panel') ||
    (activeView === 'operating-partner');

  const handleBookingsClick = () => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    if (onNavigateToCustomerTab) {
      onNavigateToCustomerTab('bookings');
    } else {
      setActiveView('customer-dashboard');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileClick = () => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    if (user.role === 'BUSINESS_OWNER' || user.role === 'STAFF') {
      setActiveView('business-dashboard');
    } else if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'FOUNDER' || user.role === 'OWNER') {
      setActiveView('admin-panel');
    } else if (user.role === 'OPERATING_PARTNER' || user.role === 'SALES_MANAGER' || user.role === 'BUSINESS_MANAGER') {
      setActiveView('operating-partner');
    } else {
      // Regular customer
      if (onNavigateToCustomerTab) {
        onNavigateToCustomerTab('profile');
      } else {
        setActiveView('customer-dashboard');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine profile button label and icon based on role
  const getProfileMeta = () => {
    if (!user) {
      return {
        label: t('bottom_profile'),
        icon: UserIcon,
      };
    }
    if (user.role === 'BUSINESS_OWNER' || user.role === 'STAFF') {
      return {
        label: t('business_cabinet'),
        icon: Briefcase,
      };
    }
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'FOUNDER' || user.role === 'OWNER') {
      return {
        label: 'Admin',
        icon: Shield,
      };
    }
    if (user.role === 'OPERATING_PARTNER' || user.role === 'SALES_MANAGER' || user.role === 'BUSINESS_MANAGER') {
      return {
        label: 'Hamkor',
        icon: Briefcase,
      };
    }
    return {
      label: t('bottom_profile'),
      icon: UserIcon,
    };
  };

  const profileMeta = getProfileMeta();
  const ProfileIcon = profileMeta.icon;

  return (
    <nav 
      aria-label="Mobil pastki navigatsiya"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* 1. Asosiy (Home) */}
        <button
          id="mobile-nav-home"
          onClick={() => {
            setActiveView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] cursor-pointer ${
            isHomeActive
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-5 h-5 transition-transform ${isHomeActive ? 'scale-110 text-blue-600 stroke-[2.4]' : ''}`} />
          <span className="text-[10px] mt-1 font-semibold leading-none">{t('bottom_home')}</span>
        </button>

        {/* 2. Katalog */}
        <button
          id="mobile-nav-search"
          onClick={() => {
            setActiveView('search');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] cursor-pointer ${
            isSearchActive
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Search className={`w-5 h-5 transition-transform ${isSearchActive ? 'scale-110 text-blue-600 stroke-[2.4]' : ''}`} />
          <span className="text-[10px] mt-1 font-semibold leading-none">{t('bottom_catalog')}</span>
        </button>

        {/* 3. QR Scanner (Center Action Button) */}
        <button
          id="mobile-nav-scan-qr"
          onClick={onOpenScanQR}
          className="flex flex-col items-center justify-center -mt-4 min-w-[58px] min-h-[50px] group cursor-pointer"
          title="QR Scanner — QR orqali navbat oling"
          aria-label="QR Scanner"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 ring-4 ring-white group-active:scale-95 group-hover:shadow-blue-500/50 transition-all">
            <QrCode className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 font-bold text-blue-700 leading-none">
            {t('bottom_scan_qr')}
          </span>
        </button>

        {/* 4. Bronlarim */}
        <button
          id="mobile-nav-bookings"
          onClick={handleBookingsClick}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] relative cursor-pointer ${
            isBookingsActive
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            {activeQueueCount > 0 ? (
              <Clock className="w-5 h-5 text-amber-500 animate-pulse stroke-[2.4]" />
            ) : (
              <Calendar className={`w-5 h-5 transition-transform ${isBookingsActive ? 'scale-110 text-blue-600 stroke-[2.4]' : ''}`} />
            )}
            {activeQueueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-ping" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-semibold leading-none">
            {activeQueueCount > 0 ? t('live_queue') : t('bottom_bookings')}
          </span>
        </button>

        {/* 5. Profilim */}
        <button
          id="mobile-nav-profile"
          onClick={handleProfileClick}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[54px] min-h-[44px] cursor-pointer ${
            isProfileActive
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ProfileIcon className={`w-5 h-5 transition-transform ${isProfileActive ? 'scale-110 text-blue-600 stroke-[2.4]' : ''}`} />
          <span className="text-[10px] mt-1 font-semibold leading-none truncate max-w-[58px]">
            {profileMeta.label}
          </span>
        </button>
      </div>
    </nav>
  );
};
