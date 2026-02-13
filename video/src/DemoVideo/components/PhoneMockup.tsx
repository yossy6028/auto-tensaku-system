import React from 'react';

export const PhoneMockup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative">
      {/* Phone frame */}
      <div className="relative w-[320px] rounded-[40px] border-[8px] border-slate-800 bg-slate-800 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-800" />

        {/* Screen */}
        <div className="relative h-[640px] overflow-hidden rounded-[32px] bg-white">
          {children}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-slate-600" />
      </div>
    </div>
  );
};
