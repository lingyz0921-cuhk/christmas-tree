import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision'; // 确保 DrawingUtils 在这里
import { TreeMode } from '../types'; // 确保你的 TreeMode 类型定义正确

// 定义一个 HandLandmarker 实例的全局引用，确保它只被初始化一次
// 或者在组件内部使用 useRef，这里我们选择 useRef
// let handLandmarkerGlobal: HandLandmarker | null = null; // 如果你想作为真正的单例

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ 
  onModeChange, 
  currentMode, 
  onHandPosition 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // 这个 canvas 仍然是隐藏的，可能用于调试
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [handDetected, setHandDetected] = useState(false);
  
  // 使用 useRef 来持有 HandLandmarker 实例和 requestAnimationFrame ID，
  // 确保它们在组件的整个生命周期中保持引用，并且不会在重新渲染时被重新创建。
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  // 用于手势识别的帧计数器
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const CONFIDENCE_THRESHOLD = 5; // 连续多少帧才能确认手势

  // predictWebcam 函数 - 处理每一帧的视频数据并进行手势识别
  // 使用 useCallback 确保此函数的引用在渲染之间是稳定的
const predictWebcam = useCallback(async () => {
  // console.log("Inside predictWebcam function."); // 调试时可以保留或移除

  const videoElement = videoRef.current;
  const landmarker = handLandmarkerRef.current;
  const canvasElement = canvasRef.current; // 获取 canvas 元素

  if (!videoElement || !landmarker || videoElement.readyState < 2 || !canvasElement) {
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
    return;
  }

  const canvasCtx = canvasElement.getContext("2d");
  if (!canvasCtx) {
    console.error("Could not get 2D context for canvas.");
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
    return;
  }

  // 调整 canvas 尺寸以匹配视频尺寸，确保绘制准确
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // 清除上一帧的绘制

  try {
    const results = await landmarker.detectForVideo(videoElement, Date.now());

    if (results.landmarks && results.landmarks.length > 0) {
      setHandDetected(true);
      const drawingUtils = new DrawingUtils(canvasCtx); // 初始化 DrawingUtils

      for (const landmarks of results.landmarks) {
        // 绘制连接线 (骨架)
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
        // 绘制关键点 (节点)
        drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 2 });
      }

      const landmarks = results.landmarks[0]; // 获取第一只手（如果有的话）的关键点
      // ... (计算 centerX, centerY 和 onHandPosition 逻辑不变) ...
      let centerX = 0;
      let centerY = 0;
      for (const landmark of landmarks) {
        centerX += landmark.x;
        centerY += landmark.y;
      }
      centerX /= landmarks.length;
      centerY /= landmarks.length;

      if (onHandPosition) {
        // MediaPipe 的坐标是归一化 (0-1) 的
        onHandPosition(centerX, centerY, true);
      }


      // !!! 手势识别逻辑保持不变 !!!
      const indexTip = landmarks[8];
      const indexPIP = landmarks[6];
      const middleTip = landmarks[12];
      const middlePIP = landmarks[10];

      const indexOpen = indexTip.y < indexPIP.y;
      const middleOpen = middleTip.y < middlePIP.y;

      if (indexOpen && middleOpen) {
        openFrames.current++;
        closedFrames.current = 0;

        if (openFrames.current > CONFIDENCE_THRESHOLD && currentMode === TreeMode.FORMED) {
          onModeChange(TreeMode.CHAOS);
          setGestureStatus("✨ CHAOS MODE ✨");
          console.log("Switching to CHAOS mode!"); // 新增日志
          openFrames.current = 0;
        }
      } else {
        closedFrames.current++;
        openFrames.current = 0;

        if (closedFrames.current > CONFIDENCE_THRESHOLD && currentMode === TreeMode.CHAOS) {
          onModeChange(TreeMode.FORMED);
          setGestureStatus("🎄 FORMED MODE 🎄");
          console.log("Switching to FORMED mode!"); // 新增日志
          closedFrames.current = 0;
        }
      }
    } else {
      setHandDetected(false);
      if (onHandPosition) {
        onHandPosition(0.5, 0.5, false);
      }
      setGestureStatus("No hand detected - Show your hand");
      openFrames.current = 0;
      closedFrames.current = 0;
      
      // 没有手时，清除 canvas 上的绘制
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
  } catch (error) {
    console.error("Prediction error:", error);
    // 发生错误时也清除 canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }

  setTimeout(() => { // <-- 新增：使用 setTimeout 限制帧率
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
  }, 60); // <-- 60ms 延迟，大约 16 FPS。可以根据卡顿情况调整此值（例如 80ms, 100ms）
}, [currentMode, onModeChange, onHandPosition]); // 依赖项 // 依赖项


  // startWebcam 函数 - 负责获取摄像头视频流并启动 MediaPipe 预测循环
  // 使用 useCallback 确保此函数的引用在渲染之间是稳定的
  const startWebcam = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setGestureStatus("Webcam not supported by browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" } // 捕获前置摄像头
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // !!! 关键修正 !!!
        // 显式调用 play() 来启动视频播放。
        // `await` 确保视频尝试播放后再继续。
        await videoRef.current.play(); 
        
        // !!! 关键修正 !!!
        // 只有当视频数据加载完成并准备好播放时，才开始 MediaPipe 的预测循环
        // 使用 { once: true } 确保事件监听器只触发一次，避免重复启动预测
        videoRef.current.addEventListener("loadeddata", () => {
          console.log("Webcam video loaded and playing. Starting MediaPipe prediction...");
          predictWebcam(); // 在这里启动预测循环
        }, { once: true });

        setGestureStatus("Ready - Show your hand");
      }
    } catch (err: any) {
      console.error("Webcam error:", err);
      if (err.name === 'NotAllowedError') {
        setGestureStatus("Please allow camera access");
      } else {
        setGestureStatus(`Webcam error: ${err.message || err.name}`);
      }
    }
  }, [predictWebcam]); // startWebcam 的依赖项是 predictWebcam


  // useEffect 钩子 - 仅在组件首次挂载时初始化 MediaPipe 和摄像头
  useEffect(() => {
    const setup = async () => {
      // 仅当 handLandmarker 尚未初始化时才执行
      if (!handLandmarkerRef.current) { 
        try {
          console.log("Initializing MediaPipe HandLandmarker...");

          // 使用官方提供的 WASM 路径
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
          );

          // 使用官方提供的模型路径 (托管在 storage.googleapis.com)
          handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU" // 尝试使用 GPU 加速，如果不支持则会自动回退
            },
            runningMode: "VIDEO", // 设置为 VIDEO 模式以处理视频流
            numHands: 1 // 检测一只手
          });

          console.log("MediaPipe HandLandmarker initialized successfully!");
          startWebcam(); // MediaPipe 初始化成功后才启动摄像头
        } catch (error) {
          console.error("Error initializing MediaPipe:", error);
          setGestureStatus("Hand detection unavailable due to MediaPipe error");
          handLandmarkerRef.current = null; // 初始化失败，重置引用
        }
      }
    };

    setup(); // 调用初始化函数

    // 清理函数：在组件卸载时释放所有资源
    return () => {
      console.log("Cleaning up GestureController...");
      // 取消任何待处理的 requestAnimationFrame
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      // 关闭 MediaPipe Landmarker 实例
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
        console.log("MediaPipe HandLandmarker closed.");
      }
      // 停止摄像头视频流
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        console.log("Webcam stream stopped.");
      }
    };
  }, [startWebcam]); // 依赖 startWebcam，因为它在 MediaPipe 初始化后被调用


  // JSX 渲染部分 (与你提供的基本一致)
