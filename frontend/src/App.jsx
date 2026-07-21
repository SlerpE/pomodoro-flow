import { useState } from "react";
import Pomodoro from "./Pomodoro.jsx";
import Tasks from "./Tasks.jsx";

export default function App() {
  const [view, setView] = useState("timer");

  return (
    <div className="app">
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

      {view === "timer" ? <Pomodoro /> : <Tasks />}
    </div>
  );
}
