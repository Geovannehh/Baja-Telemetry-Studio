import React from 'react';

const TOTAL = 240;
const CENTER = { lat: -2.53, lon: -44.3 };

function gps(seq) {
  const t = (2 * Math.PI * seq) / TOTAL;
  return {
    lat: CENTER.lat + 0.00165 * Math.sin(t) + 0.00033 * Math.sin(3 * t),
    lon: CENTER.lon + 0.00225 * Math.cos(t) + 0.00044 * Math.cos(2 * t + 0.4)
  };
}

const route = Array.from({ length: TOTAL + 1 }, (_, i) => gps(i));
const bound = {
  minLon: Math.min(...route.map(p => p.lon)), maxLon: Math.max(...route.map(p => p.lon)),
  minLat: Math.min(...route.map(p => p.lat)), maxLat: Math.max(...route.map(p => p.lat))
};
const toXY = (p) => ({
  x: 42 + ((p.lon - bound.minLon) / (bound.maxLon - bound.minLon)) * 386,
  y: 35 + (1 - (p.lat - bound.minLat) / (bound.maxLat - bound.minLat)) * 229
});
const routeSvg = route.map(p => { const xy = toXY(p); return `${xy.x.toFixed(1)},${xy.y.toFixed(1)}`; }).join(' ');
const start = toXY(route[0]);

export default function CircuitMap({ sample, showTrail = true, history = [] }) {
  const marker = sample && Number.isFinite(sample.lat) && Number.isFinite(sample.lon) ? toXY(sample) : toXY(route[0]);
  const tail = showTrail ? history.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).slice(-50).map(p => {
    const xy = toXY(p); return `${xy.x.toFixed(1)},${xy.y.toFixed(1)}`;
  }).join(' ') : '';
  return (
    <div className="circuit-area">
      <div className="circuit-overlay top"><span>GPS TRACK VISUALIZER</span><span className="mono">01 / OFF-ROAD</span></div>
      <svg className="circuit-svg" viewBox="0 0 470 300" role="img" aria-label="Mapa vetorial da pista com posição do veículo">
        <defs>
          <pattern id="track-grid" width="19" height="19" patternUnits="userSpaceOnUse"><path d="M 19 0 L 0 0 0 19" fill="none" stroke="#24304a" strokeWidth="0.7" /></pattern>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="470" height="300" fill="url(#track-grid)" opacity=".42"/>
        <polyline points={routeSvg} fill="none" stroke="#242b43" strokeWidth="27" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points={routeSvg} fill="none" stroke="#455272" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points={routeSvg} fill="none" stroke="#0d152a" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points={routeSvg} fill="none" stroke="#5378a4" strokeWidth="1.6" strokeDasharray="5 9" opacity=".6"/>
        {tail && <polyline points={tail} fill="none" stroke="#32c7e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".9" filter="url(#glow)"/>}
        <line x1={start.x-11} y1={start.y-7} x2={start.x+11} y2={start.y+7} stroke="#fff" strokeWidth="5" />
        <line x1={start.x-11} y1={start.y-7} x2={start.x+11} y2={start.y+7} stroke="#0b0e1c" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx={marker.x} cy={marker.y} r="15" fill="#32c7e5" opacity=".13"/>
        <circle cx={marker.x} cy={marker.y} r="8" fill="#32c7e5" stroke="#d7faff" strokeWidth="2.5" filter="url(#glow)" />
        <circle cx={marker.x} cy={marker.y} r="2.5" fill="#0a0b18" />
        <text x="28" y="280" fill="#7184a7" fontSize="11" fontWeight="700">S</text>
        <text x="28" y="28" fill="#7184a7" fontSize="11" fontWeight="700">N ↑</text>
      </svg>
      <div className="circuit-overlay bottom"><span><b className="dot dot-cyan"/> POSIÇÃO ATUAL</span><span>TRAÇADO DEMONSTRATIVO</span></div>
    </div>
  );
}