console.log("GestureController rendered 🟢");
console.log("HandLandmarker status:", handLandmarkerRef.current);

  return (
  <div className="fixed top-4 right-4 z-[9999] w-80
    bg-black/70 border border-[#D4AF37] p-3 rounded-lg
    pointer-events-auto shadow-[0_0_20px_#D4AF37]">

      <div className="relative mb-3 bg-black rounded overflow-hidden">
        <video
          ref={videoRef}
          width={320} // 设置视频宽度
          height={240} // 设置视频高度
          className="w-full aspect-video object-cover"
          playsInline // 在 iOS 上自动播放
          muted // 静音视频
          autoPlay // 自动播放（但我们仍然需要手动调用 .play()）
        />
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" // 保持隐藏，除非你需要绘制调试信息
        />
        <div className={`absolute top-2 left-2 text-xs px-2 py-1 rounded font-bold ${handDetected ? 'bg-green-500/70' : 'bg-red-500/70'}`}>
          {handDetected ? '✓ 手已检测' : '✗ 未检测'}
        </div>
      </div>

      <div className="text-center text-[#D4AF37] font-serif text-sm">
        <p className="font-bold mb-1">{gestureStatus}</p>
        <div className="text-xs opacity-70 space-y-1">
          <p>张开手指 → CHAOS 🌪️</p>
          <p>握拳 → FORMED 🎄</p>
        </div>
      </div>
    </div>
  );
};