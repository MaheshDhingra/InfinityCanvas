"use client";

import InfiniteCanvas from './components/InfiniteCanvas';

export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <InfiniteCanvas />
    </div>
  );
}
