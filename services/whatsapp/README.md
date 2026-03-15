# WhatsApp Service

FastAPI microservice for WhatsApp integration using neonize.

## Development

```bash
# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest --collect-only

# Run dev server
uvicorn app.main:app --reload
```

## API Endpoints

- `GET /status` - Connection status and QR code
- `POST /connect` - Connect to WhatsApp (returns 202)
- `POST /disconnect` - Disconnect from WhatsApp
- `GET /groups` - List WhatsApp groups
- `POST /monitor` - Register webhook for message monitoring
- `POST /send` - Send message (DM or group)

## Architecture

- **Framework**: FastAPI with uvicorn
- **WhatsApp Client**: neonize
- **State**: In-memory session with file persistence
- **Testing**: pytest
