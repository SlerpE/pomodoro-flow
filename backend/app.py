import os
import sqlite3
from datetime import datetime, date
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = os.environ.get("POMO_DB", str(BASE_DIR / "data" / "pomodoro.db"))

# static_folder=None: we serve assets + SPA fallback ourselves (see serve_spa),
# otherwise Flask's built-in static route would 404 on unknown paths instead of
# falling back to index.html.
app = Flask(__name__, static_folder=None)


def get_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                mode       TEXT NOT NULL,
                minutes    INTEGER NOT NULL,
                label      TEXT,
                finished_at TEXT NOT NULL,
                day        TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT NOT NULL,
                done       INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                position   INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        # migrate older DBs that predate the manual-ordering column
        cols = [r[1] for r in conn.execute("PRAGMA table_info(tasks)")]
        if "position" not in cols:
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0"
            )
        conn.commit()


@app.route("/api/health")
def health():
    return jsonify(status="ok", time=datetime.utcnow().isoformat() + "Z")


@app.route("/api/sessions", methods=["POST"])
def add_session():
    payload = request.get_json(force=True, silent=True) or {}
    mode = str(payload.get("mode", "focus"))[:32]
    minutes = int(payload.get("minutes", 0))
    label = (payload.get("label") or "")[:120]
    now = datetime.utcnow()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions (mode, minutes, label, finished_at, day) VALUES (?,?,?,?,?)",
            (mode, minutes, label, now.isoformat() + "Z", date.today().isoformat()),
        )
        conn.commit()
    return jsonify(ok=True), 201


@app.route("/api/stats")
def stats():
    today = date.today().isoformat()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT COUNT(*) c, COALESCE(SUM(minutes),0) m FROM sessions "
            "WHERE mode='focus' AND day=?",
            (today,),
        ).fetchone()
        total = conn.execute(
            "SELECT COUNT(*) c, COALESCE(SUM(minutes),0) m FROM sessions WHERE mode='focus'"
        ).fetchone()
        recent = conn.execute(
            "SELECT mode, minutes, label, finished_at FROM sessions "
            "ORDER BY id DESC LIMIT 8"
        ).fetchall()
    return jsonify(
        today={"count": rows["c"], "minutes": rows["m"]},
        total={"count": total["c"], "minutes": total["m"]},
        recent=[dict(r) for r in recent],
    )


# --- Task tracker (independent of the Pomodoro timer) ---
def task_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "done": bool(row["done"]),
        "created_at": row["created_at"],
    }


@app.route("/api/tasks")
def list_tasks():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM tasks ORDER BY position ASC, id DESC"
        ).fetchall()
    return jsonify(tasks=[task_to_dict(r) for r in rows])


@app.route("/api/tasks", methods=["POST"])
def create_task():
    payload = request.get_json(force=True, silent=True) or {}
    title = (payload.get("title") or "").strip()[:200]
    if not title:
        return jsonify(error="title required"), 400
    with get_db() as conn:
        # new tasks land at the bottom (largest position)
        bottom = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM tasks"
        ).fetchone()[0]
        cur = conn.execute(
            "INSERT INTO tasks (title, done, created_at, position) VALUES (?,0,?,?)",
            (title, datetime.utcnow().isoformat() + "Z", bottom + 1),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(task_to_dict(row)), 201


@app.route("/api/tasks/reorder", methods=["POST"])
def reorder_tasks():
    payload = request.get_json(force=True, silent=True) or {}
    order = payload.get("order") or []
    with get_db() as conn:
        for idx, tid in enumerate(order):
            conn.execute("UPDATE tasks SET position=? WHERE id=?", (idx, int(tid)))
        conn.commit()
    return jsonify(ok=True)


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    payload = request.get_json(force=True, silent=True) or {}
    fields, values = [], []
    if "done" in payload:
        fields.append("done=?")
        values.append(1 if payload["done"] else 0)
    if "title" in payload:
        title = (payload.get("title") or "").strip()[:200]
        if not title:
            return jsonify(error="title required"), 400
        fields.append("title=?")
        values.append(title)
    if not fields:
        return jsonify(error="nothing to update"), 400
    values.append(task_id)
    with get_db() as conn:
        conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id=?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        return jsonify(error="not found"), 404
    return jsonify(task_to_dict(row))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as conn:
        conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        conn.commit()
    return jsonify(ok=True)


@app.route("/api/tasks/completed", methods=["DELETE"])
def clear_completed():
    with get_db() as conn:
        conn.execute("DELETE FROM tasks WHERE done=1")
        conn.commit()
    return jsonify(ok=True)


# --- Serve the built React app (single-container setup) ---
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    target = STATIC_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(str(STATIC_DIR), path)
    return send_from_directory(str(STATIC_DIR), "index.html")


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 9174)))
