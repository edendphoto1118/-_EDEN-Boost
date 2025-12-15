
import React, { useState } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, ARCH_TAGS } from '../constants';
import { PenTool, Tag, Wand2, Sparkles } from 'lucide-react';
import { optimizeUserPrompt } from '../services/geminiService';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  language: Language;
}

const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, language }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const t = TRANSLATIONS[language];
  const tags = ARCH_TAGS[language];

  const handleTagClick = (tag: string) => {
    // Append tag to existing value with comma if needed
    const newValue = value.trim() ? `${value.trim()}, ${tag}` : tag;
    onChange(newValue);
  };

  const handleOptimize = async () => {
    if (!value.trim()) return;
    
    setIsOptimizing(true);
    try {
        const optimized = await optimizeUserPrompt(value, language);
        onChange(optimized);
    } catch (e) {
        console.error(e);
    } finally {
        setIsOptimizing(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden group">
      {/* Background Gradient Accent */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-purple-500/15 transition-colors duration-500"></div>

      <div className="flex justify-between items-end relative z-10">
        <label className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
           <PenTool className="w-4 h-4 text-purple-400" />
           {t.promptInputLabel}
        </label>
        
        <button
            onClick={handleOptimize}
            disabled={!value.trim() || isOptimizing}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                ${!value.trim() || isOptimizing 
                   ? 'bg-zinc-800 border-transparent text-zinc-600 cursor-not-allowed' 
                   : 'bg-zinc-900 border-purple-500/50 text-purple-200 hover:bg-purple-500/20 hover:shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]'}
            `}
        >
            {isOptimizing ? (
                <>
                 <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 {t.optimizing}
                </>
            ) : (
                <>
                 <Sparkles className="w-3 h-3" />
                 {t.aiEnhance}
                </>
            )}
        </button>
      </div>

      <div className="relative group/input">
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.promptInputPlaceholder}
            rows={4}
            className={`
                w-full bg-black/40 border rounded-xl p-4 text-sm font-mono text-zinc-200 placeholder-zinc-700 
                focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none
                ${isOptimizing ? 'opacity-50 blur-[1px]' : 'opacity-100'}
                border-white/10
            `}
            disabled={isOptimizing}
        />
        {isOptimizing && (
            <div className="absolute inset-0 flex items-center justify-center">
                 <Wand2 className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
        )}
      </div>

      <div className="space-y-3">
         <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {t.tagsLabel}
         </label>
         
         <div className="space-y-2">
            {Object.entries(tags).map(([category, items]) => (
                <div key={category} className="flex flex-wrap gap-2">
                    {(items as string[]).map((tag) => (
                        <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            disabled={isOptimizing}
                            className="px-3 py-1.5 text-xs font-medium rounded-full border border-white/5 bg-black/20 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default PromptInput;
