// src/components/GestureController.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types'; // 确保路径正确

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [handDetected, setHandDetected] = useState(false);
  
  // 使用 useRef 来持有 HandLandmarker 实例和 requestAnimationFrame ID
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null); // 已修正类型

  // 用于手势识别的帧计数器
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const CONFIDENCE_THRESHOLD = 5;

  // !!! 关键修正 !!!
  // modeRef 用于在 `predictWebcam` 等 useCallback 函数中访问 `currentMode` 的最新值
  const modeRef = useRef(currentMode);
  useEffect(() => {
    modeRef.current = currentMode;
  }, [currentMode]);

  // `predictWebcam` 函数：处理每一帧的视频数据并进行手势识别
  // 依赖项只包括稳定的 `onModeChange` 和 `onHandPosition`
  const predictWebcam = useCallback(async () => {
    // console.log("Inside predictWebcam function."); // 调试时可以开启

    const videoElement = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    const canvasElement = canvasRef.current;

    // 如果任何必要元素不可用，则继续请求下一帧，直到可用
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
        const drawingUtils = new DrawingUtils(canvasCtx);

        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
          drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 2 });
        }

        const landmarks = results.landmarks[0];
        let centerX = 0;
        let centerY = 0;
        for (const landmark of landmarks) {
          centerX += landmark.x;
          centerY += landmark.y;
        }
        centerX /= landmarks.length;
        centerY /= landmarks.length;

        if (onHandPosition) {
          onHandPosition(centerX, centerY, true);
        }

        // 手势识别逻辑
        const indexTip = landmarks[8];
        const indexPIP = landmarks[6];
        const middleTip = landmarks[12];
        const middlePIP = landmarks[10];

        const indexOpen = indexTip.y < indexPIP.y;
        const middleOpen = middleTip.y < middlePIP.y;

        if (indexOpen && middleOpen) {
          openFrames.current++;
          closedFrames.current = 0;

          // 通过 modeRef.current 访问最新的 currentMode
          if (openFrames.current > CONFIDENCE_THRESHOLD && modeRef.current === TreeMode.FORMED) {
            onModeChange(TreeMode.CHAOS);
            setGestureStatus("✨ CHAOS MODE ✨");
            console.log("Switching to CHAOS mode!");
            openFrames.current = 0;
          }
        } else {
          closedFrames.current++;
          openFrames.current = 0;

          // 通过 modeRef.current 访问最新的 currentMode
          if (closedFrames.current > CONFIDENCE_THRESHOLD && modeRef.current === TreeMode.CHAOS) {
            onModeChange(TreeMode.FORMED);
            setGestureStatus("🎄 FORMED MODE 🎄");
            console.log("Switching to FORMED mode!");
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
        
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      }
    } catch (error) {
      console.error("Prediction error:", error);
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }

    // 帧率限制：使用 setTimeout 替代直接的 requestAnimationFrame
    setTimeout(() => {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam); 
    }, 60); 
  }, [onModeChange, onHandPosition]); // 关键修正：移除 currentMode 依赖

// src/components/GestureController.tsx - startWebcam 函数

// `startWebcam` 函数：负责获取摄像头视频流并启动 MediaPipe 预测循环
  // 依赖项是 predictWebcam，这是正确的。
  const startWebcam = useCallback(async () => {
    console.log("Attempting to start webcam..."); 
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setGestureStatus("Webcam not supported by browser");
        console.log("Webcam not supported.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log("Webcam stream assigned to video element.");
        
        await videoRef.current.play(); 
        console.log("Video element play() called and awaited.");

        // !!! 关键修正：在添加事件监听器之前检查 readyState !!!
        if (videoRef.current.readyState >= 2) { // 2 = HAVE_CURRENT_DATA 或更高 (数据已加载足以播放)
          console.log("Video already loaded. Starting MediaPipe prediction directly.");
          predictWebcam(); // 直接启动预测
        } else {
          console.log("Video not yet loaded. Adding loadeddata event listener.");
          videoRef.current.addEventListener("loadeddata", () => {
            console.log("Webcam video loaded and playing. Starting MediaPipe prediction...");
            predictWebcam(); // 事件触发时启动预测
          }, { once: true });
        }
        
        setGestureStatus("Ready - Show your hand");
        console.log("Gesture status set to Ready.");
      } else {
        console.log("Video ref current is null, cannot start webcam.");
      }
    } catch (err: any) {
      console.error("Webcam error:", err);
      if (err.name === 'NotAllowedError') {
        setGestureStatus("Please allow camera access");
      } else {
        setGestureStatus(`Webcam error: ${err.message || err.name}`);
      }
    }
  }, [predictWebcam]); // 依赖项依然是 predictWebcam


  // `useEffect` 钩子：仅在组件首次挂载时初始化 MediaPipe 和摄像头
  useEffect(() => {
    const setup = async () => {
      // 仅当 handLandmarker 尚未初始化时才执行
      if (!handLandmarkerRef.current) { 
        try {
          console.log("Initializing MediaPipe HandLandmarker...");

          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
          );

          handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });

          console.log("MediaPipe HandLandmarker initialized successfully!");
          startWebcam(); // MediaPipe 初始化成功后才启动摄像头
          console.log("setup() finished, startWebcam called.");
        } catch (error) {
          console.error("Error initializing MediaPipe:", error);
          setGestureStatus("Hand detection unavailable due to MediaPipe error");
          handLandmarkerRef.current = null;
        }
      } else {
        console.log("MediaPipe HandLandmarker already initialized, skipping setup.");
      }
    };

    setup(); 

    // 清理函数：在组件卸载时释放所有资源
    return () => {
      console.log("Cleaning up GestureController...");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
        console.log("MediaPipe HandLandmarker closed.");
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        console.log("Webcam stream stopped.");
      }
    };
  }, [startWebcam]); // 依赖 startWebcam

  console.log("GestureController rendered 🟢");
  console.log("HandLandmarker status:", handLandmarkerRef.current);

  return (
    <div className="fixed top-4 right-4 z-[9999] w-80
      bg-black/70 border border-[#D4AF37] p-3 rounded-lg
      pointer-events-auto shadow-[0_0_20px_#D4AF37]">

      <div className="relative mb-3 bg-black rounded overflow-hidden">
        <video
          ref={videoRef}
          width={320}
          height={240}
          className="w-full aspect-video object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
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
