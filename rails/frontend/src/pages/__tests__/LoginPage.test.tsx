import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import * as auth from '../../api/auth';

vi.mock('../../api/auth');
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders password field and submit button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Admin Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('calls login() API function and navigates to / on success', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.mocked(auth.login).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText('Admin Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(passwordInput, 'correctpass');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('correctpass');
    });
  });

  it('shows "Invalid password" on 401', async () => {
    const user = userEvent.setup();
    vi.mocked(auth.login).mockRejectedValue(new Error('Unauthorized'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText('Admin Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });

    await user.type(passwordInput, 'wrongpass');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid password')).toBeInTheDocument();
    });
  });
});
