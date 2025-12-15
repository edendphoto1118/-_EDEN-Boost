import React, { useState } from 'react';
import { PromptResult, Language, MasterStyle } from '../types';
import { TRANSLATIONS } from '../constants';
import { ImageIcon, Maximize2, Pencil, Download, Check, Copy, Camera, Zap } from 'lucide-react';
import InpaintingCanvas from './InpaintingCanvas';

interface ResultCardProps {
  result: PromptResult;
  title: string;
  badge?: string;
  isEditing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditApply: (mask: string, prompt: string) => void;
  onZoom: () => void;
  onDownload: () => void;
  filterConfig?: {
    label: string;
    styles: MasterStyle[];
    onFilterClick: (stylePrompt: string) => void;
    isDisabled: boolean;
  };
  language: Language;
  status: string; // for loading states
}

const ResultCard: React.FC<ResultCardProps> = ({
  result,
  title,
  badge,
  isEditing,
  onEditStart,
  onEditCancel,
  onEditApply,
  onZoom,
  onDownload,
  filterConfig,
  language,
  status
}) => {
  const [copied, setCopied] = useState(false);
  const [localEditMask, setLocalEditMask] = useState<string | null>(null);
  const [localEditPrompt, setLocalEditPrompt] = useState("");
  const t = TRANSLATIONS[language];

  const handleCopy = () => {
    if (result?.prompt) {
      navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = () => {
    if (localEditMask && localEditPrompt) {
      onEditApply(localEditMask, localEditPrompt);
      // Reset local state after apply handled by parent
      setLocalEditMask(null);
      setLocalEditPrompt("");
    }
  };

  const isProcessing = status !== 'idle';

  return (
    <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* 1. Image Result */}
      {result.imageData && (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex justify-between items-center backdrop-blur-sm">
            <h3 className="text-cyan-400 font-medium text-sm sm:text-base flex items-center gap-2 font-mono uppercase tracking-wider">
              <ImageIcon className="w-5 h-5" />
              {title} 
              <span className="text-[10px] sm:text-xs bg-cyan-950/50 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/20">
                {badge || "Gemini 2.5"}
              </span>
            </h3>
            
            <div className="flex items-center gap-2">
               {!isEditing && (
                  <>
                  <button 
                      onClick={onZoom}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-white/5"
                  >
                      <Maximize2 className="w-4 h-4" />
                      {t.zoomIn}
                  </button>
                  <button 
                      onClick={onEditStart}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-100 hover:bg-white text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <Pencil className="w-4 h-4" />
                      {t.editMode}
                  </button>
                  </>
               )}
               <button
                  onClick={onDownload}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-white/5"
              >
                  <Download className="w-4 h-4" />
                  {t.download}
              </button>
            </div>
          </div>
          
          <div className="p-1 bg-black/50">
            {isEditing ? (
               <div className="space-y-4 p-4">
                  <InpaintingCanvas 
                      baseImage={result.imageData} 
                      onMaskReady={setLocalEditMask}
                      language={language}
                  />
                  
                  <div className="bg-zinc-900/80 p-5 rounded-xl border border-white/10 flex flex-col gap-4">
                      <label className="text-sm text-zinc-400 font-bold uppercase tracking-wider">
                          {t.editPromptPlaceholder}
                      </label>
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              value={localEditPrompt}
                              onChange={(e) => setLocalEditPrompt(e.target.value)}
                              placeholder="e.g. Change the concrete material to brick"
                              className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 placeholder-zinc-700"
                          />
                          <button 
                              onClick={handleApply}
                              disabled={!localEditMask || !localEditPrompt || status === 'editing'}
                              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                          >
                              {t.applyEdit}
                          </button>
                           <button 
                              onClick={() => {
                                setLocalEditMask(null);
                                setLocalEditPrompt("");
                                onEditCancel();
                              }}
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                              {t.cancelEdit}
                          </button>
                      </div>
                  </div>
               </div>
            ) : (
              <div className="relative group cursor-zoom-in" onClick={onZoom}>
                  <img 
                      src={`data:image/png;base64,${result.imageData}`} 
                      alt="Visualization" 
                      className="w-full h-auto rounded-xl shadow-2xl border border-white/5 transition-opacity hover:opacity-95"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-full text-white text-sm font-bold tracking-wider flex items-center gap-2 border border-white/10">
                          <Maximize2 className="w-5 h-5" />
                          {t.zoomIn}
                      </div>
                  </div>
              </div>
            )}
          </div>

          {/* Master Filter Toolbar */}
          {!isEditing && filterConfig && (
              <div className="bg-black/60 px-6 py-5 border-t border-white/5 backdrop-blur-xl">
                   <h4 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      {filterConfig.label}
                   </h4>
                   <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                      {filterConfig.styles.map((style) => (
                          <button
                              key={style.id}
                              onClick={() => filterConfig.onFilterClick(style.prompt)}
                              disabled={filterConfig.isDisabled}
                              className="flex flex-col items-center gap-2 min-w-[80px] p-2 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10 group/filter disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center group-hover/filter:bg-cyan-500/10 group-hover/filter:border-cyan-500/50 transition-all shadow-lg shadow-black/50">
                                   <Zap className="w-5 h-5 text-zinc-500 group-hover/filter:text-cyan-400" />
                              </div>
                              <span className="text-[10px] text-zinc-500 group-hover/filter:text-zinc-300 text-center font-bold uppercase tracking-wide leading-tight">{style.label}</span>
                          </button>
                      ))}
                   </div>
              </div>
          )}
        </div>
      )}

      {/* 2. Text Prompt Result */}
      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-lg">
        <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-zinc-100 font-medium text-sm sm:text-base flex items-center gap-2 font-mono uppercase tracking-wider">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            {t.resultReady}
          </h3>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-transparent hover:bg-white/5 rounded-lg transition-colors text-zinc-400"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <div className="p-6">
          <div className="bg-black/50 rounded-xl p-6 border border-white/5 font-mono text-sm leading-relaxed text-zinc-300 break-words whitespace-pre-wrap selection:bg-cyan-500/30">
            {result.prompt}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
