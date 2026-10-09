import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BatteryCharging, CalendarClock, ChevronDown,
  CircleGauge, Clock3, Cpu, Download, Gauge, History, LayoutDashboard,
  MapPin, Pause, Play, Radio, RotateCcw, Settings2, ShieldCheck,
  Thermometer, TrendingUp, Wifi, WifiOff, Zap
} from 'lucide-react';
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import CircuitMap from './components/CircuitMap.jsx';
import Tachometer from './components/Tachometer.jsx';

const emptySample = {
  ts: new Date().toISOString(), rpm: 0, speedKmh: 0, engineTempC: 0, cvtTempC: 0,
  accelerationG: 0, inclineDeg: 0, batteryV: 0, lat: -2.53, lon: -44.3, lap: 1, progress: 0
};
const views = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Telemetria', icon: Activity },
  { label: 'Circuito & GPS', icon: MapPin },
  { label: 'Replay de voltas', icon: History }
];
const chartOptions = [
  { key: 'speedKmh', name: 'Velocidade', unit: 'km/h', color: '#32c7e5' },
  { key: 'rpm', name: 'RPM', unit: 'rpm', color: '#9e78f8' },
  { key: 'engineTempC', name: 'Temperatura', unit: '°C', color: '#ffb86c' }
];
const labelTime = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const round = (value, places = 0) => Number(value || 0).toFixed(places);
const fmtLap = value => { const v = Math.max(0, Math.floor(value || 0)); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

function MetricCard({ icon: Icon, label, value, unit, annotation, kind = 'cyan', bar = 45 }) {
  return <div className="metric-card panel">
    <div className="metric-top"><span>{label}</span><Icon size={18} className={`text-${kind}`}/></div>
    <div className="metric-val">{value} <small>{unit}</small></div>
    <div className="metric-footer"><span>{annotation}</span><span className="mini-trend">●</span></div>
    <div className="metric-track"><div className={`metric-fill fill-${kind}`} style={{ width: `${Math.min(100, bar)}%` }}/></div>
  </div>;
}

function StatusDot({ connected }) { return <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />; }

function getWarning(s) {
  if (s.engineTempC >= 91) return { label: 'TEMP. ELEVADA', className: 'warning' };
  if (s.cvtTempC >= 78) return { label: 'CVT EM ATENÇÃO', className: 'warning' };
  if (s.batteryV > 0 && s.batteryV < 12.2) return { label: 'BATERIA BAIXA', className: 'warning' };
  return { label: 'SISTEMA NORMAL', className: 'good' };
}

function exportCsv(history) {
  if (!history.length) return;
  const cols = ['ts','source','lap','rpm','speedKmh','engineTempC','cvtTempC','accelerationG','inclineDeg','batteryV','lat','lon'];
  const csv = [cols.join(','), ...history.map(s => cols.map(key => String(s[key] ?? '').replaceAll(',', '.')).join(','))].join('\n');
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url; a.download = `baja-telemetria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState({ simulate: true, simulationRunning: true });
  const [mode, setMode] = useState('live');
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [chartOption, setChartOption] = useState('speedKmh');
  const [activeView, setActiveView] = useState('Visão geral');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let ws;
    let active = true;
    let timer;
    let reconnect;
    const load = async () => {
      try {
        const [h, e, s] = await Promise.all([
          fetch('/api/telemetry/history?limit=360').then(r => r.json()),
          fetch('/api/events').then(r => r.json()),
          fetch('/api/health').then(r => r.json())
        ]);
        if (active) { setHistory(h); setEvents(e); setStatus(s); }
      } catch { /* conexão WebSocket fará a reidratação quando a API subir */ }
    };
    const connect = () => {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws.onopen = () => { if (active) setConnected(true); };
      ws.onmessage = message => {
        if (!active) return;
        let msg;
        try { msg = JSON.parse(message.data); } catch { return; }
        if (msg.type === 'init') {
          setHistory(msg.data.history || []);
          setEvents(msg.data.events || []);
          setStatus(msg.data.status || {});
        }
        if (msg.type === 'telemetry') setHistory(prev => [...prev, msg.data].slice(-1000));
        if (msg.type === 'event') setEvents(prev => [msg.data, ...prev].slice(0, 40));
        if (msg.type === 'status') setStatus(msg.data);
      };
      ws.onclose = () => { if (active) { setConnected(false); reconnect = setTimeout(connect, 2500); } };
      ws.onerror = () => ws.close();
    };
    load(); connect();
    timer = setInterval(() => fetch('/api/health').then(r => r.json()).then(s => { if (active) setStatus(s); }).catch(() => {}), 6000);
    return () => { active = false; clearTimeout(timer); clearTimeout(reconnect); ws?.close(); };
  }, []);

  useEffect(() => {
    if (mode !== 'replay' || !replayPlaying) return;
    const id = setInterval(() => setReplayIndex(current => {
      if (current >= history.length - 1) { setReplayPlaying(false); return current; }
      return current + 1;
    }), 420);
    return () => clearInterval(id);
  }, [mode, replayPlaying, history.length]);

  const latest = history.at(-1) || emptySample;
  const idx = Math.max(0, Math.min(replayIndex, history.length - 1));
  const activeSample = mode === 'replay' ? (history[idx] || latest) : latest;
  const warning = getWarning(activeSample);
  const chart = chartOptions.find(c => c.key === chartOption);
  const chartData = useMemo(() => {
    const cutoff = mode === 'replay' ? Math.max(0, idx - 80) : Math.max(0, history.length - 80);
    const end = mode === 'replay' ? idx + 1 : history.length;
    return history.slice(cutoff, end).filter((_, i) => i % 2 === 0).map(s => ({
      ...s, label: labelTime(s.ts)
    }));
  }, [history, mode, idx]);
  const lapElapsed = activeSample.seq != null ? activeSample.seq % 240 : Math.round((activeSample.progress || 0) * 240);
  const currentLap = activeSample.lap || 1;
  const displayedHistory = mode === 'replay' ? history.slice(Math.max(0, idx - 90), idx + 1) : history;
  const lastEvents = events.filter(e => new Date(e.ts).getTime() <= new Date(activeSample.ts).getTime()).slice(0, 3);

  function enterReplay() { setMode('replay'); setReplayPlaying(false); setReplayIndex(Math.max(0, history.length - 130)); setActiveView('Replay de voltas'); }
  function enterLive() { setMode('live'); setReplayPlaying(false); setActiveView('Visão geral'); }
  async function toggleSimulation() {
    try {
      const response = await fetch('/api/simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ running: !status.simulationRunning }) });
      if (!response.ok) throw new Error();
      setStatus(await response.json());
    } catch { setToast('Não foi possível alterar a simulação. Verifique a API.'); }
  }
  function goTo(label) {
    setActiveView(label);
    if (label === 'Replay de voltas') enterReplay();
    else if (mode === 'replay') enterLive();
    document.getElementById(label === 'Circuito & GPS' ? 'circuit' : label === 'Telemetria' ? 'metrics' : 'overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-symbol">B<span>.</span></div><div><div className="brand-title">BAJA <strong>STUDIO</strong></div><div className="brand-kicker">TELEMETRY PLATFORM</div></div></div>
        <div className="sidebar-heading">WORKSPACE</div>
        <nav className="sidebar-menu">{views.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeView === label ? 'active' : ''}`} onClick={() => goTo(label)}><Icon size={18}/><span>{label}</span>{activeView === label && <span className="nav-indicator"/>}</button>)}</nav>
        <div className="sidebar-heading systems-title">SISTEMA</div>
        <div className="system-list"><div><Wifi size={15}/> Telemetria <span className={connected ? 'sys-green' : 'sys-red'}>{connected ? 'ON' : 'OFF'}</span></div><div><Cpu size={15}/> ESP32-S3 <span>{status.mqttConnected ? 'MQTT' : 'DEMO'}</span></div><div><ShieldCheck size={15}/> Banco de dados <span>{status.dbConnected ? 'ON' : 'LOCAL'}</span></div></div>
        <div className="sidebar-bottom"><div className="team-avatar">BS</div><div className="team-detail"><b>BAJA SAE</b><span>Race Engineering Team</span></div><ChevronDown size={15}/></div>
      </aside>

      <main className="main" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><span className="slash">/</span><strong>OVERVIEW</strong></div>
          <div className="topbar-right"><span className="top-date"><CalendarClock size={15}/> TEMPORADA 2026</span><div className="top-divider"/><span className="server-pill"><StatusDot connected={connected} /> {connected ? 'CONEXÃO ATIVA' : 'DESCONECTADO'}</span><div className="account-icon">BS</div></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line"/> CENTRO DE COMANDO / BAJA SAE</div><h1>Race Command <span>Center.</span></h1><p>Telemetria inteligente para extrair performance em cada volta.</p></div>
            <div className="head-actions"><button className="btn btn-outline" onClick={() => exportCsv(history)}><Download size={16}/> Exportar CSV</button><button className="btn btn-purple" onClick={mode === 'live' ? enterReplay : enterLive}>{mode === 'live' ? <History size={16}/> : <Radio size={16}/>} {mode === 'live' ? 'Abrir replay' : 'Voltar ao vivo'}</button></div>
          </div>

          <div className="session-strip"><div className="strip-left"><span className={`live-badge ${mode === 'replay' ? 'replay-badge' : ''}`}><span className="beacon"/>{mode === 'live' ? 'LIVE SESSION' : 'REPLAY MODE'}</span><strong>BAJA-01 / PROTOTYPE A</strong><span className="strip-sep"/><span className="muted"><MapPin size={14}/> PISTA DE TESTES • MA</span></div><div className="strip-right"><span className="muted">STATUS DO VEÍCULO</span><span className={`vehicle-status ${warning.className}`}>● {warning.label}</span><span className="strip-sep"/><span className="mono muted">{labelTime(activeSample.ts)}</span></div></div>

          <div className="hero-grid">
            <section className="panel hero-gauge">
              <div className="panel-header"><div><div className="section-kicker">01 / DADOS INSTANTÂNEOS</div><h2>Performance ao vivo</h2></div><span className="panel-marker"><CircleGauge size={16}/> MOTOR</span></div>
              <Tachometer rpm={activeSample.rpm} speed={activeSample.speedKmh}/>
              <div className="gauge-meta"><div><span>ACELERAÇÃO</span><strong>{round(activeSample.accelerationG, 2)} <small>G</small></strong></div><div><span>INCLINAÇÃO</span><strong>{round(activeSample.inclineDeg, 1)} <small>°</small></strong></div><div><span>BATERIA</span><strong>{round(activeSample.batteryV, 2)} <small>V</small></strong></div></div>
            </section>
            <section className="panel circuit-panel" id="circuit">
              <div className="panel-header"><div><div className="section-kicker">02 / GEOLOCALIZAÇÃO</div><h2>Circuito & GPS</h2></div><span className="panel-marker"><MapPin size={16}/> GPS ATIVO</span></div>
              <CircuitMap sample={activeSample} history={displayedHistory}/>
              <div className="gps-footer"><div><span>LATITUDE</span><strong>{Number(activeSample.lat).toFixed(5)}°</strong></div><div><span>LONGITUDE</span><strong>{Number(activeSample.lon).toFixed(5)}°</strong></div><div><span>VOLTA ATUAL</span><strong className="highlight-text">#{String(currentLap).padStart(2, '0')}</strong></div></div>
            </section>
          </div>

          <div className="metrics-grid" id="metrics">
            <MetricCard icon={Gauge} label="RPM DO MOTOR" value={Math.round(activeSample.rpm).toLocaleString('pt-BR')} unit="rpm" annotation="Limite sugerido: 7.000" kind="purple" bar={(activeSample.rpm / 7000) * 100}/>
            <MetricCard icon={Zap} label="VELOCIDADE" value={round(activeSample.speedKmh)} unit="km/h" annotation="Velocidade instantânea" kind="cyan" bar={activeSample.speedKmh}/>
            <MetricCard icon={Thermometer} label="TEMP. MOTOR" value={round(activeSample.engineTempC)} unit="°C" annotation="Alerta demo ≥ 91°C" kind="orange" bar={activeSample.engineTempC}/>
            <MetricCard icon={Thermometer} label="TEMP. CVT" value={round(activeSample.cvtTempC)} unit="°C" annotation="Alerta demo ≥ 78°C" kind="pink" bar={activeSample.cvtTempC}/>
          </div>

          <div className="bottom-grid">
            <section className="panel analytics-panel"><div className="panel-header"><div><div className="section-kicker">03 / ANÁLISE DE DADOS</div><h2>Histórico de telemetria</h2></div><div className="chart-tabs">{chartOptions.map(o => <button key={o.key} className={o.key === chartOption ? 'selected' : ''} onClick={() => setChartOption(o.key)}>{o.name}</button>)}</div></div>
              <div className="chart-holder"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ left: -20, right: 5, top: 16, bottom: 0 }}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chart.color} stopOpacity={0.28}/><stop offset="100%" stopColor={chart.color} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#263047" strokeDasharray="3 6"/><XAxis dataKey="label" tick={{ fill: '#7787a6', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28}/><YAxis tick={{ fill: '#7787a6', fontSize: 10 }} axisLine={false} tickLine={false} width={44} domain={['auto','auto']}/><Tooltip contentStyle={{ background: '#171c32', border: '1px solid #363f5c', borderRadius: 12, color: '#eff2fb' }} formatter={value => [`${Number(value).toFixed(1)} ${chart.unit}`, chart.name]} labelStyle={{ color: '#8e9bb7' }} /><Area type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2.8} fill="url(#chartFill)" isAnimationActive={false} dot={false}/></AreaChart></ResponsiveContainer></div>
              <div className="chart-footer"><span><span className="legend-dot" style={{ background: chart.color }}/>{chart.name} • {chart.unit}</span><span>AMOSTRAGEM DE 1 SEGUNDO</span></div>
            </section>
            <section className="panel laps-panel"><div className="panel-header"><div><div className="section-kicker">04 / VOLTAS & EVENTOS</div><h2>Resumo de sessão</h2></div><Clock3 size={18} color="#8e9bb7"/></div>
              <div className="lap-columns"><div><span>VOLTA ATUAL</span><strong>{String(currentLap).padStart(2, '0')}</strong></div><div><span>TEMPO DA VOLTA*</span><strong>{fmtLap(lapElapsed)}</strong></div></div>
              <div className="progress-title"><span>PROGRESSO DO TRAÇADO</span><b>{Math.round((activeSample.progress || 0) * 100)}%</b></div><div className="lap-progress"><div style={{ width: `${Math.round((activeSample.progress || 0) * 100)}%` }}/></div>
              <div className="event-title"><span>EVENTOS RECENTES</span><span className="events-count">{events.length} alertas</span></div>
              <div className="event-list">{lastEvents.length ? lastEvents.map(e => <div key={e.id} className="event"><span className="event-icon"><AlertTriangle size={14}/></span><div><b>{e.title}</b><small>{labelTime(e.ts)} · {e.source}</small></div></div>) : <div className="event-none"><ShieldCheck size={16}/> Nenhum alerta ativo nesta sessão</div>}</div>
              <div className="footnote">* Tempo e progresso estimados na demonstração, não cronometração oficial.</div>
            </section>
          </div>

          <section className="replay-panel panel" id="replay"><div className="replay-title"><div><div className="section-kicker">05 / REPRODUÇÃO TEMPORAL</div><h2>Replay da telemetria</h2></div><span className="panel-marker"><History size={15}/> {mode === 'live' ? 'PRONTO PARA REPLAY' : 'REPRODUZINDO HISTÓRICO'}</span></div>
            <div className="playbar"><button className="circle-play" onClick={() => mode === 'live' ? enterReplay() : setReplayPlaying(v => !v)} aria-label={replayPlaying ? 'Pausar replay' : 'Iniciar replay'}>{replayPlaying ? <Pause size={18}/> : <Play size={18}/>}</button><button className="small-replay-btn" onClick={() => { if (mode === 'live') enterReplay(); else { setReplayIndex(Math.max(0, history.length - 130)); setReplayPlaying(false); } }} title="Reiniciar replay"><RotateCcw size={16}/></button><span className="time-code mono">{mode === 'live' ? labelTime(latest.ts) : labelTime(activeSample.ts)}</span><input className="scrubber" type="range" min="0" max={Math.max(0, history.length - 1)} value={mode === 'live' ? Math.max(0, history.length - 1) : idx} onChange={e => { setMode('replay'); setReplayPlaying(false); setReplayIndex(Number(e.target.value)); }} aria-label="Posição temporal no replay"/><span className="time-code mono">{labelTime(latest.ts)}</span><button className={`btn-live ${mode === 'live' ? 'current' : ''}`} onClick={enterLive}><span className="beacon"/> LIVE</button></div>
          </section>
          <footer className="footer"><span>BAJA TELEMETRY STUDIO <span className="footer-divider">/</span> V1.0 MVP</span><span>DEMO: os dados simulados e o circuito não representam medições reais.</span><span>BUILT FOR ENGINEERING</span></footer>
        </div>
      </main>
      {toast && <div className="toast" role="alert">{toast}<button onClick={() => setToast('')}>×</button></div>}
      {status.simulate && <button className="simulation-toggle" onClick={toggleSimulation} title="Pausar ou retomar gerador de amostras"><Settings2 size={15}/>{status.simulationRunning ? 'Pausar simulador' : 'Retomar simulador'}</button>}
    </div>
  );
}
