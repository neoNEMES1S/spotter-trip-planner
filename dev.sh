#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
.venv/bin/python backend/manage.py runserver 127.0.0.1:8000 &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
cd frontend
npm run dev
