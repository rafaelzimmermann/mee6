# Task 015 — Admin Authentication

## Goal

Add a single-admin-password authentication layer to the application, modelled
after Pi-hole: one password protects the entire UI, first-run prompts the user
to set it, and the password can be changed later from the admin settings view.

No multi-user support, no role system — just "authenticated" or "not
authenticated".

---

## Prerequisites

- Task 001 complete: Rails scaffold in place.
- Task 002 complete: database migrations runnable.
- Task 003 complete: `BaseController` and API structure established.

This task must be completed before Tasks 010–013 (React views) so the auth
context and protected routes are available when building the rest of the UI.

---

## Implementation steps

### 1. Migration

`rails/db/migrate/YYYYMMDDHHMMSS_create_admin_credentials.rb`

```ruby
class CreateAdminCredentials < ActiveRecord::Migration[7.1]
  def change
    create_table :admin_credentials do |t|
      t.string :password_digest, null: false
      t.timestamps
    end
  end
end
```

Only one row will ever exist. The `AdminCredential.configured?` helper checks
for its presence.

---

### 2. `AdminCredential` model

`rails/app/models/admin_credential.rb`

```ruby
class AdminCredential < ApplicationRecord
  has_secure_password

  validates :password, length: { minimum: 8 }, on: :create
  validates :password, length: { minimum: 8 }, allow_nil: true, on: :update

  def self.configured?
    exists?
  end

  def self.instance
    first
  end
end
```

`has_secure_password` requires `bcrypt` in the Gemfile (add it if not already
present).

---

### 3. Session middleware

Rails API mode strips session middleware by default. Add it back in
`rails/config/application.rb`:

```ruby
config.middleware.use ActionDispatch::Cookies
config.middleware.use ActionDispatch::Session::CookieStore,
  key:          "_mee6_session",
  expire_after: 30.days,
  httponly:     true,
  same_site:    :strict,
  secure:       Rails.env.production?
```

---

### 4. `ApplicationController` — auth guard

`rails/app/controllers/application_controller.rb`

```ruby
class ApplicationController < ActionController::API
  include ActionController::Cookies

  before_action :require_auth

  private

  def require_auth
    unless session[:admin]
      render json: { error: "Unauthorized" }, status: :unauthorized
    end
  end
end
```

---

### 5. `Api::V1::AuthController`

`rails/app/controllers/api/v1/auth_controller.rb`

All endpoints except `setup_required`, `setup`, and `login` require an
established session (inherited `before_action :require_auth`).

```ruby
module Api
  module V1
    class AuthController < ApplicationController
      skip_before_action :require_auth, only: [:setup_required, :setup, :login]

      # GET /api/v1/auth/setup_required
      # Returns { setup_required: true } when no admin password has been set yet.
      # The React app checks this on mount to decide whether to show /setup.
      def setup_required
        render json: { setup_required: !AdminCredential.configured? }
      end

      # POST /api/v1/auth/setup
      # Body: { password:, password_confirmation: }
      # Only succeeds when no credential exists yet (first run).
      def setup
        if AdminCredential.configured?
          render json: { error: "Already configured" }, status: :forbidden
          return
        end

        AdminCredential.create!(
          password:              params[:password],
          password_confirmation: params[:password_confirmation]
        )
        session[:admin] = true
        render json: { ok: true }
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/auth/login
      # Body: { password: }
      def login
        credential = AdminCredential.instance
        if credential&.authenticate(params[:password])
          session[:admin] = true
          render json: { ok: true }
        else
          render json: { error: "Invalid password" }, status: :unauthorized
        end
      end

      # DELETE /api/v1/auth/logout
      def logout
        session.delete(:admin)
        head :ok
      end

      # GET /api/v1/auth/me
      # Returns 200 when the session is valid. The React app uses this to
      # distinguish "not logged in" from "needs setup".
      def me
        render json: { authenticated: true }
      end

      # PUT /api/v1/auth/password
      # Body: { current_password:, new_password:, new_password_confirmation: }
      def change_password
        credential = AdminCredential.instance
        unless credential&.authenticate(params[:current_password])
          render json: { error: "Current password is incorrect" }, status: :unauthorized
          return
        end

        credential.update!(
          password:              params[:new_password],
          password_confirmation: params[:new_password_confirmation]
        )
        render json: { ok: true }
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end
    end
  end
end
```

---

### 6. Routes

`rails/config/routes.rb`

Add these routes to the existing `namespace :api` block and its `namespace :v1` sub-block. Do not replace the entire file.

```ruby
namespace :api do
  namespace :v1 do
    get    "auth/setup_required", to: "auth#setup_required"
    post   "auth/setup",          to: "auth#setup"
    post   "auth/login",          to: "auth#login"
    delete "auth/logout",         to: "auth#logout"
    get    "auth/me",             to: "auth#me"
    put    "auth/password",       to: "auth#change_password"
  end
end
```

---

### 7. Webhook exemption

`Webhooks::WhatsAppController` must **not** require a session — it uses the
`X-Webhook-Secret` header instead. Skip `require_auth` there:

