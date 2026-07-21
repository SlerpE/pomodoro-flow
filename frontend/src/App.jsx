import { useEffect, useState } from "react";
import Pomodoro from "./Pomodoro.jsx";
import Tasks from "./Tasks.jsx";

const DEFAULT_ACCENT = { accent: "#a78bfa", glow: "#7c5cff" };

export default function App() {
  const [view, setView] = useState("timer");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);

  // Tasks view uses the neutral shell colour; timer view drives it per phase.
  useEffect(() => {
    if (view === "tasks") setAccent(DEFAULT_ACCENT);
  }, [view]);

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

      {view === "timer" ? <Pomodoro onAccent={setAccent} /> : <Tasks />}
    </div>
  );
}
