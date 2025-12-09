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

  // App.tsx
// ...
return (
  <div className="w-full h-screen relative bg-gradient-to-b from-black via-[#001a0d] to-[#0a2f1e] overflow-hidden"> 
    <ErrorBoundary>
      {/* 直接让 Canvas 成为 ErrorBoundary 的唯一子元素，并使用 className="absolute inset-0 z-0" */}
      <Canvas
        className="absolute inset-0 z-0" // 确保 Canvas 绝对定位并填充整个父容器
        dpr={[1, 2]} // 可以尝试 [1, 1] 进一步优化性能
        camera={{ position: [0, 4, 20], fov: 45 }}
        gl={{ antialias: false, stencil: false, alpha: false }}
        shadows // 性能优化时考虑注释掉
        // 如果你想让 Canvas 强制占据更多空间，可以尝试添加 style={{ width: '100%', height: '100%' }}
        // 但 className="absolute inset-0" 应该已经实现了
      >
        <Suspense fallback={null}>
          <Experience mode={mode} handPosition={handPosition} uploadedPhotos={uploadedPhotos} />
        </Suspense>
      </Canvas>
    </ErrorBoundary>
    
    {/* Loader, UIOverlay, GestureController 保持在 Canvas 的兄弟位置，并使用绝对/固定定位 */}
    <Loader 
      containerStyles={{ background: '#000', position: 'absolute', inset: '0', zIndex: 10 }}
      innerStyles={{ width: '300px', height: '10px', background: '#333' }}
      barStyles={{ background: '#D4AF37', height: '10px' }}
      dataStyles={{ color: '#D4AF37', fontFamily: 'Cinzel' }}
    />
    
    <UIOverlay 
      mode={mode} 
      onToggle={toggleMode} 
      onPhotosUpload={handlePhotosUpload} 
      hasPhotos={uploadedPhotos.length > 0} 
      className="absolute inset-0 z-20 flex flex-col justify-between" // 添加 flex 布局和 justify-between
    />
    
    <GestureController 
      currentMode={mode} 
      onModeChange={setMode} 
      onHandPosition={handleHandPosition} 
    />
  </div>
);