```ruby
module Webhooks
  class WhatsAppController < ApplicationController
    skip_before_action :require_auth
    before_action :verify_secret
    # ...
  end
end
```

---

### 8. React — auth context

`rails/frontend/src/context/AuthContext.tsx`

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { checkMe, checkSetupRequired } from '../api/auth';

type AuthState = 'loading' | 'setup_required' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  state: AuthState;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    (async () => {
      const { setup_required } = await checkSetupRequired();
      if (setup_required) { setState('setup_required'); return; }
      const ok = await checkMe();
      setState(ok ? 'authenticated' : 'unauthenticated');
    })();
  }, []);

  const login  = () => setState('authenticated');
  const logout = () => setState('unauthenticated');

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

`rails/frontend/src/api/auth.ts`

```ts
import { apiClient } from './client';

export async function checkSetupRequired(): Promise<{ setup_required: boolean }> {
  return apiClient.get('/api/v1/auth/setup_required');
}

export async function checkMe(): Promise<boolean> {
  try {
    await apiClient.get('/api/v1/auth/me');
    return true;
  } catch {
    return false;
  }
}

export async function login(password: string): Promise<void> {
  await apiClient.post('/api/v1/auth/login', { password });
}

export async function logout(): Promise<void> {
  await apiClient.delete('/api/v1/auth/logout');
}

export async function setup(password: string, passwordConfirmation: string): Promise<void> {
  await apiClient.post('/api/v1/auth/setup', { password, password_confirmation: passwordConfirmation });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirmation: string,
): Promise<void> {
  await apiClient.put('/api/v1/auth/password', {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPasswordConfirmation,
  });
}
```

---

### 9. React — protected route wrapper

`rails/frontend/src/components/auth/RequireAuth.tsx`

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { state } = useAuth();

  if (state === 'loading')          return <div>Loading…</div>;
  if (state === 'setup_required')   return <Navigate to="/setup" replace />;
  if (state === 'unauthenticated')  return <Navigate to="/login" replace />;
  return children;
}
```

Wrap all application routes with `<RequireAuth>` in the router config.

---

### 10. `SetupPage`

`rails/frontend/src/pages/SetupPage.tsx`

Shown on first run when `setup_required: true`. Presents a "Set admin
password" form with password + confirm-password fields. On success, calls
`login()` from auth context and navigates to `/`.

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setup } from '../api/auth';

export default function SetupPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = data.get('password') as string;
    const confirm  = data.get('confirm')  as string;
    if (password !== confirm) { setError('Passwords do not match'); return; }
    try {
      await setup(password, confirm);
      login();
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Setup failed');
    }
  }

  return (
    <div>
      <h1>Welcome to Mee6</h1>
      <p>Set an admin password to get started.</p>
      <form onSubmit={handleSubmit}>
        <input name="password" type="password" placeholder="Password (min 8 chars)" required />
        <input name="confirm"  type="password" placeholder="Confirm password"       required />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Set Password</button>
      </form>
    </div>
  );
}
```

---

### 11. `LoginPage`

`rails/frontend/src/pages/LoginPage.tsx`

