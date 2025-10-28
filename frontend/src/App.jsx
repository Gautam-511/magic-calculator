import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
// NEW: Import MediaPipe
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// --- Icon Components ---

const BrushIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.06 11.9 2 22l10.1-7.06a7.34 7.34 0 0 1 7.07-7.07l-2.12-2.12a2.12 2.12 0 0 0-3-3L2 11.9zM9.06 11.9 2 4.84 4.84 2Z"/></svg>
);

const EraserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z"/><path d="M22 21H7"/><path d="m5 12 5 5"/></svg>
);

const ResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>
);

// NEW: Hand Icon
const HandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2.3a2 2 0 0 0 1.7-1Z"/></svg>
);


// --- Constants ---

const BrushSize = {
  SMALL: 2,
  MEDIUM: 5,
  LARGE: 10,
  XLARGE: 20,
};

const colors = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
];

const TOOL_MODES = {
  BRUSH: 'BRUSH',
  ERASER: 'ERASER'
};
const SMOOTHING_BUFFER_SIZE = 15; // Average the last 5 points
function App() {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#FFFFFF');
  const [brushSize, setBrushSize] = useState(BrushSize.MEDIUM);
  const [tool, setTool] = useState(TOOL_MODES.BRUSH);
  
  const [solution, setSolution] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // NEW: Refs and state for Air Drawing
  const videoRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const [isAirDrawing, setIsAirDrawing] = useState(false);
  const lastPinchStateRef = useRef(false);
  // ... with your other refs
  const drawHistoryRef = useRef([]);

  // --- Canvas Setup ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    const resizeCanvas = () => {
        const { width, height } = canvas.getBoundingClientRect();
        const scale = window.devicePixelRatio;
        canvas.width = width * scale;
        canvas.height = height * scale;
        context.scale(scale, scale);
        clearCanvas(true); // Redraw background on resize
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    contextRef.current = context;

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // --- Drawing Properties Effect ---
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineCap = 'round';
      contextRef.current.lineJoin = 'round';
      contextRef.current.globalCompositeOperation = 'source-over';
      
      if (tool === TOOL_MODES.ERASER) {
        contextRef.current.strokeStyle = '#000000'; // Eraser is just drawing with the background color
        contextRef.current.lineWidth = brushSize * 2; // Make eraser feel bigger
      } else {
        contextRef.current.strokeStyle = color;
        contextRef.current.lineWidth = brushSize;
      }
    }
  }, [color, brushSize, tool]);

  // --- Utility Functions ---
  const getCoords = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (event.touches) {
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top,
      };
    }
    return { offsetX: event.nativeEvent.offsetX, offsetY: event.nativeEvent.offsetY };
  };

  const clearCanvas = (keepState = false) => {
    const context = contextRef.current;
    if (context) {
        const { width, height } = context.canvas;
        const canvasWidth = width / window.devicePixelRatio;
        const canvasHeight = height / window.devicePixelRatio;
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    if (!keepState) {
      setSolution('');
      setError('');
    }
  };

  // --- Mouse/Touch Drawing Event Handlers ---
  const startDrawing = (event) => {
    if (isAirDrawing) return; // Don't allow mouse drawing if air drawing is on
    const { offsetX, offsetY } = getCoords(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (isAirDrawing || !isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = (event) => {
    if (!isDrawing || isAirDrawing) return;
    const { offsetX, offsetY } = getCoords(event);
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  // --- API Call ---
  const handleCalculate = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    
    setIsLoading(true);
    setSolution('');
    setError('');

    try {
      // Use axios to send the request to port 5000
      const response = await axios.post('http://localhost:5000/solve', {
        image: dataUrl,
      });
      
      setSolution(response.data.solution);

    } catch (err) {
      console.error("Failed to get solution:", err);
      setError('Could not get a solution. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  // --- NEW: MediaPipe Hand Tracking Setup ---
  useEffect(() => {
    let animationFrameId;

    const setupHandTracking = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', startDetectionLoop);
        }

      } catch (err) {
        console.error("Error setting up MediaPipe:", err);
        setError("Could not start webcam or hand tracking.");
      }
    };

    const startDetectionLoop = () => {
      if (handLandmarkerRef.current && videoRef.current && videoRef.current.readyState >= 3) {
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
        processHandData(results);
        animationFrameId = requestAnimationFrame(startDetectionLoop);
      } else if (handLandmarkerRef.current) {
        // If video isn't ready, try again
        animationFrameId = requestAnimationFrame(startDetectionLoop);
      }
    };

    if (isAirDrawing) {
      setupHandTracking();
    } else {
      // Cleanup
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current = null;
      }
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isAirDrawing]);


  // --- NEW: Air Drawing Logic ---
const processHandData = (results) => {
    // --- 1. Get Landmarks and Gesture ---
    if (!results.landmarks || results.landmarks.length === 0) {
      if (lastPinchStateRef.current) {
        // Finish drawing
        contextRef.current.closePath();
        lastPinchStateRef.current = false;
        setIsDrawing(false);
      }
      // Clear history when no hand is detected
      drawHistoryRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const landmarks = results.landmarks[0];
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];

    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const pinchThreshold = 0.05;
    const isPinching = distance < pinchThreshold;

    // --- 2. Calculate Smoothed Point ---
    const canvasRect = canvas.getBoundingClientRect();
    const rawX = (1.0 - indexTip.x) * canvasRect.width;
    const rawY = indexTip.y * canvasRect.height;
    
    let smoothedX = rawX;
    let smoothedY = rawY;

    if (isPinching) {
      // Add the new point to our history
      drawHistoryRef.current.push({ x: rawX, y: rawY });

      // If the history is too long, remove the oldest point
      if (drawHistoryRef.current.length > SMOOTHING_BUFFER_SIZE) {
        drawHistoryRef.current.shift(); // remove first element
      }
      
      // Calculate the average of all points in the history
      let totalX = 0;
      let totalY = 0;
      for (const point of drawHistoryRef.current) {
        totalX += point.x;
        totalY += point.y;
      }
      smoothedX = totalX / drawHistoryRef.current.length;
      smoothedY = totalY / drawHistoryRef.current.length;
    }

    // --- 3. Draw on Canvas ---
    const context = contextRef.current;

    if (isPinching) {
      if (!lastPinchStateRef.current) {
        // START drawing
        // We just started pinching, so the history is new.
        // Move to the *first* available smoothed point.
        context.beginPath();
        context.moveTo(smoothedX, smoothedY);
        lastPinchStateRef.current = true;
        setIsDrawing(true);
      } else {
        // CONTINUE drawing
        // Use the new smoothed average point
        context.lineTo(smoothedX, smoothedY);
        context.stroke();
      }
    } else {
      if (lastPinchStateRef.current) {
        // FINISH drawing
        context.closePath();
        lastPinchStateRef.current = false;
        setIsDrawing(false);
      }
      // IMPORTANT: Clear the history so the line doesn't jump
      // when you start pinching again in a new location.
      drawHistoryRef.current = [];
    }
  };


  // --- Render ---
  return (
    <div className="w-screen h-screen bg-gray-900 text-white flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Toolbar */}
      <aside className="w-full md:w-20 bg-gray-800 p-2 md:p-4 flex flex-row md:flex-col items-center justify-around md:justify-start gap-4 shadow-2xl z-30"> {/* Set z-20 */}
        <h1 className="hidden md:block text-lg font-bold text-cyan-400 mb-4">Tools</h1>
        
        {/* Tools */}
        <div className="flex md:flex-col gap-3">
            <button onClick={() => setTool(TOOL_MODES.BRUSH)} className={`p-3 rounded-lg transition-colors ${tool === TOOL_MODES.BRUSH ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Brush"><BrushIcon /></button>
            <button onClick={() => setTool(TOOL_MODES.ERASER)} className={`p-3 rounded-lg transition-colors ${tool === TOOL_MODES.ERASER ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Eraser"><EraserIcon /></button>
            
            {/* --- NEW AIR-DRAW TOGGLE --- */}
            <button 
              onClick={() => setIsAirDrawing(prev => !prev)} 
              className={`p-3 rounded-lg transition-colors ${isAirDrawing ? 'bg-green-500' : 'bg-gray-700 hover:bg-gray-600'}`} 
              title="Air Drawing"
            >
              <HandIcon />
            </button>
        </div>

        <div className="w-px md:w-full h-full md:h-px bg-gray-600 my-4"></div>

        {/* Colors */}
        <div className="flex md:flex-col gap-3">
          {colors.map((c) => (
            <button key={c.name} title={c.name} onClick={() => { setColor(c.value); setTool(TOOL_MODES.BRUSH); }}
              className={`w-8 h-8 rounded-full transition-transform duration-150 border-2 border-gray-800 ${color === c.value && tool === TOOL_MODES.BRUSH ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-white' : ''}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        
        <div className="w-px md:w-full h-full md:h-px bg-gray-600 my-4"></div>
        
        {/* Actions */}
        <div className="flex md:flex-col gap-3">
            <button onClick={() => clearCanvas(false)} className="p-3 bg-red-600 hover:bg-red-700 rounded-lg" title="Reset Canvas"><ResetIcon /></button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-6 gap-4 items-center justify-center relative"> {/* Added 'relative' */}
        
        {/* --- NEW VIDEO ELEMENT --- */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`absolute top-0 left-0 w-full h-full object-cover rounded-lg transition-opacity duration-300 ${isAirDrawing ? 'opacity-50 z-20' : 'opacity-0 pointer-events-none'}`}
          style={{ transform: 'scaleX(-1)' }} // Mirror the video
        />
        
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={finishDrawing}
          onMouseMove={draw}
          onMouseLeave={finishDrawing}
          onTouchStart={startDrawing}
          onTouchEnd={finishDrawing}
          onTouchMove={draw}
          className={`relative rounded-lg shadow-2xl cursor-crosshair w-full h-3/4 ${isAirDrawing ? 'bg-black z-10' : 'bg-black'}`}// Made canvas transparent when air-drawing
        />

        {/* Solution & Controls */}
        <div className="w-full flex flex-col md:flex-row gap-4 items-center z-10"> {/* Added 'z-10' */}
            {/* Solution Area */}
            <div className="w-full md:flex-1 p-4 bg-gray-800 rounded-lg shadow-lg min-h-[80px] flex items-center justify-center">
                {isLoading && <p className="text-lg text-cyan-400 animate-pulse">Analyzing your drawing...</p>}
                {error && <p className="text-lg text-red-500">{error}</p>}
                {solution && <p className="text-2xl font-bold text-green-400">{solution}</p>}
                {!isLoading && !error && !solution && <p className="text-gray-400">Your solution will appear here.</p>}
            </div>
            
            {/* Brush Sizes */}
            <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg shadow-lg">
                {Object.entries(BrushSize).map(([name, size]) => (
                    <button key={name} title={`${name.charAt(0) + name.slice(1).toLowerCase()} Brush`} onClick={() => setBrushSize(size)}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${brushSize === size ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    <div className="bg-white rounded-full" style={{width: `${size+2}px`, height: `${size+2}px`}}></div>
                    </button>
                ))}
            </div>

            {/* Solve Button */}
            <button onClick={handleCalculate} disabled={isLoading}
              className="w-full md:w-auto px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed shadow-lg">
              {isLoading ? 'Thinking...' : 'Solve'}
            </button>
        </div>

      </main>
    </div>
  );
}

export default App;