"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Line {
  points: Point[];
  color: string;
  strokeWidth: number;
}

const InfiniteCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const ws = useRef<WebSocket | null>(null);

  const draw = useCallback((ctx: CanvasRenderingContext2D, line: Line) => {
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

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    lines.forEach(line => draw(ctx, line));
    if (currentLine) {
      draw(ctx, currentLine);
    }
    ctx.restore();
  }, [lines, currentLine, scale, offset, draw]);

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
    ws.current = new WebSocket(`ws://${window.location.hostname}:3000/api/socket`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = event => {
      const receivedLine: Line = JSON.parse(event.data);
      setLines(prevLines => [...prevLines, receivedLine]);
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

  const getTransformedPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / scale;
    const y = (clientY - rect.top - offset.y) / scale;
    return { x, y };
  }, [offset, scale]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Left click for drawing
      setIsDrawing(true);
      const point = getTransformedPoint(e.clientX, e.clientY);
      setCurrentLine({ points: [point], color: 'black', strokeWidth: 2 });
    } else if (e.button === 1) { // Middle click for panning
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [getTransformedPoint]);

  const drawOrPan = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    if (isDrawing && currentLine) {
      const point = getTransformedPoint(e.clientX, e.clientY);
      const updatedLine = { ...currentLine, points: [...currentLine.points, point] };
      setCurrentLine(updatedLine);
      redrawCanvas();
    } else if (e.buttons === 4) { // Middle mouse button is pressed (for panning)
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setOffset(prevOffset => ({ x: prevOffset.x + dx, y: prevOffset.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      redrawCanvas();
    }
  }, [isDrawing, currentLine, getTransformedPoint, lastMousePos, redrawCanvas]);

  const endDrawingOrPanning = useCallback(() => {
    if (isDrawing && currentLine) {
      setLines(prevLines => [...prevLines, currentLine]);
      ws.current?.send(JSON.stringify(currentLine));
    }
    setIsDrawing(false);
    setCurrentLine(null);
  }, [isDrawing, currentLine]);

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
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={drawOrPan}
      onMouseUp={endDrawingOrPanning}
      onMouseLeave={endDrawingOrPanning}
      onWheel={handleWheel}
      style={{ display: 'block', background: '#f0f0f0', cursor: isDrawing ? 'crosshair' : 'grab' }}
    />
  );
};

export default InfiniteCanvas;
