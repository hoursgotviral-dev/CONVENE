import React from 'react';

interface SamanvayMarkProps {
  className?: string;
}

export const SamanvayMark: React.FC<SamanvayMarkProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      className={className}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="samanvay-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#5F5AF6" />
        </linearGradient>
        <linearGradient id="samanvay-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#312E81" />
        </linearGradient>
      </defs>
      {/* Background subtle glow */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="url(#samanvay-grad-1)" strokeWidth="1.5" strokeOpacity="0.15" />
      
      {/* Stylized interlocking nodes representing harmony / orchestration */}
      {/* Left node */}
      <circle cx="35" cy="50" r="12" fill="url(#samanvay-grad-2)" />
      <circle cx="35" cy="50" r="4" fill="#FFFFFF" />
      
      {/* Right node */}
      <circle cx="65" cy="50" r="12" fill="url(#samanvay-grad-1)" />
      <circle cx="65" cy="50" r="4" fill="#FFFFFF" />
      
      {/* Connecting curved ribbon (coordination loop) */}
      <path 
        d="M 35,50 C 42,30 58,30 65,50 C 58,70 42,70 35,50 Z" 
        fill="none" 
        stroke="url(#samanvay-grad-1)" 
        strokeWidth="4.5" 
        strokeLinecap="round" 
      />
            
      {/* Center overlap star/node */}
      <circle cx="50" cy="50" r="2.5" fill="#FFFFFF" />
    </svg>
  );
};
