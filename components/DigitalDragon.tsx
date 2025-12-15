import React from 'react';

interface DigitalDragonProps {
  isActive: boolean;
}

const DigitalDragon: React.FC<DigitalDragonProps> = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <div className="flex flex-col items-end justify-center mr-6 select-none animate-in fade-in slide-in-from-right-8 duration-500">
      {/* 
        The Text Label: EDEN_D_PHOTO
        Using 'font-mono' for that code/tech look.
        'animate-eerie' class is defined in index.html for the flickering ghost effect
      */}
      <div className="text-xs sm:text-sm font-bold tracking-[0.25em] font-mono text-right mb-2 animate-eerie whitespace-nowrap">
        EDEN_D_PHOTO
      </div>

      {/* 
        The Progress Bar Container 
      */}
      <div className="w-32 sm:w-40 h-1 bg-zinc-800 rounded-full overflow-hidden relative border border-white/10">
        {/* 
          The Progress Fill 
          Silver/White Gradient
          animate-[progress-grow_10s_cubic-bezier(0.22,1,0.36,1)_forwards]
        */}
        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-zinc-500 via-white to-zinc-400 animate-[progress-grow_10s_cubic-bezier(0.22,1,0.36,1)_forwards] shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
      </div>
    </div>
  );
};

export default DigitalDragon;