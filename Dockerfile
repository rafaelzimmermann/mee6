# Builder stage
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Runtime stage
FROM python:3.12-slim AS runtime

RUN useradd -m -u 1000 mee6

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY mee6/ ./mee6/
COPY .agntrick.yaml ./

RUN mkdir -p /app/data && chown mee6:mee6 /app/data

USER mee6

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080

ENTRYPOINT ["uvicorn", "mee6.web.app:app", "--host", "0.0.0.0", "--port", "8080"]
