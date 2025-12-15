import React, { useState, useEffect } from 'react';
import { 
  LightingTime, 
  SunDirection, 
  WeatherCondition, 
  UploadedImage, 
  GenerationParams, 
  Language,
  PromptResult
} from './types';
import { TRANSLATIONS, MASTER_STYLES } from './constants';
import ImageUploader from './components/ImageUploader';
import ParameterControls from './components/ParameterControls';
import PromptInput from './components/PromptInput';
import ImageModal from './components/ImageModal';
import DigitalDragon from './components/DigitalDragon';
import ResultCard from './components/ResultCard'; // New Component
import { generateArchitecturalPrompt, editArchitecturalImage, applyMasterStyle } from './services/geminiService';
import { Wand2, AlertCircle, Building2, Globe, ChevronRight, ShoppingBag, ExternalLink, Clock, Maximize2 } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [sketch, setSketch] = useState<UploadedImage[]>([]);
  const [context, setContext] = useState<UploadedImage[]>([]);
  const [references, setReferences] = useState<UploadedImage[]>([]);
  const [userPrompt, setUserPrompt] = useState("");
  
  const [params, setParams] = useState<GenerationParams>({
    lighting: LightingTime.Sunny,
    sunDirection: SunDirection.TopLeft,
    weather: WeatherCondition.Clear,
    language: Language.English,
  });

  const [result, setResult] = useState<PromptResult | null>(null); // Original Result
  const [styledResult, setStyledResult] = useState<PromptResult | null>(null); // Master Filtered Result
  const [history, setHistory] = useState<PromptResult[]>([]);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<PromptResult | null>(null);

  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'editing'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Editing State
  // Tracks which card is currently being edited: 'original', 'styled', or null
  const [editingTarget, setEditingTarget] = useState<'original' | 'styled' | null>(null);

  const t = TRANSLATIONS[params.language];
  const masterStyles = MASTER_STYLES[params.language];
  
  // Fixed Affiliate Link
  const SHOPEE_LINK = "https://s.shopee.tw/8zy2gtPZhc";

  // --- Effects ---
  useEffect(() => {
    return () => {
      [...sketch, ...context, ...references].forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  // --- Handlers ---
  const handleGenerate = async (masterStylePrompt?: string) => {
    if (sketch.length === 0) {
      setError(t.errorSketch);
      return;
    }

    setStatus('analyzing');
    setError(null);
    setResult(null);
    setStyledResult(null);
    setEditingTarget(null);

    try {
      const generatedResult = await generateArchitecturalPrompt(
        sketch[0],
        context.length > 0 ? context[0] : null,
        references,
        params,
        userPrompt,
        (currentStatus) => setStatus(currentStatus),
        masterStylePrompt
      );
      setResult(generatedResult);
      
      // Add to history (keep max 3)
      setHistory(prev => {
        const newHistory = [generatedResult, ...prev];
        return newHistory.slice(0, 3);
      });

    } catch (err: any) {
      console.error(err);
      setError(t.errorGeneric);
    } finally {
      setStatus('idle');
    }
  };

  const handleMasterStyleClick = async (source: 'original' | 'styled', stylePrompt: string) => {
    const sourceResult = source === 'original' ? result : styledResult;

    if (!sourceResult?.imageData) {
      // If we don't have a result yet, just run generation with style
      handleGenerate(stylePrompt);
      return;
    }

    setStatus('generating');
    setError(null);
    setEditingTarget(null);

    try {
      const styledImageData = await applyMasterStyle(sourceResult.imageData, sourceResult.prompt, stylePrompt);
      
      const newResult: PromptResult = {
        id: Date.now().toString(),
        prompt: `[MASTER FILTER APPLIED] ${sourceResult.prompt}`,
        imageData: styledImageData,
        timestamp: Date.now()
      };

      setStyledResult(newResult); // Always update the Styled Result slot

      // Add to history
      setHistory(prev => {
        const newHistory = [newResult, ...prev];
        return newHistory.slice(0, 3);
      });

    } catch (err) {
      console.error("Master Style Error", err);
      setError(t.errorGeneric);
    } finally {
      setStatus('idle');
    }
  };

  const handleApplyEdit = async (mask: string, prompt: string) => {
    const targetResult = editingTarget === 'original' ? result : styledResult;

    if (!targetResult?.imageData) return;
    
    setStatus('editing');
    try {
       const newImageData = await editArchitecturalImage(targetResult.imageData, mask, prompt);
       const updatedResult = { ...targetResult, imageData: newImageData, id: Date.now().toString(), timestamp: Date.now() };
       
       if (editingTarget === 'original') {
         setResult(updatedResult);
       } else {
         setStyledResult(updatedResult);
       }

       // Add edited version to history too
       setHistory(prev => [updatedResult, ...prev].slice(0, 3));
       
       setEditingTarget(null);
    } catch (err) {
       console.error("Edit failed", err);
       setError(t.errorGeneric);
    } finally {
       setStatus('idle');
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setParams({ ...params, language: e.target.value as Language });
  };

  const handleDownloadImage = (res: PromptResult) => {
    if (res?.imageData) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${res.imageData}`;
      link.download = `eden-archviz-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const openModal = (item: PromptResult) => {
    setSelectedResult(item);
    setModalOpen(true);
  };

  const handleVisitShop = () => {
    window.open(SHOPEE_LINK, '_blank');
  };

  const isProcessing = status === 'analyzing' || status === 'generating';

  // --- Render ---
  return (
    <div className="min-h-screen text-zinc-100 selection:bg-cyan-500/30">
      
      <ImageModal 
         isOpen={modalOpen}
         result={selectedResult}
         onClose={() => setModalOpen(false)}
         language={params.language}
      />

      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center group-hover:border-cyan-500/50 transition-colors">
              <Building2 className="text-zinc-100 w-6 h-6 group-hover:text-cyan-400 transition-colors" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wider font-mono uppercase">{t.appTitle}</h1>
              <p className="text-xs sm:text-sm text-zinc-500 tracking-wider font-medium">{t.appSubtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Language Selector */}
             <div className="flex items-center gap-2 bg-zinc-900/50 rounded-full px-4 py-1.5 border border-white/5 hover:border-white/20 transition-colors">
                <Globe className="w-4 h-4 text-zinc-400" />
                <select 
                  value={params.language} 
                  onChange={handleLanguageChange}
                  className="bg-transparent text-sm text-zinc-300 border-none outline-none focus:ring-0 cursor-pointer w-24 sm:w-auto font-medium"
                >
                  {Object.values(Language).map((lang) => (
                    <option key={lang} value={lang} className="bg-zinc-900 text-zinc-200">
                      {lang}
                    </option>
                  ))}
                </select>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {error && (
          <div className="mb-6 bg-rose-950/20 border border-rose-500/20 rounded-lg p-4 flex items-center gap-3 text-rose-300 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Layout Grid: Reversed on mobile to show Sketch Upload first */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Controls (Order-2 on Mobile, Order-1 on Desktop) */}
          <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
            
            <PromptInput 
              value={userPrompt}
              onChange={setUserPrompt}
              language={params.language}
            />

            <ParameterControls params={params} onChange={setParams} />

            <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">{t.siteContext}</h3>
               <ImageUploader 
                label={t.aerialLabel}
                subLabel={t.aerialSub}
                images={context} 
                onImagesChange={setContext}
                language={params.language}
              />
            </div>

             <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">{t.styleRef}</h3>
               <ImageUploader 
                label={t.materialLabel} 
                subLabel={t.materialSub}
                images={references} 
                onImagesChange={setReferences}
                multiple 
                language={params.language}
              />
            </div>

          </div>

          {/* Right Column: Main Input & Output (Order-1 on Mobile, Order-2 on Desktop) */}
          <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">
            
            {/* Main Sketch Upload */}
            <div className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
               {/* Decorative Gradient */}
               <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition-colors duration-700"></div>

              <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-cyan-500 rounded-full"></div>
                   {t.mainGeo}
                </h2>
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20 uppercase tracking-wider">
                  {t.required}
                </span>
              </div>
              <ImageUploader 
                label={t.sketchLabel} 
                images={sketch} 
                onImagesChange={setSketch} 
                required
                language={params.language}
              />
              <p className="mt-4 text-sm text-zinc-500 font-mono">
                {t.sketchNote}
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col items-end sticky top-20 z-40 pointer-events-none">
                
                {/* Controls Container - Wrapper for Dragon and Button */}
                <div className="flex items-center pointer-events-auto">
                    
                    {/* The new Status/Progress Component - Left of Button */}
                    <DigitalDragon isActive={isProcessing} />

                    <button
                        onClick={() => handleGenerate()}
                        disabled={status !== 'idle' || sketch.length === 0}
                        className={`
                            flex items-center gap-4 px-10 py-5 rounded-2xl font-bold text-base uppercase tracking-widest transition-all transform hover:scale-[1.02] active:scale-[0.98] overflow-hidden relative group backdrop-blur-md border
                            ${status !== 'idle' || sketch.length === 0
                            ? 'bg-zinc-800/50 border-white/5 text-zinc-600 cursor-not-allowed' 
                            : 'bg-zinc-900 border-white/20 text-white hover:border-cyan-500/50 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]'}
                        `}
                    >
                        {/* Tech Background Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>

                        {status === 'analyzing' ? (
                            <>
                            <div className="w-5 h-5 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                            {t.analyzing}
                            </>
                        ) : status === 'generating' ? (
                            <>
                            <div className="w-5 h-5 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                            {t.generatingImage}
                            </>
                        ) : status === 'editing' ? (
                            <>
                            <div className="w-5 h-5 border-2 border-white/10 border-t-magenta-400 rounded-full animate-spin" />
                            {t.processingEdit}
                            </>
                        ) : (
                            <>
                            <Wand2 className="w-5 h-5" />
                            {t.generateBtn}
                            <ChevronRight className="w-4 h-4 text-cyan-500" />
                            </>
                        )}
                    </button>
                </div>

                <p className="text-[10px] text-zinc-600 mt-2 text-right font-mono tracking-wider w-full pr-2">
                  eden_d_photo製作
                </p>
            </div>

            {/* Results Area */}
            {/* 1. Original Generated Result */}
            {result && (
              <ResultCard
                result={result}
                title={t.imageResult}
                badge="Original"
                isEditing={editingTarget === 'original'}
                onEditStart={() => setEditingTarget('original')}
                onEditCancel={() => setEditingTarget(null)}
                onEditApply={handleApplyEdit}
                onZoom={() => openModal(result)}
                onDownload={() => handleDownloadImage(result)}
                language={params.language}
                status={status}
                filterConfig={{
                  label: t.masterFilterLabel,
                  styles: masterStyles,
                  onFilterClick: (style) => handleMasterStyleClick('original', style),
                  isDisabled: status !== 'idle'
                }}
              />
            )}

            {/* 2. Styled Result (Below Original) */}
            {styledResult && (
               <ResultCard
                result={styledResult}
                title={t.imageResult}
                badge="Master Filtered"
                isEditing={editingTarget === 'styled'}
                onEditStart={() => setEditingTarget('styled')}
                onEditCancel={() => setEditingTarget(null)}
                onEditApply={handleApplyEdit}
                onZoom={() => openModal(styledResult)}
                onDownload={() => handleDownloadImage(styledResult)}
                language={params.language}
                status={status}
                filterConfig={{
                  label: t.masterReFilterLabel,
                  styles: masterStyles,
                  onFilterClick: (style) => handleMasterStyleClick('styled', style),
                  isDisabled: status !== 'idle'
                }}
              />
            )}

            {/* History Section (No Changes) */}
            {/* Note: I'm keeping the original history section as is, just pushed down */}
            {(result || history.length > 0) && (
                <div className="mt-12 border-t border-white/5 pt-8">
                {/* ... existing history code ... */}
               <h3 className="text-base font-bold text-zinc-400 mb-6 flex items-center gap-2 uppercase tracking-widest">
                  <Clock className="w-5 h-5" />
                  {t.historyLabel}
               </h3>
               
               {history.length === 0 ? (
                  <div className="bg-white/5 border border-white/5 border-dashed rounded-xl p-8 text-center text-zinc-600">
                      <p className="text-sm font-mono">{t.historyEmpty}</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                     {history.map((item) => (
                        <div 
                           key={item.id} 
                           className="group relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-cyan-500/50 transition-all shadow-lg"
                           onClick={() => openModal(item)}
                        >
                           {item.imageData ? (
                               <img 
                                 src={`data:image/png;base64,${item.imageData}`} 
                                 alt="History" 
                                 className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                               />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                                   NO DATA
                               </div>
                           )}
                           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                               <p className="text-xs text-zinc-300 line-clamp-2 font-mono mb-2">{item.prompt}</p>
                               <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                                  <Maximize2 className="w-4 h-4" />
                                  {t.zoomIn}
                               </div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
            )}

          </div>
        </div>

        {/* Shopee Affiliate / Ad Section (RECOMMENDED ITEMS) - MOVED TO BOTTOM */}
        <div className="w-full mt-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 hover:border-orange-500/20 transition-all shadow-lg group">
                
                {/* Product Thumbnail */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/50 relative">
                    <img 
                        src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2662&auto=format&fit=crop" 
                        alt="Product" 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500"
                    />
                    <div className="absolute top-2 left-2 bg-[#ee4d2d] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">
                        HOT
                    </div>
                </div>

                {/* Product Info */}
                <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-[#ee4d2d] text-xs font-bold uppercase tracking-widest">
                        <ShoppingBag className="w-4 h-4" />
                        {t.adLabel}
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {t.adTitle}
                    </h4>
                    <p className="text-sm text-zinc-400 max-w-2xl mx-auto sm:mx-0">
                        {t.adDesc}
                    </p>
                </div>

                {/* Action Button */}
                <button 
                    onClick={handleVisitShop}
                    className="w-full sm:w-auto flex-shrink-0 bg-[#ee4d2d] hover:bg-[#d03e1e] text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_-4px_rgba(238,77,45,0.5)] active:scale-95 group-hover:shadow-[0_0_20px_-5px_rgba(238,77,45,0.6)]"
                >
                    {t.visitShop}
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;