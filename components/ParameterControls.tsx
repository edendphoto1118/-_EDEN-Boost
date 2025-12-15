
import React from 'react';
import { GenerationParams, LightingTime, SunDirection, WeatherCondition } from '../types';
import { Sun, CloudRain, Compass } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface ParameterControlsProps {
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
}

const ParameterControls: React.FC<ParameterControlsProps> = ({ params, onChange }) => {
  const t = TRANSLATIONS[params.language];

  const updateParam = (key: keyof GenerationParams, value: any) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-6 bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10">
      <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
        {t.sceneParams}
      </h3>
      
      {/* Lighting Time */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" /> {t.lighting}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(LightingTime).map((time) => (
            <button
              key={time}
              onClick={() => updateParam('lighting', time)}
              className={`
                px-3 py-3 text-sm rounded-lg border transition-all font-medium
                ${params.lighting === time 
                  ? 'bg-zinc-100 border-white text-zinc-900 shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)]' 
                  : 'bg-black/20 border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}
              `}
            >
              {(t as any)[time]}
            </button>
          ))}
        </div>
      </div>

      {/* Sun Direction */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" /> {t.sunDirection}
        </label>
        <select
          value={params.sunDirection}
          onChange={(e) => updateParam('sunDirection', e.target.value)}
          className="w-full bg-black/40 border border-white/10 text-zinc-300 text-sm rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 block p-3 outline-none"
        >
          {Object.values(SunDirection).map((dir) => (
            <option key={dir} value={dir}>{(t as any)[dir]}</option>
          ))}
        </select>
      </div>

      {/* Weather */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-sky-400" /> {t.weather}
        </label>
        <div className="grid grid-cols-2 gap-2">
            {Object.values(WeatherCondition).map((weather) => (
                <button
                key={weather}
                onClick={() => updateParam('weather', weather)}
                className={`
                    px-3 py-3 text-sm text-left rounded-lg border transition-all truncate font-medium
                    ${params.weather === weather
                    ? 'bg-sky-900/30 border-sky-500/50 text-sky-200 shadow-[0_0_10px_-2px_rgba(14,165,233,0.3)]' 
                    : 'bg-black/20 border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}
                `}
                >
                {(t as any)[weather]}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ParameterControls;
