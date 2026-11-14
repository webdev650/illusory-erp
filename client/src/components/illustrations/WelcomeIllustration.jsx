import React from 'react';

export const WelcomeIllustration = ({ className = 'w-48 h-32' }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gradBrand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="gradAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="gradSoft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.6" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Decorative ambient blobs */}
      <circle cx="170" cy="80" r="50" fill="url(#gradBrand)" opacity="0.15" filter="url(#softGlow)" />
      <circle cx="210" cy="40" r="30" fill="url(#gradAccent)" opacity="0.12" filter="url(#softGlow)" />

      {/* Main Agency Canvas card */}
      <rect
        x="60"
        y="30"
        width="130"
        height="95"
        rx="14"
        fill="url(#gradSoft)"
        stroke="#e2e8f0"
        strokeWidth="1.5"
        className="dark:fill-[#1E2536] dark:stroke-[#2B354C]"
      />

      {/* Window Header dots */}
      <circle cx="76" cy="44" r="3" fill="#f43f5e" opacity="0.8" />
      <circle cx="86" cy="44" r="3" fill="#eab308" opacity="0.8" />
      <circle cx="96" cy="44" r="3" fill="#10b981" opacity="0.8" />

      {/* Internal dashboard mockup bars */}
      <rect x="74" y="60" width="45" height="6" rx="3" fill="#8b5cf6" opacity="0.8" />
      <rect x="74" y="74" width="70" height="4" rx="2" fill="#cbd5e1" opacity="0.6" className="dark:fill-[#475569]" />
      <rect x="74" y="84" width="55" height="4" rx="2" fill="#cbd5e1" opacity="0.4" className="dark:fill-[#475569]" />

      {/* Circular progress ring mockup */}
      <circle cx="155" cy="80" r="18" stroke="#e2e8f0" strokeWidth="4" className="dark:stroke-[#2E3850]" />
      <path
        d="M 155 62 A 18 18 0 0 1 173 80"
        stroke="url(#gradBrand)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="155" cy="80" r="4" fill="#6366f1" />

      {/* Floating Design Studio Badge / Palette */}
      <g transform="translate(140, 95)">
        <rect
          x="0"
          y="0"
          width="75"
          height="45"
          rx="10"
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          className="dark:fill-[#151A26] dark:stroke-[#2B354C]"
          filter="drop-shadow(0 4px 12px rgba(0,0,0,0.06))"
        />
        <circle cx="18" cy="22" r="7" fill="#10b981" opacity="0.85" />
        <path d="M15 22l2 2 4-4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="32" y="15" width="30" height="5" rx="2.5" fill="#475569" className="dark:fill-[#94a3b8]" />
        <rect x="32" y="25" width="22" height="3" rx="1.5" fill="#94a3b8" opacity="0.6" />
      </g>

      {/* Floating Sparkles */}
      <g transform="translate(45, 75)">
        <path
          d="m8 0 1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"
          fill="#f59e0b"
          opacity="0.9"
        />
      </g>
      <g transform="translate(200, 75)">
        <path
          d="m6 0 1.2 3.6L11 5l-3.8 1.4L6 10l-1.2-3.6L1 5l3.8-1.4L6 0z"
          fill="#8b5cf6"
          opacity="0.85"
        />
      </g>
    </svg>
  );
};

export default WelcomeIllustration;
