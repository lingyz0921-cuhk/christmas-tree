import React, { useState, Suspense, useCallback } from 'react'; // 确保导入 useCallback
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import { TreeMode } from './types';

// Simple Error Boundary to catch 3D resource loading errors (like textures)
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error loading 3D scene:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can customize this fallback UI
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-[#D4AF37] font-serif p-8 text-center">
          <div>
            <h2 className="text-2xl mb-2">Something went wrong</h2>
            <p className="opacity-70">A resource failed to load (likely a missing image). Check the console for details.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number; detected: boolean }>({ x: 0.5, y: 0.5, detected: false });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  // 修正：将 toggleMode 包裹在 useCallback 中
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === TreeMode.FORMED ? TreeMode.CHAOS : TreeMode.FORMED));
  }, []);

  // 修正：将 handleHandPosition 包裹在 useCallback 中
  const handleHandPosition = useCallback((x: number, y: number, detected: boolean) => {
    setHandPosition({ x, y, detected });
  }, []);

  const handlePhotosUpload = (photos: string[]) => {
    setUploadedPhotos(photos);
  };

  return (
    // 最外层 div 占据整个视口，并设置为相对定位，以便其子元素的绝对定位
    <div className="w-full h-screen relative bg-gradient-to-b from-black via-[#001a0d] to-[#0a2f1e] overflow-hidden"> 
      <ErrorBoundary>
        {/* Canvas 绝对定位并填充整个父容器，确保它是主背景 */}
        <Canvas
          className="absolute inset-0 z-0" // !!! 关键修改：绝对定位，z-index 设为 0 确保在最底层 !!!
          dpr={[1, 2]}
          camera={{ position: [0, 4, 20], fov: 45 }}
          gl={{ antialias: false, stencil: false, alpha: false }}
          shadows
        >
          <Suspense fallback={null}>
            <Experience mode={mode} handPosition={handPosition} uploadedPhotos={uploadedPhotos} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      
      {/* Loader, UIOverlay, GestureController 等 UI 元素也需要合理定位，避免遮挡或挤压 Canvas */}
      <Loader 
        // 适当调整 Loader 的 z-index 和定位，确保它在 Canvas 上方
        containerStyles={{ background: '#000', position: 'absolute', inset: '0', zIndex: 10 }} // 添加定位和z-index
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ background: '#D4AF37', height: '10px' }}
        dataStyles={{ color: '#D4AF37', fontFamily: 'Cinzel' }}
      />
      
      <UIOverlay 
        mode={mode} 
        onToggle={toggleMode} 
        onPhotosUpload={handlePhotosUpload} 
        hasPhotos={uploadedPhotos.length > 0} 
        // 确保 UIOverlay 也绝对定位，不影响 Canvas 布局
        className="absolute inset-0 z-20" // 添加定位和z-index
      />
      
      {/* Gesture Control Module 已经有 fixed 定位，但我们也要检查它的 z-index，确保它在其他 UI 元素上方 */}
      <GestureController 
        currentMode={mode} 
        onModeChange={setMode} 
        onHandPosition={handleHandPosition} 
        // GestureController 的 div 已经有 fixed top-4 right-4 z-40，这应该足够了
      />
    </div>
  );
}
