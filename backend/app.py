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
