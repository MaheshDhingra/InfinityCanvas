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
    // Drop table if it exists to ensure schema updates are applied in development
    // WARNING: This will delete all existing data in the drawing_elements table.
    // Do not use in production without a proper migration strategy.
    await pool.query(`DROP TABLE IF EXISTS drawing_elements;`);
    console.log('Existing "drawing_elements" table dropped (if it existed).');

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
        radius FLOAT,  -- For circles
        start_x FLOAT,     -- For straight_lines
        start_y FLOAT,     -- For straight_lines
        end_x FLOAT,       -- For straight_lines
        end_y FLOAT        -- For straight_lines
      );
    `);
    console.log('Database table "drawing_elements" ensured to exist with updated schema.');
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
      const result = await pool.query('SELECT id, type, color, "strokeWidth", points, x, y, width, height, radius, start_x, start_y, end_x, end_y FROM drawing_elements ORDER BY id ASC');
      const existingElements = result.rows.map(row => {
        const baseElement = { id: row.id, type: row.type, color: row.color, strokeWidth: row.strokeWidth };
        if (row.type === 'line') {
          return { ...baseElement, points: row.points };
        } else if (row.type === 'rectangle') {
          return { ...baseElement, x: row.x, y: row.y, width: row.width, height: row.height };
        } else if (row.type === 'circle') {
          return { ...baseElement, x: row.x, y: row.y, radius: row.radius };
        } else if (row.type === 'straight_line') {
          return { ...baseElement, start: { x: row.start_x, y: row.start_y }, end: { x: row.end_x, y: row.end_y } };
        } else if (row.type === 'diamond') {
          return { ...baseElement, x: row.x, y: row.y, width: row.width, height: row.height };
        }
        return null;
      }).filter(Boolean);
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
          let result;
          if (newElement.type === 'line') {
            result = await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", points) VALUES ($1, $2, $3, $4) RETURNING id',
              [newElement.type, newElement.color, newElement.strokeWidth, JSON.stringify(newElement.points)]
            );
          } else if (newElement.type === 'rectangle') {
            result = await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", x, y, width, height) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
              [newElement.type, newElement.color, newElement.strokeWidth, newElement.x, newElement.y, newElement.width, newElement.height]
            );
          } else if (newElement.type === 'circle') {
            result = await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", x, y, radius) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
              [newElement.type, newElement.color, newElement.strokeWidth, newElement.x, newElement.y, newElement.radius]
            );
          } else if (newElement.type === 'straight_line') {
            result = await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", start_x, start_y, end_x, end_y) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
              [newElement.type, newElement.color, newElement.strokeWidth, newElement.start.x, newElement.start.y, newElement.end.x, newElement.end.y]
            );
          } else if (newElement.type === 'diamond') {
            result = await pool.query(
              'INSERT INTO drawing_elements (type, color, "strokeWidth", x, y, width, height) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
              [newElement.type, newElement.color, newElement.strokeWidth, newElement.x, newElement.y, newElement.width, newElement.height]
            );
          }
          newElement.id = result.rows[0].id;
          console.log(`New ${newElement.type} saved to database with ID: ${newElement.id}.`);
        } catch (err) {
          console.error(`Error saving new ${newElement.type} to DB:`, err);
        }

        wss.clients.forEach(client => {
          if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify({ type: 'new_element', data: newElement }));
          }
        });
      } else if (parsedMessage.type === 'delete_element') {
        const elementIdToDelete = parsedMessage.data.id;
        console.log(`Server received delete_element request for ID: ${elementIdToDelete}`); // Debugging: Server received delete
        try {
          await pool.query('DELETE FROM drawing_elements WHERE id = $1', [elementIdToDelete]);
          console.log(`Element with ID ${elementIdToDelete} deleted from database.`);
          wss.clients.forEach(client => {
            if (client.readyState === ws.OPEN) {
              client.send(JSON.stringify({ type: 'delete_element', data: { id: elementIdToDelete } }));
              console.log(`Server broadcasted delete_element for ID: ${elementIdToDelete}`); // Debugging: Server broadcasted delete
            }
          });
        } catch (err) {
          console.error(`Error deleting element with ID ${elementIdToDelete} from DB:`, err);
        }
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
