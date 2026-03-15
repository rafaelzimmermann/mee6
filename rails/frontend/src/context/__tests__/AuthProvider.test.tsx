import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import * as auth from '../../api/auth';

vi.mock('../../api/auth');

function TestComponent() {
  const { state, login, logout } = useAuth();
  return (
    <div>
      <div>State: {state}</div>
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls checkSetupRequired on mount', async () => {
    const mockCheckSetupRequired = vi.mocked(auth.checkSetupRequired).mockResolvedValue({ setup_required: false });
    const mockCheckMe = vi.mocked(auth.checkMe).mockResolvedValue(true);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockCheckSetupRequired).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockCheckMe).toHaveBeenCalled();
    });
  });

  it('sets state to setup_required when API returns true', async () => {
    vi.mocked(auth.checkSetupRequired).mockResolvedValue({ setup_required: true });
    vi.mocked(auth.checkMe).mockResolvedValue(true);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('State: setup_required')).toBeInTheDocument();
    });
  });

  it('sets state to authenticated when setup is not required and checkMe returns true', async () => {
    vi.mocked(auth.checkSetupRequired).mockResolvedValue({ setup_required: false });
    vi.mocked(auth.checkMe).mockResolvedValue(true);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('State: authenticated')).toBeInTheDocument();
    });
  });

  it('sets state to unauthenticated when setup is not required and checkMe returns false', async () => {
    vi.mocked(auth.checkSetupRequired).mockResolvedValue({ setup_required: false });
    vi.mocked(auth.checkMe).mockResolvedValue(false);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('State: unauthenticated')).toBeInTheDocument();
    });
  });

  it('sets state to authenticated when login() is called', async () => {
    vi.mocked(auth.checkSetupRequired).mockResolvedValue({ setup_required: false });
    vi.mocked(auth.checkMe).mockResolvedValue(false);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('State: unauthenticated')).toBeInTheDocument();
    });

    const loginButton = screen.getByText('Login');
    loginButton.click();

    await waitFor(() => {
      expect(screen.getByText('State: authenticated')).toBeInTheDocument();
    });
  });

  it('sets state to unauthenticated when logout() is called', async () => {
    vi.mocked(auth.checkSetupRequired).mockResolvedValue({ setup_required: false });
    vi.mocked(auth.checkMe).mockResolvedValue(true);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('State: authenticated')).toBeInTheDocument();
    });

    const logoutButton = screen.getByText('Logout');
    logoutButton.click();

    await waitFor(() => {
      expect(screen.getByText('State: unauthenticated')).toBeInTheDocument();
    });
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used inside AuthProvider');
  });
});
