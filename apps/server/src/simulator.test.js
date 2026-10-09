import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSample, normalizeSample, pointAt, TRACK_POINTS } from './simulator.js';

test('pista é fechada a cada volta', () => {
  assert.deepEqual(pointAt(0), pointAt(TRACK_POINTS));
});
test('amostra simulada produz campos coerentes', () => {
  const s = makeSample(24, '2026-10-09T12:00:00.000Z');
  assert.ok(s.rpm > 0);
  assert.ok(s.speedKmh >= 0);
  assert.equal(s.lap, 1);
  assert.equal(s.source, 'simulator');
});
test('payload MQTT requer campos físicos válidos', () => {
  const { source, rpm } = normalizeSample(makeSample(20));
  assert.equal(source, 'esp32');
  assert.ok(rpm > 0);
  assert.throws(() => normalizeSample({ lat: 100 }), /inválido/);
});
