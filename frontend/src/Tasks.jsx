import { useEffect, useState } from "react";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

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
        setTasks((prev) => [task, ...prev]);
        setTitle("");
      })
      .catch(() => {});
  }

  function toggle(task) {
    // optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
    );
    fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    })
      .then(load)
      .catch(load);
  }

  function remove(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function clearDone() {
    setTasks((prev) => prev.filter((t) => !t.done));
    fetch("/api/tasks/completed", { method: "DELETE" }).catch(() => {});
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
          {tasks.map((t) => (
            <li key={t.id} className={t.done ? "done" : ""}>
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
