import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SetupPage from '../SetupPage';
import * as auth from '../../api/auth';

vi.mock('../../api/auth');
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe('SetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders password and confirm fields and submit button', () => {
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeInTheDocument();
  });

  it('shows "Passwords do not match" when fields differ', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Set Password' });

    await user.type(passwordInput, 'password123');
    await user.type(confirmInput, 'different123');
    await user.click(submitButton);

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('calls setup() API function and navigates to / on success', async () => {
    const user = userEvent.setup();
    const mockSetup = vi.mocked(auth.setup).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Set Password' });

    await user.type(passwordInput, 'password123');
    await user.type(confirmInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSetup).toHaveBeenCalledWith('password123', 'password123');
    });
  });

  it('shows error message on API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(auth.setup).mockRejectedValue(new Error('Setup failed'));

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText('Password');
    const confirmInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Set Password' });

    await user.type(passwordInput, 'password123');
    await user.type(confirmInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Setup failed')).toBeInTheDocument();
    });
  });
});
