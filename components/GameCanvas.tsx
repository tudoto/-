import React, { useRef, useEffect, useState } from 'react';
import { DrawPath, DrawPoint } from '../types';
import { Trash2, Eraser, Pen } from 'lucide-react';
import { COLORS } from '../constants';

interface GameCanvasProps {
  paths: DrawPath[];
  isDrawer: boolean;
  onDraw: (path: DrawPath) => void;
  onClear: () => void;
  width?: number;
  height?: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  paths, 
  isDrawer, 
  onDraw, 
  onClear,
  width = 800,
  height = 600
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawPoint[]>([]);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [scale, setScale] = useState(1);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width: containerWidth } = containerRef.current.getBoundingClientRect();
        setScale(Math.min(1, containerWidth / width));
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [width]);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, width, height);

    // Draw saved paths
    paths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });

    // Draw current path being drawn
    if (currentPath.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = lineWidth;
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
    }

  }, [paths, currentPath, width, height, currentColor, lineWidth]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const coords = getCoords(e);
    setCurrentPath([coords]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    e.preventDefault();
    const coords = getCoords(e);
    
    // Throttle adding points slightly if needed, but for now raw is fine
    setCurrentPath(prev => [...prev, coords]);
  };

  const stopDrawing = () => {
    if (!isDrawing || !isDrawer) return;
    setIsDrawing(false);
    
    if (currentPath.length > 0) {
      onDraw({
        points: currentPath,
        color: currentColor,
        width: lineWidth
      });
    }
    setCurrentPath([]);
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto" ref={containerRef}>
      <div 
        className="relative bg-white rounded-lg shadow-lg overflow-hidden cursor-crosshair border-4 border-slate-200"
        style={{ height: height * scale, width: width * scale }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="origin-top-left canvas-bg"
          style={{ transform: `scale(${scale})` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {!isDrawer && (
          <div className="absolute top-2 right-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-bold pointer-events-none">
            👀 观看模式
          </div>
        )}
      </div>

      {isDrawer && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => {
                  setCurrentColor(c);
                  setLineWidth(c === '#ffffff' ? 20 : 3);
                }}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${currentColor === c ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`}
                style={{ backgroundColor: c === '#ffffff' ? '#f3f4f6' : c }}
                title={c === '#ffffff' ? 'Eraser' : c}
              >
                {c === '#ffffff' && <Eraser className="w-4 h-4 mx-auto text-slate-400" />}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setLineWidth(3)} className={`p-2 rounded ${lineWidth === 3 && currentColor !== '#ffffff' ? 'bg-white shadow' : ''}`}>
                  <div className="w-1 h-1 bg-black rounded-full" />
                </button>
                <button onClick={() => setLineWidth(6)} className={`p-2 rounded ${lineWidth === 6 && currentColor !== '#ffffff' ? 'bg-white shadow' : ''}`}>
                  <div className="w-2 h-2 bg-black rounded-full" />
                </button>
                <button onClick={() => setLineWidth(12)} className={`p-2 rounded ${lineWidth === 12 && currentColor !== '#ffffff' ? 'bg-white shadow' : ''}`}>
                  <div className="w-3 h-3 bg-black rounded-full" />
                </button>
             </div>
             
             <div className="w-px h-8 bg-slate-200"></div>

             <button 
               onClick={onClear}
               className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
               title="Clear Canvas"
             >
               <Trash2 size={20} />
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
