"use client";

import React from 'react';

interface ToolPaletteProps {
  currentColor: string;
  setCurrentColor: (color: string) => void;
  currentStrokeWidth: number;
  setCurrentStrokeWidth: (width: number) => void;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  undo: () => void;
  redo: () => void;
}

const ToolPalette: React.FC<ToolPaletteProps> = ({
  currentColor,
  setCurrentColor,
  currentStrokeWidth,
  setCurrentStrokeWidth,
  activeTool,
  setActiveTool,
  undo,
  redo,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'white',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label htmlFor="colorPicker" style={{ color: '#000000' }}>Color:</label>
        <input
          type="color"
          id="colorPicker"
          value={currentColor}
          onChange={(e) => setCurrentColor(e.target.value)}
          style={{ width: '40px', height: '25px', border: 'none', padding: 0 }}
        />
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label htmlFor="strokeWidth" style={{ color: '#000000' }}>Stroke:</label>
        <input
          type="range"
          id="strokeWidth"
          min="1"
          max="20"
          value={currentStrokeWidth}
          onChange={(e) => setCurrentStrokeWidth(parseInt(e.target.value))}
          style={{ width: '100px' }}
        />
        <span style={{ color: '#000000' }}>{currentStrokeWidth}px</span>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={() => setActiveTool('pen')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'pen' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Pen
        </button>
        <button
          onClick={() => setActiveTool('straight_line')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'straight_line' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Line
        </button>
        <button
          onClick={() => setActiveTool('arrow')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'arrow' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Arrow
        </button>
        <button
          onClick={() => setActiveTool('eraser')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'eraser' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Eraser
        </button>
        <button
          onClick={() => setActiveTool('rectangle')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'rectangle' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Rectangle
        </button>
        <button
          onClick={() => setActiveTool('circle')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'circle' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Circle
        </button>
        <button
          onClick={() => setActiveTool('diamond')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: activeTool === 'diamond' ? '#e0e0e0' : 'white',
            cursor: 'pointer',
          }}
        >
          Diamond
        </button>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={undo}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          Undo
        </button>
        <button
          onClick={redo}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          Redo
        </button>
      </div>
    </div>
  );
};

export default ToolPalette;
