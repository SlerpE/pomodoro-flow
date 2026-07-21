import { useEffect, useRef, useState } from "react";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);

  const tasksRef = useRef([]);
  tasksRef.current = tasks;

  const load = () =>
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  function add(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    })
      .then((r) => r.json())
      .then((task) => {
        setTasks((prev) => [...prev, task]);
        setTitle("");
      })
      .catch(() => {});
  }

  function toggle(task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
    );
    fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    }).catch(() => {});
  }

  function remove(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function clearDone() {
    setTasks((prev) => prev.filter((t) => !t.done));
    fetch("/api/tasks/completed", { method: "DELETE" })
      .then(persistOrder)
      .catch(() => {});
  }

  // ---- drag & drop reordering ----
  function persistOrder() {
    fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: tasksRef.current.map((t) => t.id) }),
    }).catch(() => {});
  }

  function onDragOver(e, overId) {
    e.preventDefault();
    if (dragId == null || dragId === overId) return;
    setTasks((prev) => {
      const from = prev.findIndex((t) => t.id === dragId);
      const to = prev.findIndex((t) => t.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onDrop() {
    setDragId(null);
    persistOrder();
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const activeCount = tasks.length - doneCount;

  return (
    <main className="card tasks-card">
      <div className="tasks-head">
        <h2>Tasks</h2>
        <span className="tcount">
          {activeCount} active{doneCount ? ` · ${doneCount} done` : ""}
        </span>
      </div>

      <form className="add-row" onSubmit={add}>
        <input
          className="task"
          value={title}
          maxLength={200}
          placeholder="Add a task and press Enter…"
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn add-btn" type="submit" aria-label="Add task">
          +
        </button>
      </form>

      {loading ? (
        <p className="empty">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="empty">No tasks yet. Add your first one above ✨</p>
      ) : (
        <ul className="tasklist">
          {tasks.map((t, i) => (
            <li
              key={t.id}
              className={
                (t.done ? "done " : "") + (dragId === t.id ? "dragging" : "")
              }
              draggable
              onDragStart={(e) => {
                setDragId(t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => onDragOver(e, t.id)}
              onDrop={onDrop}
              onDragEnd={onDrop}
            >
              <span className="grip" aria-hidden>
                ⠿
              </span>
              <span className="tnum">{i + 1}</span>
              <button
                className={"check" + (t.done ? " on" : "")}
                onClick={() => toggle(t)}
                aria-label={t.done ? "Mark as not done" : "Mark as done"}
              >
                {t.done ? "✓" : ""}
              </button>
              <span className="ttitle">{t.title}</span>
              <button
                className="del"
                onClick={() => remove(t.id)}
                aria-label="Delete task"
                title="Delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <button className="clear-done" onClick={clearDone}>
          Clear {doneCount} completed
        </button>
      )}
    </main>
  );
}
