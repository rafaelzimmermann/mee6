#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose"
FRONTEND_DIR="rails/frontend"
RAILS_CONTAINER="mee6-rails-1"

build_frontend() {
  echo "→ Building frontend..."
  (cd "$FRONTEND_DIR" && npm run build)
  echo "→ Copying assets into container..."
  docker cp rails/public/index.html "$RAILS_CONTAINER":/rails/public/index.html
  # Copy only new asset files (old hashed files can stay; they're harmless)
  for f in rails/public/assets/index-*.js rails/public/assets/index-*.css; do
    docker cp "$f" "$RAILS_CONTAINER":/rails/public/assets/
  done
  echo "→ Restarting Rails container to clear Thruster cache..."
  docker restart "$RAILS_CONTAINER"
  echo "✓ Frontend deployed"
}

case "${1:-}" in
  up)
    $COMPOSE up -d "${@:2}"
    ;;
  down)
    $COMPOSE down "${@:2}"
    ;;
  restart)
    # rebuild frontend then restart a specific service, or all if none given
    service="${2:-}"
    if [[ -z "$service" || "$service" == "rails" ]]; then
      build_frontend
    fi
    if [[ -n "$service" ]]; then
      $COMPOSE restart "$service"
    else
      $COMPOSE restart
    fi
    ;;
  deploy-frontend)
    build_frontend
    ;;
  logs)
    $COMPOSE logs -f "${@:2}"
    ;;
  *)
    echo "Usage: $0 {up|down|restart [service]|deploy-frontend|logs [service]}"
    exit 1
    ;;
esac