Presented when the session has expired or the user logs out.

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data     = new FormData(e.currentTarget);
    const password = data.get('password') as string;
    try {
      await apiLogin(password);
      login();
      navigate('/');
    } catch {
      setError('Invalid password');
    }
  }

  return (
    <div>
      <h1>Mee6 Admin</h1>
      <form onSubmit={handleSubmit}>
        <input name="password" type="password" placeholder="Admin password" required />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
```

---

### 12. Change-password form in admin settings

Add a "Change Password" card to the settings/admin area (can live on the
IntegrationsPage or a dedicated `/settings` route). Calls `changePassword()`
from `src/api/auth.ts`. Three fields: current password, new password, confirm
new password. Show success toast on `200`, error message otherwise.

---

### 13. Router updates

Update `rails/frontend/src/router.tsx` to:

1. Add `/setup` → `SetupPage` (no auth guard — accessible before first run)
2. Add `/login` → `LoginPage` (no auth guard)
3. Wrap all other routes in `<RequireAuth>`
4. Wrap the entire app tree in `<AuthProvider>`

```tsx
import { RequireAuth }  from './components/auth/RequireAuth';
import SetupPage        from './pages/SetupPage';
import LoginPage        from './pages/LoginPage';

// Public routes (no auth required)
{ path: '/setup', element: <SetupPage /> },
{ path: '/login', element: <LoginPage /> },

// Protected routes
{ path: '/', element: <RequireAuth><AppShell /></RequireAuth>, children: [...] },
```

---

### 14. Logout button

Add a "Sign out" button to the `AppShell` sidebar footer. Calls `apiLogout()`
then `logout()` from auth context, then navigates to `/login`.

---

## Tests

### `spec/models/admin_credential_spec.rb`

```ruby
RSpec.describe AdminCredential, type: :model do
  it { is_expected.to have_secure_password }

  it 'is invalid with a password shorter than 8 chars' do
    cred = build(:admin_credential, password: 'short')
    expect(cred).not_to be_valid
  end

  describe '.configured?' do
    it 'returns false when no record exists' do
      expect(AdminCredential.configured?).to be false
    end

    it 'returns true after a credential is created' do
      create(:admin_credential)
      expect(AdminCredential.configured?).to be true
    end
  end
end
```

### `spec/requests/api/v1/auth_spec.rb`

Key cases:

**setup_required**
- `GET /api/v1/auth/setup_required` → `{ setup_required: true }` when no record
- `GET /api/v1/auth/setup_required` → `{ setup_required: false }` when record exists

**setup**
- `POST /api/v1/auth/setup` with valid password → 200, sets session
- `POST /api/v1/auth/setup` with mismatched confirmation → 422
- `POST /api/v1/auth/setup` when already configured → 403

**login**
- `POST /api/v1/auth/login` with correct password → 200, sets session
- `POST /api/v1/auth/login` with wrong password → 401

**require_auth guard**
- Any authenticated endpoint without session → 401
- Webhook endpoint (`POST /webhooks/whatsapp`) reachable without session (uses header secret instead)

**change_password**
- `PUT /api/v1/auth/password` with correct current password → 200
- `PUT /api/v1/auth/password` with wrong current password → 401

**logout**
- `DELETE /api/v1/auth/logout` → 200, session cleared (subsequent `GET /api/v1/auth/me` → 401)

### React component tests

**`SetupPage.test.tsx`**
- Renders password + confirm fields and submit button
- Shows "Passwords do not match" when fields differ
- Calls `setup()` API function and navigates to `/` on success
- Shows error message on API failure

**`LoginPage.test.tsx`**
- Renders password field and submit button
- Calls `login()` API function and navigates to `/` on success
- Shows "Invalid password" on 401

**`RequireAuth.test.tsx`**
- Renders children when state is `authenticated`
- Redirects to `/login` when `unauthenticated`
- Redirects to `/setup` when `setup_required`
- Shows loading indicator when `loading`

**`AuthProvider.test.tsx`**
- Calls `checkSetupRequired` on mount
- Sets state to `setup_required` when API returns true
- Sets state to `authenticated` when setup is not required and `checkMe` returns true
- Sets state to `unauthenticated` when not authenticated

---

## File / class list

| Path | Description |
|---|---|
| `rails/db/migrate/..._create_admin_credentials.rb` | Single-row credentials table |
| `rails/app/models/admin_credential.rb` | has_secure_password, configured? helper |
| `rails/app/controllers/application_controller.rb` | Session middleware include + require_auth guard |
| `rails/app/controllers/api/v1/auth_controller.rb` | setup_required, setup, login, logout, me, change_password |
| `rails/config/routes.rb` | Auth routes |
| `rails/frontend/src/context/AuthContext.tsx` | Auth state machine, AuthProvider, useAuth hook |
| `rails/frontend/src/api/auth.ts` | API functions for all auth endpoints |
| `rails/frontend/src/components/auth/RequireAuth.tsx` | Route guard component |
| `rails/frontend/src/pages/SetupPage.tsx` | First-run password setup |
| `rails/frontend/src/pages/LoginPage.tsx` | Login form |
| `rails/spec/models/admin_credential_spec.rb` | Model specs |
| `rails/spec/requests/api/v1/auth_spec.rb` | Request specs |
| `rails/frontend/src/pages/SetupPage.test.tsx` | Setup page component tests |
| `rails/frontend/src/pages/LoginPage.test.tsx` | Login page component tests |
| `rails/frontend/src/components/auth/RequireAuth.test.tsx` | Route guard tests |
| `rails/frontend/src/context/AuthProvider.test.tsx` | Auth context tests |

---

## Acceptance criteria

- [ ] `GET /api/v1/auth/setup_required` returns `{ setup_required: true }` on a
      fresh database with no admin credential
- [ ] `POST /api/v1/auth/setup` with a valid password creates the credential and
      establishes a session; subsequent `GET /api/v1/auth/me` returns 200
- [ ] `POST /api/v1/auth/setup` when a credential already exists returns 403
- [ ] `POST /api/v1/auth/login` with the correct password establishes a session
- [ ] `POST /api/v1/auth/login` with a wrong password returns 401
- [ ] Any API endpoint (e.g. `GET /api/v1/pipelines`) returns 401 without a
      valid session
- [ ] `POST /webhooks/whatsapp` is reachable without a session (uses
      `X-Webhook-Secret` header auth instead)
- [ ] `PUT /api/v1/auth/password` with correct current password updates the
      credential; old password no longer authenticates
- [ ] React app redirects to `/setup` on first run (setup_required: true)
- [ ] React app redirects to `/login` when unauthenticated
- [ ] Authenticated React app renders the main `AppShell` without redirecting
- [ ] `bundle exec rspec spec/models/admin_credential_spec.rb spec/requests/api/v1/auth_spec.rb`
      passes with zero failures
- [ ] `npx vitest run src/pages/SetupPage.test.tsx src/pages/LoginPage.test.tsx
      src/components/auth/RequireAuth.test.tsx src/context/AuthProvider.test.tsx`
      passes with zero failures
