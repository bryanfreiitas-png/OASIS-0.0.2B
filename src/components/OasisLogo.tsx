import React from 'react';

interface OasisLogoProps {
  compact?: boolean;
}

export const OasisLogo: React.FC<OasisLogoProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 shrink-0 select-none">
        <img
          src="/assets/sprites/oasis_logo.png"
          alt="OASIS"
          referrerPolicy="no-referrer"
          className="h-10 w-auto object-contain pixelated drop-shadow-[0_2px_6px_rgba(168,85,247,0.45)]"
        />
        <div className="hidden sm:block leading-none">
          <div className="text-[10px] font-bold tracking-widest text-amber-300 uppercase whitespace-nowrap">
            CONECTE · CONQUISTE · DIVIRTA-SE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center select-none">
      <img
        src="/assets/sprites/oasis_logo.png"
        alt="OASIS"
        referrerPolicy="no-referrer"
        className="h-24 w-auto object-contain pixelated drop-shadow-[0_4px_16px_rgba(168,85,247,0.5)]"
      />
    </div>
  );
};
