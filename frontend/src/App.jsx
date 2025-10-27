import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios'; 

const BrushIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.06 11.9 2 22l10.1-7.06a7.34 7.34 0 0 1 7.07-7.07l-2.12-2.12a2.12 2.12 0 0 0-3-3L2 11.9zM9.06 11.9 2 4.84 4.84 2Z"/></svg>
);

const EraserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z"/><path d="M22 21H7"/><path d="m5 12 5 5"/></svg>
);

const ResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>
);


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

  // --- Canvas Setup ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Set canvas size based on container, considering device pixel ratio
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
        // The scale is already applied, so we draw on the scaled coordinate system
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

  // --- Drawing Event Handlers ---
  const startDrawing = (event) => {
    const { offsetX, offsetY } = getCoords(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = (event) => {
    if (!isDrawing) return;
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

  // --- Render ---
  return (
    <div className="w-screen h-screen bg-gray-900 text-white flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Toolbar */}
      <aside className="w-full md:w-20 bg-gray-800 p-2 md:p-4 flex flex-row md:flex-col items-center justify-around md:justify-start gap-4 shadow-2xl z-10">
        <h1 className="hidden md:block text-lg font-bold text-cyan-400 mb-4">Tools</h1>
        
        {/* Tools */}
        <div className="flex md:flex-col gap-3">
            <button onClick={() => setTool(TOOL_MODES.BRUSH)} className={`p-3 rounded-lg transition-colors ${tool === TOOL_MODES.BRUSH ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Brush"><BrushIcon /></button>
            <button onClick={() => setTool(TOOL_MODES.ERASER)} className={`p-3 rounded-lg transition-colors ${tool === TOOL_MODES.ERASER ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Eraser"><EraserIcon /></button>
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
            <button onClick={() => clearCanvas()} className="p-3 bg-red-600 hover:bg-red-700 rounded-lg" title="Reset Canvas"><ResetIcon /></button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-6 gap-4 items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={finishDrawing}
          onMouseMove={draw}
          onMouseLeave={finishDrawing}
          onTouchStart={startDrawing}
          onTouchEnd={finishDrawing}
          onTouchMove={draw}
          className="bg-black rounded-lg shadow-2xl cursor-crosshair w-full h-3/4"
        />

        {/* Solution & Controls */}
        <div className="w-full flex flex-col md:flex-row gap-4 items-center">
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

