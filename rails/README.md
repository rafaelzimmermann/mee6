# mee6 Rails API + React Frontend

Rails API application with embedded React SPA (Vite + TypeScript).

## Development

```bash
# Install dependencies
bundle install
cd frontend && npm install

# Run Rails server
bundle exec rails server

# Run React dev server (with hot reload, proxies /api to Rails)
cd frontend && npm run dev

# Build React SPA for production
cd frontend && npm run build

# Run tests
bundle exec rspec
cd frontend && npm test -- --run
```

## API Endpoints

- `GET /up` - Health check
- `GET /` - Serves React SPA (in production)

## Architecture

- **Backend**: Rails 8.1 with PostgreSQL and Redis
- **Frontend**: React 19 with Vite, TypeScript, React Router, TanStack Query, React Hook Form
- **Background Jobs**: Sidekiq with cron support
- **Serialization**: Blueprint
- **Testing**: RSpec, FactoryBot, Shoulda Matchers (Rails); Vitest, Testing Library (React)
