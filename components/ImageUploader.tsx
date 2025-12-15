
import React, { useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { UploadedImage, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface ImageUploaderProps {
  label: string;
  subLabel?: string;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  multiple?: boolean;
  required?: boolean;
  language: Language;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  subLabel,
  images,
  onImagesChange,
  multiple = false,
  required = false,
  language
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[language];

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files) as File[];
      
      const newImagesPromises = files.map(file => {
        return new Promise<UploadedImage>((resolve) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            resolve({
              file,
              previewUrl: url,
              id: Math.random().toString(36).substring(2, 11),
              width: img.width,
              height: img.height
            });
          };
          img.onerror = () => {
             resolve({
              file,
              previewUrl: url,
              id: Math.random().toString(36).substring(2, 11),
              width: 0,
              height: 0
            });
          };
          img.src = url;
        });
      });

      const newImages = await Promise.all(newImagesPromises);

      if (multiple) {
        onImagesChange([...images, ...newImages]);
      } else {
        // If single mode, replace existing
        onImagesChange(newImages);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (idToRemove: string) => {
    onImagesChange(images.filter((img) => img.id !== idToRemove));
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          {label} {required && <span className="text-cyan-500">*</span>}
        </label>
        {subLabel && <span className="text-xs text-zinc-600 font-medium">{subLabel}</span>}
      </div>

      <div 
        onClick={handleClick}
        className={`
          relative border border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer group
          ${images.length > 0 && !multiple 
            ? 'border-cyan-500/30 bg-cyan-900/10' 
            : 'border-white/10 hover:border-white/30 hover:bg-white/5 bg-black/20'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleFileSelect}
        />

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-zinc-900/50 rounded-lg mb-4 border border-white/5 group-hover:border-white/20 transition-all">
              <Upload className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300" />
            </div>
            <p className="text-sm text-zinc-400">
              <span className="font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors">{t.uploadClick}</span>
            </p>
            <p className="text-xs text-zinc-600 mt-2">{t.uploadNote}</p>
          </div>
        ) : (
           multiple ? (
             <div className="grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                <div 
                  className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg p-6 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={handleClick}
                >
                    <Upload className="w-5 h-5 text-zinc-500 mb-2" />
                    <span className="text-xs text-zinc-500">{t.addMore}</span>
                </div>
                {images.map((img) => (
                  <div key={img.id} className="relative group/img aspect-square rounded-lg overflow-hidden bg-black border border-white/10">
                    <img src={img.previewUrl} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover/img:opacity-100 transition-opacity" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      className="absolute top-1 right-1 p-1.5 bg-black/80 hover:bg-rose-500/80 rounded text-white opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
             </div>
           ) : (
             <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border border-white/10" onClick={(e) => e.stopPropagation()}>
                <img src={images[0].previewUrl} alt="Preview" className="w-full h-full object-contain" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(images[0].id);
                  }}
                  className="absolute top-3 right-3 p-2 bg-black/80 hover:bg-rose-500/80 rounded-lg text-white transition-colors backdrop-blur-sm"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/80 backdrop-blur-sm rounded text-xs text-zinc-300 font-mono border border-white/10">
                    {images[0].file.name}
                </div>
             </div>
           )
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
