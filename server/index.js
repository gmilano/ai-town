import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { initSchema } from './db/index.js';
import { seedAgents } from './db/seed.js';
import { loadAgents } from './game/agents.js';
import { setIO, startGameLoop, getWorldState } from './game/world.js';
import { queryAll, queryOne } from './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3200;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../client')));

// ── REST API ───────────────────────────────────────────────────────────────────

app.get('/api/world', (req, res) => {
  res.json(getWorldState());
});

app.get('/api/agent/:id', async (req, res) => {
  const agent = await queryOne('SELECT * FROM agents WHERE id=$1', [req.params.id]);
  if (!agent) return res.status(404).json({ error: 'not found' });
  const memories = await queryAll('SELECT * FROM memories WHERE agent_id=$1 ORDER BY last_accessed DESC LIMIT 10', [agent.id]);
  const convs = await queryAll(`
    SELECT c.*, 
      (SELECT json_agg(m ORDER BY m.id) FROM (SELECT msg.text, a.name FROM messages msg JOIN agents a ON msg.agent_id=a.id WHERE msg.conversation_id=c.id LIMIT 20) m) as messages
    FROM conversations c
    WHERE (c.agent1_id=$1 OR c.agent2_id=$1) AND c.status='ended'
    ORDER BY c.started_at DESC LIMIT 5
  `, [agent.id]);
  res.json({ agent, memories, conversations: convs });
});

app.get('/api/conversations', async (req, res) => {
  const convs = await queryAll(`
    SELECT c.*, a1.name as agent1_name, a2.name as agent2_name
    FROM conversations c
    JOIN agents a1 ON c.agent1_id=a1.id
    JOIN agents a2 ON c.agent2_id=a2.id
    ORDER BY c.started_at DESC LIMIT 20
  `);
  res.json(convs);
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/index.html'));
});

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[io] Client connected: ${socket.id}`);
  // Send current state immediately
  socket.emit('worldState', getWorldState());

  socket.on('disconnect', () => {
    console.log(`[io] Client disconnected: ${socket.id}`);
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  try {
    await initSchema();
    await seedAgents();
    await loadAgents();
    setIO(io);
    await startGameLoop();

    httpServer.listen(PORT, () => {
      console.log(`\n🏘️  AI Town running at http://localhost:${PORT}`);
      console.log(`   Agents alive, conversations happening, memories forming.\n`);
    });
  } catch (err) {
    console.error('Boot failed:', err);
    process.exit(1);
  }
}

boot();
