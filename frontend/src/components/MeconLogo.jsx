import React from 'react';

export function MeconLogo({ className = "h-9 w-9" }) {
  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
        <defs>
          {/* Shield Outer Gradient */}
          <linearGradient id="shieldBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f2b48" />
            <stop offset="50%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#09182a" />
          </linearGradient>

          {/* Border Glow Gradient */}
          <linearGradient id="borderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>

          {/* MECON Metallic 'M' Monogram Gradient */}
          <linearGradient id="mGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          {/* Energy Core Amber Spark */}
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Radiant Glow Ring */}
        <path
          d="M50 3 L92 21 V53 C92 78 50 97 50 97 C50 97 8 78 8 53 V21 Z"
          fill="none"
          stroke="url(#borderGlow)"
          strokeWidth="3.5"
          className="opacity-90"
        />

        {/* Main Solid Shield Body */}
        <path
          d="M50 7 L88 23 V51 C88 74 50 92 50 92 C50 92 12 74 12 51 V23 Z"
          fill="url(#shieldBg)"
          stroke="#1e40af"
          strokeWidth="1.5"
        />

        {/* Industrial Engineering Lines / Grid Accents */}
        <path d="M12 40 H88" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2 3" className="opacity-40" />
        <path d="M50 7 V92" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2 3" className="opacity-30" />

        {/* Central Bold Industrial 'M' Emblem */}
        <path
          d="M26 68 V34 L50 52 L74 34 V68"
          fill="none"
          stroke="url(#mGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Overlay Cyan Accent Trace on 'M' */}
        <path
          d="M26 68 V34 L50 52 L74 34 V68"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-80"
        />

        {/* Security Shield Lock Arc / Core Diamond Node */}
        <circle cx="50" cy="52" r="7" fill="url(#coreGlow)" />
        <circle cx="50" cy="52" r="3" fill="#ffffff" />
        <polygon points="50,22 53,27 50,32 47,27" fill="#38bdf8" />
      </svg>
    </div>
  );
}
