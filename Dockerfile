# Builder stage
FROM python:3.12-slim AS builder

# Use the official uv binary instead of pip install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies only — source not needed yet, keeps this layer cached
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Runtime stage
FROM python:3.12-slim AS runtime

# libmagic: agntrick-whatsapp (neonize); Playwright system deps installed via playwright CLI
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 mee6

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY mee6/ ./mee6/
COPY .agntrick.yaml ./

# Install Playwright browser binaries (Chromium used by browser-use)
RUN /app/.venv/bin/playwright install --with-deps chromium

RUN mkdir -p /app/data && chown mee6:mee6 /app/data

USER mee6

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080

ENTRYPOINT ["uvicorn", "mee6.web.app:app", "--host", "0.0.0.0", "--port", "8080"]
