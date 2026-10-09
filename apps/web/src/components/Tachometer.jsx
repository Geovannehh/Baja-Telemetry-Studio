import React from 'react';

export default function Tachometer({ rpm = 0, speed = 0 }) {
  const ratio = Math.max(0, Math.min(1, rpm / 7000));
  return (
    <div className="tach-wrap">
      <svg viewBox="0 0 370 250" className="tach-svg" role="img" aria-label={`Conta-giros ${Math.round(rpm)} RPM e velocidade ${Math.round(speed)} quilômetros por hora`}>
        <defs>
          <linearGradient id="rpm-grad"><stop stopColor="#32c7e5" offset="0"/><stop stopColor="#9e78f8" offset=".58"/><stop stopColor="#fca45c" offset=".88"/><stop stopColor="#fb5c77" offset="1"/></linearGradient>
        </defs>
        <path d="M 56 198 A 129 129 0 0 1 314 198" fill="none" stroke="#252d48" strokeWidth="16" strokeLinecap="round" pathLength="100" />
        <path d="M 56 198 A 129 129 0 0 1 314 198" fill="none" stroke="url(#rpm-grad)" strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${ratio * 100} 100`} />
        {Array.from({ length: 15 }, (_, i) => {
          const angle = Math.PI - i * Math.PI / 14;
          const x1 = 185 + 106 * Math.cos(angle), y1 = 198 - 106 * Math.sin(angle);
          const x2 = 185 + 116 * Math.cos(angle), y2 = 198 - 116 * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i > 12 ? '#f98884' : '#677493'} strokeWidth={i % 2 === 0 ? 2.3 : 1} />;
        })}
        <text x="57" y="231" fill="#7787a7" fontSize="12" textAnchor="middle">0</text>
        <text x="313" y="231" fill="#ff8f9a" fontSize="12" textAnchor="middle">7K</text>
        <text x="185" y="102" fill="#93a5c6" fontSize="13" textAnchor="middle" letterSpacing="2">VELOCIDADE</text>
        <text x="185" y="164" fill="#f6f7fb" fontSize="70" fontFamily="Rajdhani, sans-serif" fontWeight="700" textAnchor="middle">{Math.round(speed)}</text>
        <text x="185" y="189" fill="#93a5c6" fontSize="14" textAnchor="middle">KM/H</text>
        <text x="185" y="238" fill="#9e78f8" fontSize="13" textAnchor="middle" fontWeight="700">{Math.round(rpm).toLocaleString('pt-BR')} RPM</text>
      </svg>
    </div>
  );
}
