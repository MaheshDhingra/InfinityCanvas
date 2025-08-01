"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ToolPalette from './ToolPalette';

interface Point {
  x: number;
  y: number;
}

interface Line {
  type: 'line';
  points: Point[];
  color: string;
  strokeWidth: number;
}

interface Rectangle {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

interface Circle {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
  color: string;
  strokeWidth: number;
}

interface StraightLine {
  type: 'straight_line';
  start: Point;
  end: Point;
  color: string;
  strokeWidth: number;
}

type DrawingElement = Line | Rectangle | Circle | StraightLine;

const InfiniteCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [startPoint, setStartPoint] = useState<Point | null>(null); // For shapes
  const [currentColor, setCurrentColor] = useState('#000000'); // Default color
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2); // Default stroke width
  const [activeTool, setActiveTool] = useState('pen'); // 'pen', 'eraser', 'rectangle', 'circle', 'straight_line'
  const [undoStack, setUndoStack] = useState<DrawingElement[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingElement[][]>([]);
  const ws = useRef<WebSocket | null>(null);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (line.points.length > 0) {
      ctx.moveTo(line.points[0].x, line.points[0].y);
      line.points.forEach(point => ctx.lineTo(point.x, point.y));
    }
    ctx.stroke();
  }, []);

  const drawRectangle = useCallback((ctx: CanvasRenderingContext2D, rect: Rectangle) => {
    ctx.strokeStyle = rect.color;
    ctx.lineWidth = rect.strokeWidth;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }, []);

  const drawCircle = useCallback((ctx: CanvasRenderingContext2D, circle: Circle) => {
    ctx.strokeStyle = circle.color;
    ctx.lineWidth = circle.strokeWidth;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
    ctx.stroke();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    elements.forEach(element => {
      if (element.type === 'line') {
        drawLine(ctx, element);
      } else if (element.type === 'rectangle') {
        drawRectangle(ctx, element);
      } else if (element.type === 'circle') {
        drawCircle(ctx, element);
      }
    });

    if (currentElement) {
      if (currentElement.type === 'line') {
        drawLine(ctx, currentElement);
      } else if (currentElement.type === 'rectangle') {
        drawRectangle(ctx, currentElement);
      } else if (currentElement.type === 'circle') {
        drawCircle(ctx, currentElement);
      }
    }
    ctx.restore();
  }, [elements, currentElement, scale, offset, drawLine, drawRectangle, drawCircle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    redrawCanvas();

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        redrawCanvas();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [redrawCanvas]);

  useEffect(() => {
    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.hostname}:3000/api/socket`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === 'initial_elements') { // Changed from initial_lines
        setElements(message.data);
      } else if (message.type === 'new_element') { // Changed from new_line
        setElements(prevElements => [...prevElements, message.data]);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = error => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const moveAmount = 20; // Pixels to move per key press
      setOffset(prevOffset => {
        let newX = prevOffset.x;
        let newY = prevOffset.y;
        switch (e.key) {
          case 'w':
          case 'W':
            newY += moveAmount;
            break;
          case 's':
          case 'S':
            newY -= moveAmount;
            break;
          case 'a':
          case 'A':
            newX += moveAmount;
            break;
          case 'd':
          case 'D':
            newX -= moveAmount;
            break;
          default:
            return prevOffset; // No change if other key
        }
        return { x: newX, y: newY };
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setOffset]); // Added setOffset to dependency array

  useEffect(() => {
    const handleZoomKeyDown = (e: KeyboardEvent) => {
      const scaleAmount = 1.1;
      setScale(prevScale => {
        let newScale = prevScale;
        if (e.key === '+' || e.key === '=') { // Zoom in with '+' or '='
          newScale *= scaleAmount;
        } else if (e.key === '-' || e.key === '_') { // Zoom out with '-' or '_'
          newScale /= scaleAmount;
        }
        // Limit zoom
        return Math.max(0.1, Math.min(newScale, 10));
      });
    };

    window.addEventListener('keydown', handleZoomKeyDown);

    return () => {
      window.removeEventListener('keydown', handleZoomKeyDown);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const getTransformedPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / scale;
    const y = (clientY - rect.top - offset.y) / scale;
    return { x, y };
  }, [offset, scale]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Left click
      setIsDrawing(true);
      const point = getTransformedPoint(e.clientX, e.clientY);
      setStartPoint(point); // Set start point for shapes

      if (activeTool === 'pen' || activeTool === 'eraser') {
        setCurrentElement({ type: 'line', points: [point], color: activeTool === 'eraser' ? '#f0f0f0' : currentColor, strokeWidth: currentStrokeWidth });
      } else if (activeTool === 'rectangle') {
        setCurrentElement({ type: 'rectangle', x: point.x, y: point.y, width: 0, height: 0, color: currentColor, strokeWidth: currentStrokeWidth });
      } else if (activeTool === 'circle') {
        setCurrentElement({ type: 'circle', x: point.x, y: point.y, radius: 0, color: currentColor, strokeWidth: currentStrokeWidth });
      }
    } else if (e.button === 1) { // Middle click for panning
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [getTransformedPoint, currentColor, currentStrokeWidth, activeTool]);

  const drawOrPan = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isDrawing) return; // Removed !startPoint from here

    const currentPoint = getTransformedPoint(e.clientX, e.clientY);

    if (activeTool === 'pen' || activeTool === 'eraser') {
      if (currentElement && currentElement.type === 'line') {
        const updatedLine = { ...currentElement, points: [...currentElement.points, currentPoint] };
        setCurrentElement(updatedLine);
      }
    } else if (activeTool === 'rectangle' && startPoint) { // Added startPoint check here
      const width = currentPoint.x - startPoint.x;
      const height = currentPoint.y - startPoint.y;
      setCurrentElement({ type: 'rectangle', x: startPoint.x, y: startPoint.y, width, height, color: currentColor, strokeWidth: currentStrokeWidth });
    } else if (activeTool === 'circle' && startPoint) { // Added startPoint check here
      const dx = currentPoint.x - startPoint.x;
      const dy = currentPoint.y - startPoint.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      setCurrentElement({ type: 'circle', x: startPoint.x, y: startPoint.y, radius, color: currentColor, strokeWidth: currentStrokeWidth });
    } else if (activeTool === 'straight_line' && startPoint) { // Added startPoint check here
      if (currentElement && currentElement.type === 'straight_line') {
        setCurrentElement({ ...currentElement, end: currentPoint });
      }
    }
    redrawCanvas();
  }, [isDrawing, currentElement, getTransformedPoint, startPoint, activeTool, currentColor, currentStrokeWidth, redrawCanvas]);

    const currentPoint = getTransformedPoint(e.clientX, e.clientY);

    if (activeTool === 'pen' || activeTool === 'eraser') {
      if (currentElement && currentElement.type === 'line') {
        const updatedLine = { ...currentElement, points: [...currentElement.points, currentPoint] };
        setCurrentElement(updatedLine);
      }
    } else if (activeTool === 'rectangle') {
      const width = currentPoint.x - startPoint.x;
      const height = currentPoint.y - startPoint.y;
      setCurrentElement({ type: 'rectangle', x: startPoint.x, y: startPoint.y, width, height, color: currentColor, strokeWidth: currentStrokeWidth });
    } else if (activeTool === 'circle') {
      const dx = currentPoint.x - startPoint.x;
      const dy = currentPoint.y - startPoint.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      setCurrentElement({ type: 'circle', x: startPoint.x, y: startPoint.y, radius, color: currentColor, strokeWidth: currentStrokeWidth });
    } else if (activeTool === 'straight_line') {
      if (currentElement && currentElement.type === 'straight_line') {
        setCurrentElement({ ...currentElement, end: currentPoint });
      }
    }
    redrawCanvas();
  }, [isDrawing, currentElement, getTransformedPoint, startPoint, activeTool, currentColor, currentStrokeWidth, redrawCanvas]);

  const endDrawingOrPanning = useCallback(() => {
    if (isDrawing && currentElement) {
      setElements(prevElements => {
        const newElements = [...prevElements, currentElement];
        setUndoStack(prevStack => [...prevStack, prevElements]); // Save current state to undo stack
        setRedoStack([]); // Clear redo stack on new action
        return newElements;
      });
      ws.current?.send(JSON.stringify({ type: 'new_element', data: currentElement }));
    }
    setIsDrawing(false);
    setCurrentElement(null);
    setStartPoint(null);
  }, [isDrawing, currentElement]);

  const undo = useCallback(() => {
    if (undoStack.length > 0) {
      setElements(prevElements => {
        setRedoStack(prevStack => [...prevStack, prevElements]); // Save current state to redo stack
        const previousState = undoStack[undoStack.length - 1];
        setUndoStack(prevStack => prevStack.slice(0, -1)); // Remove last state from undo stack
        return previousState;
      });
    }
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length > 0) {
      setElements(prevElements => {
        setUndoStack(prevStack => [...prevStack, prevElements]); // Save current state to undo stack
        const nextState = redoStack[redoStack.length - 1];
        setRedoStack(prevStack => prevStack.slice(0, -1)); // Remove last state from redo stack
        return nextState;
      });
    }
  }, [redoStack]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const scaleAmount = 1.1;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const mouseCanvasX = mouseX - rect.left;
    const mouseCanvasY = mouseY - rect.top;

    const oldScale = scale;
    let newScale = scale;

    if (e.deltaY < 0) {
      newScale *= scaleAmount; // Zoom in
    } else {
      newScale /= scaleAmount; // Zoom out
    }

    // Limit zoom
    newScale = Math.max(0.1, Math.min(newScale, 10));

    const scaleRatio = newScale / oldScale;

    setOffset(prevOffset => ({
      x: mouseCanvasX - (mouseCanvasX - prevOffset.x) * scaleRatio,
      y: mouseCanvasY - (mouseCanvasY - prevOffset.y) * scaleRatio,
    }));
    setScale(newScale);
    redrawCanvas();
  }, [scale, redrawCanvas]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ToolPalette
        currentColor={currentColor}
        setCurrentColor={setCurrentColor}
        currentStrokeWidth={currentStrokeWidth}
        setCurrentStrokeWidth={setCurrentStrokeWidth}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        undo={undo}
        redo={redo}
      />
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={drawOrPan}
        onMouseUp={endDrawingOrPanning}
        onMouseLeave={endDrawingOrPanning}
        onWheel={handleWheel}
        style={{ display: 'block', background: '#f0f0f0', cursor: activeTool === 'pen' ? 'crosshair' : activeTool === 'eraser' ? 'cell' : 'grab' }}
      />
    </div>
  );
};

export default InfiniteCanvas;
