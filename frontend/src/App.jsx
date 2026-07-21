import { useState } from "react";
import Pomodoro from "./Pomodoro.jsx";
import Tasks from "./Tasks.jsx";

const DEFAULT_ACCENT = { accent: "#a78bfa", glow: "#7c5cff" };

export default function App() {
  const [view, setView] = useState("timer");
  // Pomodoro reports its current phase colour; we only apply it on the timer
  // view (Tasks uses the neutral shell colour).
  const [pomoAccent, setPomoAccent] = useState(DEFAULT_ACCENT);
  const accent = view === "timer" ? pomoAccent : DEFAULT_ACCENT;

  return (
    <div
      className="app"
      style={{ "--accent": accent.accent, "--glow": accent.glow }}
    >
      <div className="aurora" aria-hidden />

      <div className="brand">
        <span className="dot" />
        Pomodoro&nbsp;Flow
      </div>

      <nav className="topnav">
        <button
          className={"navbtn" + (view === "timer" ? " active" : "")}
          onClick={() => setView("timer")}
        >
          ⏱ Timer
        </button>
        <button
          className={"navbtn" + (view === "tasks" ? " active" : "")}
          onClick={() => setView("tasks")}
        >
          ✓ Tasks
        </button>
      </nav>

      {/* Both stay mounted so the timer keeps running while you're on Tasks.
          display:contents keeps the visible card as a direct flex child. */}
      <div style={{ display: view === "timer" ? "contents" : "none" }}>
        <Pomodoro onAccent={setPomoAccent} />
      </div>
      <div style={{ display: view === "tasks" ? "contents" : "none" }}>
        <Tasks />
      </div>
    </div>
  );
}
