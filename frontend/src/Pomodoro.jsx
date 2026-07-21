import { useEffect, useMemo, useRef, useState } from "react";

const MODES = {
  focus: { label: "Focus", minutes: 25, accent: "#ff5f6d", glow: "#ff5f6d" },
  short: { label: "Short Break", minutes: 5, accent: "#22d3ee", glow: "#22d3ee" },
  long: { label: "Long Break", minutes: 30, accent: "#a78bfa", glow: "#a78bfa" },
};

// Quick-test override — when set, every phase lasts this many seconds.
// null = use the real per-mode durations above.
const TEST_SECONDS = null;
const secs = (key) => TEST_SECONDS ?? MODES[key].minutes * 60;

// Start the audible countdown this many seconds before the phase ends.
const COUNTDOWN_FROM = 5;

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

// One shared AudioContext (creating one per beep is heavy and rate-limited).
let _actx = null;
function actx() {
  try {
    if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === "suspended") _actx.resume();
    return _actx;
  } catch (e) {
    return null;
  }
}

// A single short tone. `peak` is the gain (loudness) — kept low on purpose.
function blip(freq, at, dur, peak, type = "sine") {
  const ctx = actx();
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// End-of-phase signal: a rising 4-note arpeggio — distinct and hard to miss
// thanks to the melody, not the volume (peak gain stays at the old level).
function chime() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) =>
    blip(f, i * 0.16, i === notes.length - 1 ? 0.6 : 0.22, 0.32, "triangle")
  );
}

// One countdown tick. The final three seconds (3 -> 2 -> 1) climb the scale
// so the ending lifts upward. All quiet.
const FINAL3 = { 3: 880.0, 2: 1108.73, 1: 1318.51 }; // A5 -> C#6 -> E6
function tick(secondsLeft) {
  if (secondsLeft <= 3) blip(FINAL3[secondsLeft], 0, 0.13, 0.26, "sine");
  else blip(760, 0, 0.07, 0.16, "sine");
}

export default function Pomodoro({ onAccent }) {
  const [mode, setMode] = useState("focus");
  const [remaining, setRemaining] = useState(secs("focus"));
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("");
  const [autostart, setAutostart] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [seq, setSeq] = useState(0); // bumped every time a fresh session begins
  const [justLogged, setJustLogged] = useState(false);
  const [stats, setStats] = useState({
    today: { count: 0, minutes: 0 },
    total: { count: 0, minutes: 0 },
  });

  const deadlineRef = useRef(null);
  const lastTickRef = useRef(null); // last whole second we played a tick for
  const autostartRef = useRef(autostart);
  const modeRef = useRef(mode);
  const labelRef = useRef(label);
  const remainingRef = useRef(remaining);
  autostartRef.current = autostart;
  modeRef.current = mode;
  labelRef.current = label;
  remainingRef.current = remaining;

  const total = secs(mode);
  const accent = MODES[mode].accent;

  const loadStats = () =>
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats({ today: d.today, total: d.total }))
      .catch(() => {});

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!running) return;
    if (!deadlineRef.current) {
      deadlineRef.current = Date.now() + remainingRef.current * 1000;
    }
    const id = setInterval(() => {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        advance(true); // natural completion -> record it
      } else {
        setRemaining(left);
        // audible countdown over the final seconds (once per whole second)
        if (left <= COUNTDOWN_FROM && left !== lastTickRef.current) {
          lastTickRef.current = left;
          tick(left);
        }
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, seq]);

  useEffect(() => {
    document.title = `${fmt(remaining)} · ${MODES[mode].label} — Pomodoro Flow`;
  }, [remaining, mode]);

  // Let the shell (aurora / brand / nav) follow the current phase colour.
  useEffect(() => {
    onAccent?.({ accent: MODES[mode].accent, glow: MODES[mode].glow });
  }, [mode, onAccent]);

  function advance(record) {
    chime();
    const finished = modeRef.current;
    let nextMode = "focus";
    if (finished === "focus") {
      if (record) {
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "focus",
            minutes: MODES.focus.minutes,
            label: labelRef.current,
          }),
        })
          .then(loadStats)
          .catch(() => {});
        setJustLogged(true);
        setTimeout(() => setJustLogged(false), 2500);
      }
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      nextMode = nextCycle % 4 === 0 ? "long" : "short";
    }
    go(nextMode, autostartRef.current);
  }

  function go(nextMode, autoRun) {
    setMode(nextMode);
    setRemaining(secs(nextMode));
    remainingRef.current = secs(nextMode);
    deadlineRef.current = null;
    lastTickRef.current = null;
    setRunning(Boolean(autoRun));
    setSeq((s) => s + 1);
  }

  function selectMode(key) {
    setRunning(false);
    deadlineRef.current = null;
    lastTickRef.current = null;
    setMode(key);
    setRemaining(secs(key));
    remainingRef.current = secs(key);
  }

  function toggle() {
    if (running) {
      setRunning(false);
      deadlineRef.current = null;
    } else {
      actx(); // unlock/resume audio while we still have the click gesture
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    deadlineRef.current = null;
    lastTickRef.current = null;
    setRemaining(secs(mode));
    remainingRef.current = secs(mode);
  }

  const progress = useMemo(() => 1 - remaining / total, [remaining, total]);
  const dash = CIRC * (1 - progress);

  return (
    <main className="card" style={{ "--accent": accent, "--glow": MODES[mode].glow }}>
      <div className="tabs">
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            className={"tab" + (mode === key ? " active" : "")}
            onClick={() => selectMode(key)}
          >
            {m.label}
          </button>
        ))}
      </div>

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
          onClick={() => advance(false)}
          title="Skip to next phase"
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
        <div className={"stat" + (justLogged ? " flash" : "")}>
          <span className="num">{stats.today.count}</span>
          <span className="cap">today</span>
        </div>
        <div className={"stat" + (justLogged ? " flash" : "")}>
          <span className="num">{stats.today.minutes}</span>
          <span className="cap">min focused</span>
        </div>
        <div className="stat">
          <span className="num">{stats.total.count}</span>
          <span className="cap">all-time</span>
        </div>
      </section>
    </main>
  );
}
