const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables from .env file

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env file!');
  process.exit(1); // Exit if no database URL
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Initialize database: create table if not exists
async function initializeDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lines (
        id SERIAL PRIMARY KEY,
        color VARCHAR(7) NOT NULL,
        "strokeWidth" INTEGER NOT NULL,
        points JSONB NOT NULL
      );
    `);
    console.log('Database table "lines" ensured to exist.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initializeDb();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname === '/api/socket' && req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
      return;
    }
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async ws => {
    console.log('Client connected to WebSocket');

    try {
      const result = await pool.query('SELECT color, "strokeWidth", points FROM lines ORDER BY id ASC');
      const existingLines = result.rows;
      ws.send(JSON.stringify({ type: 'initial_lines', data: existingLines }));
      console.log(`Sent ${existingLines.length} initial lines to new client.`);
    } catch (err) {
      console.error('Error fetching initial lines from DB:', err);
    }

    ws.on('message', async message => {
      const parsedMessage = JSON.parse(message.toString());
      if (parsedMessage.type === 'new_line') {
        const newLine = parsedMessage.data;
        try {
          await pool.query(
            'INSERT INTO lines (color, "strokeWidth", points) VALUES ($1, $2, $3)',
            [newLine.color, newLine.strokeWidth, JSON.stringify(newLine.points)]
          );
          console.log('New line saved to database.');
        } catch (err) {
          console.error('Error saving new line to DB:', err);
        }

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
    console.log(`Upgrade request for pathname: ${pathname}, Request type: ${request.constructor.name}`);

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
