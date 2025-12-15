
import React from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { PromptResult, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface ImageModalProps {
  result: PromptResult | null;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

const ImageModal: React.FC<ImageModalProps> = ({ result, isOpen, onClose, language }) => {
  const [copied, setCopied] = React.useState(false);
  const t = TRANSLATIONS[language];

  if (!isOpen || !result || !result.imageData) return null;

  const handleDownload = () => {
    if (result.imageData) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${result.imageData}`;
      link.download = `archviz-full-${result.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-8 animate-in fade-in duration-300">
      
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors z-50 border border-white/5"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="flex flex-col max-w-7xl max-h-full w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        
        {/* Image Area - Flexible Height */}
        <div className="flex-1 overflow-auto bg-black flex items-center justify-center p-4 relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
             <img 
               src={`data:image/png;base64,${result.imageData}`} 
               alt="Full view" 
               className="max-w-full max-h-[80vh] object-contain shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)]"
             />
        </div>

        {/* Footer Info Area */}
        <div className="bg-zinc-900/90 border-t border-white/10 p-6 flex flex-col sm:flex-row gap-6 backdrop-blur-md">
          
          <div className="flex-1">
             <h3 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-widest">{t.imageResult}</h3>
             <div className="text-xs text-zinc-400 font-mono line-clamp-2 hover:line-clamp-none transition-all cursor-default bg-black/50 p-4 rounded-xl border border-white/5">
               {result.prompt}
             </div>
          </div>

          <div className="flex flex-col justify-center gap-3 min-w-[140px]">
             <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-white text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
             >
                <Download className="w-4 h-4" />
                {t.download}
             </button>
             <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-white/5 text-zinc-400 border border-white/10 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
             >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? t.copied : t.copy}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ImageModal;
