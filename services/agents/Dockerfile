FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir ".[dev]"

# Install Playwright browsers to a fixed path accessible by non-root user
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN playwright install --with-deps chromium \
    && chmod -R a+rx /ms-playwright

# Create directory for secrets
RUN mkdir -p /run/secrets && chown -R nobody:nogroup /run/secrets

# Switch to non-root user
USER nobody

# Expose port
EXPOSE 8001

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
