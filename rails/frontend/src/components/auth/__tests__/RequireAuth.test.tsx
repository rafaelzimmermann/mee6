import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from '../RequireAuth';
import { useAuth } from '../../../context/AuthContext';

vi.mock('../../../context/AuthContext', () => ({
  AuthProvider: ({ children }: any) => <>{children}</>,
  useAuth: vi.fn(),
}));

function TestComponent() {
  return <div>Protected Content</div>;
}

describe('RequireAuth', () => {
  it('renders children when state is authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ state: 'authenticated', login: vi.fn(), logout: vi.fn() });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireAuth>
                <TestComponent />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows loading indicator when state is loading', () => {
    vi.mocked(useAuth).mockReturnValue({ state: 'loading', login: vi.fn(), logout: vi.fn() });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireAuth>
                <TestComponent />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('redirects to /login when state is unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ state: 'unauthenticated', login: vi.fn(), logout: vi.fn() });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireAuth>
                <TestComponent />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /setup when state is setup_required', () => {
    vi.mocked(useAuth).mockReturnValue({ state: 'setup_required', login: vi.fn(), logout: vi.fn() });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireAuth>
                <TestComponent />
              </RequireAuth>
            }
          />
          <Route path="/setup" element={<div>Setup Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Setup Page')).toBeInTheDocument();
  });
});
