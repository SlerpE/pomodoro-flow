# 🍅 Pomodoro Flow

A slick, single-container Pomodoro timer — **Flask + React**, served from one image via Docker Compose.

![stack](https://img.shields.io/badge/stack-Flask%20%2B%20React-ff5f6d) ![container](https://img.shields.io/badge/container-single-22d3ee) ![port](https://img.shields.io/badge/port-2570-a78bfa)

## Features

- **Glassmorphism UI** with animated aurora background and a live circular progress ring.
- **Focus / Short break / Long break** modes with automatic 4-cycle rotation.
- **Auto-start** the next session (toggleable).
- **Persistent stats** — today / all-time focus sessions and minutes, stored in SQLite.
- **Wall-clock timer** that stays accurate even when the tab is throttled.
- **One container**: React is built at image-build time and served as static files by Flask; the same process exposes the `/api` backend.

## Run

```bash
docker compose up -d --build
```

Then open **http://localhost:2570**

The service uses `restart: always`, so it **auto-starts** with the Docker daemon (i.e. on boot).

Stop it with:

```bash
docker compose down
```

## Ports

| Host   | Container | Purpose            |
| ------ | --------- | ------------------ |
| `2570` | `9174`    | Web UI + JSON API  |

## Development (without Docker)

```bash
# backend
cd backend && pip install -r requirements.txt && python app.py   # :9174

# frontend (separate terminal)
cd frontend && npm install && npm run dev                         # :9175, proxies /api
```

## API

| Method | Route            | Description                        |
| ------ | ---------------- | ---------------------------------- |
| GET    | `/api/health`    | Liveness probe                     |
| POST   | `/api/sessions`  | Record a finished focus session    |
| GET    | `/api/stats`     | Today / all-time totals + recents  |

## Layout

```
backend/    Flask app (API + serves built SPA), SQLite persistence
frontend/   Vite + React single-page app
Dockerfile  multi-stage: node build -> python runtime
docker-compose.yml   single service, autostart, data volume
```
