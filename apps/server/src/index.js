import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import mqtt from 'mqtt';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { makeSample, normalizeSample, TRACK_POINTS } from './simulator.js';

const PORT = Number(process.env.PORT || 4000);
const SIMULATE = process.env.SIMULATE !== 'false';
const MQTT_ENABLED = process.env.MQTT_ENABLED === 'true';
const PG_ENABLED = process.env.PG_ENABLED === 'true';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'baja/telemetry';
const INTERVAL = Math.max(250, Number(process.env.SIM_INTERVAL_MS || 1000));
const startedAt = Date.now();
const capacity = 2000;
const history = [];
const events = [];
let seq = 180;
let mqttConnected = false;
let dbConnected = false;
let simulatedRunning = SIMULATE;
let lastFlags = new Set();
let pool = null;

// Preenche a tela imediatamente com um histórico demonstrativo.
for (let n = 0; n <= seq; n++) {
  history.push(makeSample(n, new Date(Date.now() - (seq - n) * INTERVAL).toISOString()));
}

if (PG_ENABLED) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
  pool.query('SELECT 1').then(() => {
    dbConnected = true;
    console.log('[PostgreSQL] conectado');
  }).catch((error) => console.warn('[PostgreSQL] indisponível:', error.message));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcast(data) {
  for (const ws of wss.clients) send(ws, data);
}
function remember(list, item, limit) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

function assess(s) {
  const rules = [
    ['hot-engine', s.engineTempC >= 91, 'Temperatura do motor elevada', 'warning'],
    ['hot-cvt', s.cvtTempC >= 78, 'Temperatura da CVT elevada', 'warning'],
    ['battery', s.batteryV < 12.2, 'Tensão da bateria baixa', 'warning'],
    ['rpm', s.rpm >= 6250, 'RPM próximo ao limite', 'danger']
  ];
  const active = new Set(rules.filter(([, active]) => active).map(([key]) => key));
  for (const [key, isActive, title, severity] of rules) {
    if (isActive && !lastFlags.has(key)) {
      const event = { id: `${Date.now()}-${key}`, ts: s.ts, title, severity, source: s.source };
      remember(events, event, 80);
      broadcast({ type: 'event', data: event });
    }
  }
  lastFlags = active;
}

function record(s) {
  remember(history, s, capacity);
  assess(s);
  broadcast({ type: 'telemetry', data: s });
  if (pool) {
    pool.query(`INSERT INTO telemetry (
      ts, source, lap, rpm, speed_kmh, engine_temp_c, cvt_temp_c,
      acceleration_g, incline_deg, battery_v, lat, lon
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
      s.ts, s.source, s.lap, s.rpm, s.speedKmh, s.engineTempC, s.cvtTempC,
      s.accelerationG, s.inclineDeg, s.batteryV, s.lat, s.lon
    ]).then(() => { dbConnected = true; }).catch((error) => {
      if (dbConnected) console.warn('[PostgreSQL] gravação interrompida:', error.message);
      dbConnected = false;
    });
  }
}

function status() {
  const last = history.at(-1);
  return {
    simulate: SIMULATE,
    simulationRunning: simulatedRunning,
    mqttEnabled: MQTT_ENABLED,
    mqttConnected,
    dbEnabled: PG_ENABLED,
    dbConnected,
    wsClients: wss.clients.size,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    recordsInMemory: history.length,
    lastSampleAt: last?.ts || null
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, ...status() }));
app.get('/api/telemetry/latest', (_req, res) => res.json(history.at(-1) || null));
app.get('/api/telemetry/history', (req, res) => {
  const limit = Math.min(2000, Math.max(1, Number.parseInt(req.query.limit, 10) || 360));
  res.json(history.slice(-limit));
});
app.get('/api/events', (_req, res) => res.json(events.slice(-40).reverse()));
app.post('/api/simulation', (req, res) => {
  if (!SIMULATE) return res.status(409).json({ error: 'SIMULATE=false' });
  if (typeof req.body.running !== 'boolean') return res.status(400).json({ error: 'running deve ser boolean' });
  simulatedRunning = req.body.running;
  broadcast({ type: 'status', data: status() });
  res.json(status());
});

// Com um build de produção, a mesma API pode servir o dashboard React.
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path === '/ws') return res.sendStatus(404);
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

wss.on('connection', (ws) => {
  send(ws, { type: 'init', data: { history: history.slice(-360), events: events.slice(-40).reverse(), status: status() } });
});

if (MQTT_ENABLED) {
  const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', { reconnectPeriod: 2500 });
  client.on('connect', () => {
    mqttConnected = true;
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.warn('[MQTT] erro de inscrição:', err.message);
      else console.log('[MQTT] ouvindo', MQTT_TOPIC);
    });
  });
  client.on('close', () => { mqttConnected = false; });
  client.on('error', (err) => console.warn('[MQTT]', err.message));
  client.on('message', (_topic, packet) => {
    try { record(normalizeSample(JSON.parse(packet.toString()))); }
    catch (err) { console.warn('[MQTT] mensagem rejeitada:', err.message); }
  });
}

setInterval(() => {
  if (simulatedRunning) record(makeSample(++seq));
}, INTERVAL);

server.listen(PORT, () => {
  console.log(`[Baja API] http://localhost:${PORT}`);
  console.log(`[Baja API] Simulator=${SIMULATE} MQTT=${MQTT_ENABLED} PostgreSQL=${PG_ENABLED}`);
});
