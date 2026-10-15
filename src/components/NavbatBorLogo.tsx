import React from 'react';

interface NavbatBorLogoProps {
  /**
   * 'card' - Full square/rounded card with blue background, circle emblem, wordmark & tagline (like the user image)
   * 'horizontal' - Emblem on left, wordmark + tagline on right (ideal for Navbar and headers)
   * 'icon' - Just the circular building + leaf emblem (ideal for avatars, buttons, favicon)
   * 'emblem-card' - Blue badge with just the circular emblem
   */
  variant?: 'card' | 'horizontal' | 'icon' | 'emblem-card';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showTagline?: boolean;
  lightText?: boolean;
}

export const NavbatBorLogo: React.FC<NavbatBorLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showTagline = true,
  lightText = false
}) => {
  // Dimension mapping
  let iconPixelSize = 40;
  if (typeof size === 'number') {
    iconPixelSize = size;
  } else {
    switch (size) {
      case 'xs': iconPixelSize = 24; break;
      case 'sm': iconPixelSize = 32; break;
      case 'md': iconPixelSize = 42; break;
      case 'lg': iconPixelSize = 56; break;
      case 'xl': iconPixelSize = 96; break;
    }
  }

  // The official NavbatBor "N" Monogram with Queue Flow & Precision Time Arc
  const renderEmblem = (isInvertColor: boolean = false) => {
    const primaryColor = isInvertColor ? '#0066FF' : '#ffffff';
    const accentColor = isInvertColor ? '#00D8B6' : '#38BDF8';
    const chevronColor = isInvertColor ? '#ffffff' : '#0066FF';

    return (
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="emblemCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>
        </defs>

        {/* Subtle Orbit (Circular Queue Cycle) */}
        <circle
          cx="100"
          cy="100"
          r="78"
          stroke={primaryColor}
          strokeWidth="3.5"
          opacity="0.2"
          strokeDasharray="6 6"
        />

        {/* Active Queue Progress Arc */}
        <path
          d="M 100 22 A 78 78 0 1 1 22 100"
          stroke={isInvertColor ? '#0066FF' : 'url(#emblemCyanGrad)'}
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Glowing Queue Head Pulse (Punctual turn / Ready) */}
        <circle cx="100" cy="22" r="5" fill={accentColor} />
        <circle cx="100" cy="22" r="2.5" fill="#ffffff" />

        {/* Modern "N" Monogram: Left Pillar (Client in line) */}
        <rect x="54" y="52" width="22" height="96" rx="11" fill={primaryColor} />

        {/* Seamless Diagonal Ribbon (Speed & Continuity) */}
        <path d="M 54 63 L 76 52 L 146 137 L 124 148 Z" fill={primaryColor} opacity={0.96} />

        {/* Right Pillar (Service Counter / Turn Called) */}
        <rect x="124" y="52" width="22" height="96" rx="11" fill={primaryColor} />

        {/* Fast-Pass Forward Chevron (Skip the waiting line) */}
        <path
          d="M 90 88 L 108 100 L 90 112"
          fill="none"
          stroke={chevronColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // 1. Just the icon emblem
  if (variant === 'icon') {
    return (
      <div
        style={{ width: iconPixelSize, height: iconPixelSize }}
        className={`shrink-0 flex items-center justify-center ${className}`}
      >
        {renderEmblem(lightText)}
      </div>
    );
  }

  // 2. Emblem inside official blue gradient badge
  if (variant === 'emblem-card') {
    return (
      <div
        style={{ width: iconPixelSize, height: iconPixelSize }}
        className={`shrink-0 rounded-2xl bg-gradient-to-br from-[#0066FF] via-[#0052E0] to-[#003DB8] p-1.5 flex items-center justify-center shadow-md shadow-[#0066FF]/25 overflow-hidden transition-transform duration-200 hover:scale-105 ${className}`}
      >
        {renderEmblem(false)}
      </div>
    );
  }

  // 3. Full Official Card: Blue Gradient Card with Center Emblem, Wordmark and Tagline
  if (variant === 'card') {
    return (
      <div
        className={`bg-gradient-to-br from-[#0066FF] via-[#0052E0] to-[#003DB8] text-white rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-[#0066FF]/30 select-none ${className}`}
        style={{ minWidth: 240 }}
      >
        <div className="w-24 h-24 sm:w-28 sm:h-28 mb-4">
          {renderEmblem(false)}
        </div>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none">
          NavbatBor
        </div>
        {showTagline && (
          <p className="text-xs sm:text-sm font-medium text-white/90 mt-2 tracking-wide">
            Navbat kutmang. Vaqtingizni qadrlang.
          </p>
        )}
      </div>
    );
  }

  // 4. Horizontal Variant (Header / Navbar / Mobile)
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official Blue Gradient Emblem Badge */}
      <div
        style={{ width: iconPixelSize, height: iconPixelSize }}
        className="shrink-0 rounded-xl bg-gradient-to-br from-[#0066FF] via-[#0052E0] to-[#003DB8] p-1 flex items-center justify-center shadow-md shadow-[#0066FF]/25 transition-transform duration-200 group-hover:scale-105"
      >
        {renderEmblem(false)}
      </div>

      {/* Brand Text & Tagline */}
      <div className="text-left">
        <div className={`font-black tracking-tight text-lg sm:text-xl leading-tight ${lightText ? 'text-white' : 'text-slate-900'}`}>
          Navbat<span className="text-[#0066FF]">Bor</span>
        </div>
        {showTagline && (
          <p className={`text-[10px] font-medium leading-none mt-0.5 ${lightText ? 'text-white/80' : 'text-slate-500'}`}>
            Navbat kutmang. Vaqtingizni qadrlang.
          </p>
        )}
      </div>
    </div>
  );
};
