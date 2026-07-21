import { useEffect, useMemo, useRef, useState } from "react";

const MODES = {
  focus: { label: "Focus", minutes: 25, accent: "#ff5f6d", glow: "#ff5f6d" },
  short: { label: "Short Break", minutes: 5, accent: "#22d3ee", glow: "#22d3ee" },
  long: { label: "Long Break", minutes: 15, accent: "#a78bfa", glow: "#a78bfa" },
};

const RADIUS = 132;
const CIRC = 2 * Math.PI * RADIUS;

function fmt(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function ding() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    o.start();
    o.stop(ctx.currentTime + 0.95);
  } catch (e) {
    /* audio not available */
  }
}

export default function App() {
  const [mode, setMode] = useState("focus");
  const [remaining, setRemaining] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("");
  const [autostart, setAutostart] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [stats, setStats] = useState({
    today: { count: 0, minutes: 0 },
    total: { count: 0, minutes: 0 },
    recent: [],
  });

  const deadlineRef = useRef(null);
  const total = MODES[mode].minutes * 60;
  const accent = MODES[mode].accent;

  const loadStats = () =>
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

  useEffect(() => {
    loadStats();
  }, []);

  // Switch mode -> reset the clock.
  useEffect(() => {
    setRemaining(MODES[mode].minutes * 60);
    deadlineRef.current = null;
  }, [mode]);

  // Timer loop driven by a wall-clock deadline (survives tab throttling).
  useEffect(() => {
    if (!running) return;
    if (!deadlineRef.current) {
      deadlineRef.current = Date.now() + remaining * 1000;
    }
    const id = setInterval(() => {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(id);
        complete();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    document.title = `${fmt(remaining)} · ${MODES[mode].label} — Pomodoro Flow`;
  }, [remaining, mode]);

  function complete() {
    ding();
    setRunning(false);
    deadlineRef.current = null;
    const finished = mode;
    if (finished === "focus") {
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "focus", minutes: MODES.focus.minutes, label }),
      })
        .then(loadStats)
        .catch(() => {});
      const next = (cycle + 1) % 4 === 0 ? "long" : "short";
      setCycle((c) => c + 1);
      go(next, autostart);
    } else {
      go("focus", autostart);
    }
  }

  function go(nextMode, autoRun) {
    setMode(nextMode);
    setRemaining(MODES[nextMode].minutes * 60);
    deadlineRef.current = null;
    setRunning(Boolean(autoRun));
  }

  function toggle() {
    if (running) {
      // pause: freeze remaining, drop the deadline
      setRunning(false);
      deadlineRef.current = null;
    } else {
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    deadlineRef.current = null;
    setRemaining(MODES[mode].minutes * 60);
  }

  const progress = useMemo(() => 1 - remaining / total, [remaining, total]);
  const dash = CIRC * (1 - progress);

  return (
    <div className="app" style={{ "--accent": accent, "--glow": MODES[mode].glow }}>
      <div className="aurora" aria-hidden />
      <main className="card">
        <header className="head">
          <div className="brand">
            <span className="dot" />
            Pomodoro&nbsp;Flow
          </div>
          <div className="tabs">
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                className={"tab" + (mode === key ? " active" : "")}
                onClick={() => {
                  setRunning(false);
                  setMode(key);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </header>

        <div className="ring-wrap">
          <svg className="ring" viewBox="0 0 300 300">
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={accent} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <circle className="track" cx="150" cy="150" r={RADIUS} />
            <circle
              className="progress"
              cx="150"
              cy="150"
              r={RADIUS}
              stroke="url(#grad)"
              strokeDasharray={CIRC}
              strokeDashoffset={dash}
            />
          </svg>
          <div className="clock">
            <div className="time">{fmt(remaining)}</div>
            <div className="phase">{MODES[mode].label}</div>
            <div className="cyclepips">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={"pip" + (cycle % 4 > i ? " on" : "")} />
              ))}
            </div>
          </div>
        </div>

        <input
          className="task"
          value={label}
          maxLength={120}
          placeholder="What are you working on?"
          onChange={(e) => setLabel(e.target.value)}
        />

        <div className="controls">
          <button className="btn ghost" onClick={reset} title="Reset">
            ↺
          </button>
          <button className="btn primary" onClick={toggle}>
            {running ? "Pause" : "Start"}
          </button>
          <button
            className="btn ghost"
            onClick={complete}
            title="Skip to next"
          >
            ⤼
          </button>
        </div>

        <label className="auto">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) => setAutostart(e.target.checked)}
          />
          Auto-start next session
        </label>

        <section className="stats">
          <div className="stat">
            <span className="num">{stats.today.count}</span>
            <span className="cap">today</span>
          </div>
          <div className="stat">
            <span className="num">{stats.today.minutes}</span>
            <span className="cap">min focused</span>
          </div>
          <div className="stat">
            <span className="num">{stats.total.count}</span>
            <span className="cap">all-time</span>
          </div>
        </section>

        {stats.recent.length > 0 && (
          <ul className="recent">
            {stats.recent.map((r, i) => (
              <li key={i}>
                <span className={"tag " + r.mode}>{r.mode}</span>
                <span className="rlabel">{r.label || "—"}</span>
                <span className="rmin">{r.minutes}m</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
