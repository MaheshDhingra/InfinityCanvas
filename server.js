const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { Pool } = require('pg');
require('dotenv').config();

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
      CREATE TABLE IF NOT EXISTS drawing_elements (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        color VARCHAR(7) NOT NULL,
        "strokeWidth" INTEGER NOT NULL,
        points JSONB, -- For lines
        x FLOAT,      -- For shapes
        y FLOAT,      -- For shapes
        width FLOAT,  -- For rectangles
        height FLOAT, -- For rectangles
        radius FLOAT  -- For circles
      );
    `);
    console.log('Database table "drawing_elements" ensured to exist.');
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
    // Next.js handles all requests, including the WebSocket path.
    // The 'upgrade' event on the server will be handled by ws directly.
    handle(req, res, parsedUrl);
  });

  // Pass the http server directly to WebSocketServer
  const wss = new WebSocketServer({ server });

  wss.on('connection', async ws => {
    console.log('Client connected to WebSocket');

    try {
      const result = await pool.query('SELECT type, color, "strokeWidth", points, x, y, width, height, radius FROM drawing_elements ORDER BY id ASC');
      const existingElements = result.rows.map(row => {
        if (row.type === 'line') {
          return { type: row.type, color: row.color, strokeWidth: row.strokeWidth, points: row.points };
        } else if (row.type === 'rectangle') {
          return { type: row.type, color: row.color, strokeWidth: row.strokeWidth, x: row.x, y: row.y, width: row.width, height: row.height };
        } else if (row.type === 'circle') {
          return { type: row.type, color: row.color, strokeWidth: row.strokeWidth, x: row.x, y: row.y, radius: row.radius };
        }
        return null;
      }).filter(Boolean); // Filter out any nulls if type is unknown
      ws.send(JSON.stringify({ type: 'initial_elements', data: existingElements }));
      console.log(`Sent ${existingElements.length} initial elements to new client.`);
    } catch (err) {
      console.error('Error fetching initial elements from DB:', err);
    }

    ws.on('message', async message => {
      const parsedMessage = JSON.parse(message.toString());
      if (parsedMessage.type === 'new_element') {
        const newElement = parsedMessage.data;
        try {
          if (newElement.type === 'line') {
            await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", points) VALUES ($1, $2, $3, $4)',
              [newElement.type, newElement.color, newElement.strokeWidth, JSON.stringify(newElement.points)]
            );
          } else if (newElement.type === 'rectangle') {
            await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", x, y, width, height) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [newElement.type, newElement.color, newElement.strokeWidth, newElement.x, newElement.y, newElement.width, newElement.height]
            );
          } else if (newElement.type === 'circle') {
            await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", x, y, radius) VALUES ($1, $2, $3, $4, $5, $6)',
              [newElement.type, newElement.color, newElement.strokeWidth, newElement.x, newElement.y, newElement.radius]
            );
          }
          console.log(`New ${newElement.type} saved to database.`);
        } catch (err) {
          console.error(`Error saving new ${newElement.type} to DB:`, err);
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

  // The 'upgrade' event is now handled internally by `new WebSocketServer({ server })`
  // No need for a manual server.on('upgrade', ...) block here.

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
