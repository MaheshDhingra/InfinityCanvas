const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
let lines = [];

// Load existing lines from file
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    lines = JSON.parse(data);
    console.log(`Loaded ${lines.length} lines from ${DATA_FILE}`);
  }
} catch (error) {
  console.error('Error loading data file:', error);
}

// Function to save lines to file
const saveLines = () => {
  fs.writeFile(DATA_FILE, JSON.stringify(lines, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error saving data file:', err);
    } else {
      console.log('Lines saved to data.json');
    }
  });
};

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
    // Bypass Next.js handler for WebSocket upgrade requests
    if (parsedUrl.pathname === '/api/socket' && req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
      return; // Let the 'upgrade' event handler take over
    }
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', ws => {
    console.log('Client connected to WebSocket');

    // Send existing lines to the newly connected client
    ws.send(JSON.stringify({ type: 'initial_lines', data: lines }));

    ws.on('message', message => {
      const parsedMessage = JSON.parse(message.toString());
      if (parsedMessage.type === 'new_line') {
        lines.push(parsedMessage.data);
        saveLines(); // Save after adding new line
        // Broadcast new line to all other connected clients
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(message.toString());
          }
        });
      }
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
