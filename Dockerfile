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
COPY db/ ./db/
COPY .agntrick.yaml ./

# Install Playwright browser binaries to a fixed path accessible by the mee6 user.
# PLAYWRIGHT_BROWSERS_PATH overrides the default ~/.cache/ms-playwright so
# the root-owned install step is still readable at runtime as mee6.
ENV PLAYWRIGHT_BROWSERS_PATH=/app/playwright-browsers
RUN /app/.venv/bin/python -m playwright install --with-deps chromium \
    && chmod -R a+rX /app/playwright-browsers

# Create writable directories for mee6 user.
# /home/mee6/.config is created here (owned by mee6) so that Docker doesn't
# create it as root when bind-mounting a subdirectory (e.g. .config/agntrick).
RUN mkdir -p /app/data /home/mee6/.config /home/mee6/storage \
    && chown mee6:mee6 /app/data /home/mee6/.config /home/mee6/storage

USER mee6

ENV PATH="/app/.venv/bin:$PATH"
# Direct browser_use config/profiles to /app/data so the mee6 user can write there.
ENV BROWSER_USE_CONFIG_DIR=/app/data/browseruse

EXPOSE 8080

ENTRYPOINT ["uvicorn", "mee6.web.app:app", "--host", "0.0.0.0", "--port", "8080"]
