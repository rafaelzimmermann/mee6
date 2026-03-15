import { api } from './client';

export async function checkSetupRequired(): Promise<{ setup_required: boolean }> {
  return api.get('/auth/setup_required');
}

export async function checkMe(): Promise<boolean> {
  try {
    await api.get('/auth/me');
    return true;
  } catch {
    return false;
  }
}

export async function login(password: string): Promise<void> {
  await api.post('/auth/login', { password });
}

export async function logout(): Promise<void> {
  await api.delete('/auth/logout');
}

export async function setup(password: string, passwordConfirmation: string): Promise<void> {
  await api.post('/auth/setup', { password, password_confirmation: passwordConfirmation });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirmation: string,
): Promise<void> {
  await api.put('/auth/password', {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPasswordConfirmation,
  });
}
