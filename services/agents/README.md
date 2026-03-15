# Agents Service

FastAPI microservice for AI agent execution (LLM, Browser, Calendar).

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

- `GET /schema` - Get available agent types and their input fields
- `POST /run` - Execute an agent

## Agent Types

- **llm_agent**: Text generation with Anthropic Claude
- **browser_agent**: Web automation tasks
- **calendar_agent**: Google Calendar operations

## Architecture

- **Framework**: FastAPI with uvicorn
- **LLM Provider**: Anthropic Claude
- **Testing**: pytest
