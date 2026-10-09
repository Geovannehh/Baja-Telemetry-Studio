export const CENTER = { lat: -2.53, lon: -44.3 };
export const TRACK_POINTS = 240;

export function pointAt(seq) {
  const t = (2 * Math.PI * (((seq % TRACK_POINTS) + TRACK_POINTS) % TRACK_POINTS)) / TRACK_POINTS;
  return {
    lat: CENTER.lat + 0.00165 * Math.sin(t) + 0.00033 * Math.sin(3 * t),
    lon: CENTER.lon + 0.00225 * Math.cos(t) + 0.00044 * Math.cos(2 * t + 0.4)
  };
}

const round = (n, places = 1) => Number(n.toFixed(places));

export function makeSample(seq, timestamp = new Date().toISOString()) {
  const t = seq / 9;
  const speed = Math.max(4, 43 + 14 * Math.sin(t / 3.7) + 7 * Math.sin(t / 1.8));
  const rpm = Math.min(6800, Math.max(1400, 3300 + speed * 36 + 480 * Math.sin(t / 2.7)));
  return {
    ts: timestamp,
    source: 'simulator',
    seq,
    lap: Math.floor(seq / TRACK_POINTS) + 1,
    progress: ((seq % TRACK_POINTS) + TRACK_POINTS) % TRACK_POINTS / TRACK_POINTS,
    rpm: Math.round(rpm),
    speedKmh: round(speed),
    engineTempC: round(82 + 6.8 * Math.sin(t / 12) + 3 * Math.sin(t / 4)),
    cvtTempC: round(66 + 9 * Math.sin(t / 10)),
    accelerationG: round(0.62 * Math.sin(t / 2.3), 2),
    inclineDeg: round(12 * Math.sin(t / 6.8)),
    batteryV: round(12.55 + 0.24 * Math.cos(t / 8), 2),
    ...pointAt(seq)
  };
}

export function normalizeSample(payload) {
  const fields = ['rpm','speedKmh','engineTempC','cvtTempC','accelerationG','inclineDeg','batteryV','lat','lon'];
  if (!payload || typeof payload !== 'object') throw new Error('Payload inválido');
  const s = {};
  for (const key of fields) {
    const n = Number(payload[key]);
    if (payload[key] === undefined || payload[key] === null || payload[key] === '' || !Number.isFinite(n)) {
      throw new Error(`Campo inválido: ${key}`);
    }
    s[key] = n;
  }
  if (s.lat < -90 || s.lat > 90 || s.lon < -180 || s.lon > 180 || s.rpm < 0 || s.speedKmh < 0) {
    throw new Error('Latitude, longitude, RPM ou velocidade fora do intervalo');
  }
  const ts = new Date(payload.ts || Date.now());
  if (Number.isNaN(ts.getTime())) throw new Error('Timestamp inválido');
  return {
    ...s, ts: ts.toISOString(), source: 'esp32',
    seq: Number.isInteger(payload.seq) ? payload.seq : null,
    lap: Number.isInteger(payload.lap) && payload.lap > 0 ? payload.lap : null,
    progress: Number.isFinite(Number(payload.progress)) ? Math.min(1, Math.max(0, Number(payload.progress))) : null
  };
}
