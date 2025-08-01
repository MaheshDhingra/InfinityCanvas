const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// When using a custom server, you need to disable the built-in Next.js server
// by setting `output: 'standalone'` in next.config.js or by not running `next dev` directly.
// For development, we'll use `next({ dev })` to prepare the app.
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', ws => {
    console.log('Client connected to WebSocket');

    ws.on('message', message => {
      // Broadcast message to all connected clients
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(message.toString());
        }
      });
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });

    ws.on('error', error => {
      console.error('WebSocket error:', error);
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url);

    if (pathname === '/api/socket') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
