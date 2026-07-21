# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# vite outputs the built SPA into /app/backend/static (see vite.config.js)
RUN npm run build

# ---- Stage 2: Flask app serving API + built SPA (single container) ----
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=9174
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/backend/static ./static

EXPOSE 9174
CMD ["gunicorn", "--bind", "0.0.0.0:9174", "--workers", "2", "--threads", "4", "app:app"]
