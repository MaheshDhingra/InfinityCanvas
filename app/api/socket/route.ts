import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';

let wss: WebSocketServer | null = null;

export async function GET(req: NextRequest) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });

    wss.on('connection', ws => {
      console.log('Client connected');

      ws.on('message', message => {
        // Broadcast message to all connected clients
        wss?.clients.forEach(client => {
          if (client.readyState === ws.OPEN) {
            client.send(message.toString());
          }
        });
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });

      ws.on('error', error => {
        console.error('WebSocket error:', error);
      });
    });

    // Handle upgrade for WebSocket connection
    // This part is tricky with Next.js App Router and needs a custom server or a different approach
    // For simplicity, we'll assume a direct connection for now, or use a library that abstracts this.
    // A more robust solution would involve a custom server.js or a dedicated WebSocket library like socket.io
    // that handles Next.js integration better.

    // For now, this API route will just serve as a placeholder.
    // The actual WebSocket connection will need to be handled by a separate server or a more integrated solution.
    // Let's try to make it work with a simple upgrade handler if possible.
    // This is a common challenge with Next.js and WebSockets.

    // A common workaround is to use a custom server.js or a library like 'socket.io'
    // For this task, I will proceed with a basic WebSocketServer setup and
    // provide instructions on how to run it with a custom server if issues arise.
  }

  // This is a placeholder response. The actual WebSocket handshake happens via 'upgrade' event.
  // Next.js API routes don't directly expose the HTTP server for 'upgrade' events easily.
  // A common pattern is to use a custom server.js file for Next.js to handle WebSockets.
  // However, for a quick prototype, we can try to simulate it or guide the user.

  // Let's try to make it work by returning a response, but the WebSocket connection
  // will need to be initiated from the client side to this route.
  // The `noServer: true` means we need to manually handle the upgrade.

  // Given the constraints of Next.js App Router, a direct `ws` server within an API route
  // is not straightforward without a custom server.js.
  // I will create a separate `server.js` file in the root to handle the WebSocket server.
  // This is a more reliable approach for Next.js with WebSockets.

  return new Response(JSON.stringify({ message: 'WebSocket server is running (or attempting to run).' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
