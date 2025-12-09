import React, { useRef, useEffect } from 'react';
import { TreeMode } from '../types';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  onPhotosUpload: (photos: string[]) => void;
  hasPhotos: boolean;
  className?: string;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onToggle, onPhotosUpload, hasPhotos, className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{
    console.log("%c UIOverlay mounted 🎄", "color:#D4AF37;font-size:18px");
  },[]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Promise.all(
      [...files].map(file => new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target?.result as string);
        reader.readAsDataURL(file);
      }))
    ).then(onPhotosUpload);
  };

  return (
    <div className={`pointer-events-none absolute inset-0 flex flex-col justify-between p-8 z-30 ${className || ""}`}>

      {/* 顶部标题 */}
      <header className="text-center mt-6">
        <h1 className="text-5xl md:text-7xl font-bold 
          text-transparent bg-clip-text 
          bg-gradient-to-r from-[#D4AF37] via-[#fff6bf] to-[#D4AF37]
          drop-shadow-[0_0_25px_gold] tracking-widest select-none">
          Merry Christmas 🎄
        </h1>

        {!hasPhotos && (
          <div className="mt-6 pointer-events-auto">
            <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 border border-[#D4AF37] rounded-md
                bg-black/40 text-[#D4AF37]
                hover:bg-[#D4AF37]/30 hover:text-white
                shadow-[0_0_20px_#D4AF37] transition pointer-events-auto"
            >
              上传照片 📷
            </button>
          </div>
        )}
      </header>

      {/* 底部模式指示 */}
      <div className="text-center mb-10 text-3xl font-serif font-bold pointer-events-none">
        {mode === TreeMode.CHAOS ? (
          <p className="text-[#FFD86B] drop-shadow-[0_0_15px_gold] animate-pulse">✨ Chaos Mode ✨</p>
        ) : (
          <p className="text-[#C8FFD4] drop-shadow-[0_0_15px_white]">🎄 Formed Mode 🎄</p>
        )}
      </div>
    </div>
  );
};
