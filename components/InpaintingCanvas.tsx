
import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Paintbrush, RotateCcw, Undo2, Redo2 } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface InpaintingCanvasProps {
  baseImage: string; // Base64 string of the image
  onMaskReady: (maskBase64: string) => void;
  language: Language;
}

const InpaintingCanvas: React.FC<InpaintingCanvasProps> = ({ baseImage, onMaskReady, language }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  
  // History State
  const [historyStep, setHistoryStep] = useState(0);
  const historyRef = useRef<ImageData[]>([]);

  const t = TRANSLATIONS[language];
  
  // Set up canvas size and context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Load base image to set aspect ratio
    const img = new Image();
    img.src = `data:image/png;base64,${baseImage}`;
    img.onload = () => {
       canvas.width = img.width;
       canvas.height = img.height;
       
       const ctx = canvas.getContext('2d');
       if(ctx) {
           ctx.clearRect(0, 0, canvas.width, canvas.height);
           // Save initial blank state
           const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
           historyRef.current = [initialData];
           setHistoryStep(0);
       }
    };

  }, [baseImage]);

  // Export mask based on current canvas state
  const exportMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext('2d');
    
    if (ctx) {
      // Fill background black
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(canvas, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 20) { 
           data[i] = 255;     // R
           data[i + 1] = 255; // G
           data[i + 2] = 255; // B
        }
      }
      ctx.putImageData(imageData, 0, 0);
      
      // Export
      const base64 = offscreen.toDataURL('image/png').split(',')[1];
      onMaskReady(base64);
    }
  };

  const saveHistoryState = () => {
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext('2d');
     if (!canvas || !ctx) return;

     const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
     
     // Truncate history if we are in the middle
     const newHistory = historyRef.current.slice(0, historyStep + 1);
     newHistory.push(currentData);
     
     historyRef.current = newHistory;
     setHistoryStep(newHistory.length - 1);
     
     exportMask();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
       e.preventDefault(); // Prevent scrolling on touch
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }

    // Map screen coordinates to canvas scale
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineWidth = brushSize * (canvas.width / rect.width); 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw with cyan for high visibility on dark theme
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)'; 
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Reset beginPath on start
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if(ctx) ctx.beginPath();
    startDrawing(e);
  };
  
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if(ctx) ctx.beginPath();
    startDrawing(e);
  }

  const handleUndo = () => {
     if (historyStep > 0) {
         const newStep = historyStep - 1;
         const canvas = canvasRef.current;
         const ctx = canvas?.getContext('2d');
         if (canvas && ctx) {
             ctx.putImageData(historyRef.current[newStep], 0, 0);
             setHistoryStep(newStep);
             exportMask();
         }
     }
  };

  const handleRedo = () => {
     if (historyStep < historyRef.current.length - 1) {
         const newStep = historyStep + 1;
         const canvas = canvasRef.current;
         const ctx = canvas?.getContext('2d');
         if (canvas && ctx) {
             ctx.putImageData(historyRef.current[newStep], 0, 0);
             setHistoryStep(newStep);
             exportMask();
         }
     }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveHistoryState();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div 
        ref={containerRef} 
        className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black shadow-inner"
        style={{ touchAction: 'none' }}
      >
        {/* Background Image */}
        <img 
          src={`data:image/png;base64,${baseImage}`} 
          alt="Base" 
          className="w-full h-auto block select-none pointer-events-none opacity-80" 
        />
        
        {/* Drawing Layer */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/80 p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3">
             <Paintbrush className="w-4 h-4 text-cyan-400" />
             <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">{t.brushSize}</span>
             <input 
               type="range" 
               min="5" 
               max="100" 
               value={brushSize} 
               onChange={(e) => setBrushSize(parseInt(e.target.value))}
               className="w-32 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
             />
           </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button
                onClick={handleUndo}
                disabled={historyStep <= 0}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={t.undo || "Undo"}
            >
                <Undo2 className="w-4 h-4" />
            </button>
            <button
                onClick={handleRedo}
                disabled={historyStep >= historyRef.current.length - 1}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={t.redo || "Redo"}
            >
                <Redo2 className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            <button 
                onClick={clearCanvas}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors border border-transparent hover:border-rose-900 font-medium"
            >
                <RotateCcw className="w-3 h-3" />
                {t.clearMask}
            </button>
        </div>
      </div>
    </div>
  );
};

export default InpaintingCanvas;
