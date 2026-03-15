import { useState } from 'react';
import { changePassword } from '../../api/auth';
import toast from 'react-hot-toast';

export function AdminSection() {
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const data = new FormData(e.currentTarget);
    const currentPassword = data.get('current_password') as string;
    const newPassword = data.get('new_password') as string;
    const newPasswordConfirmation = data.get('new_password_confirmation') as string;

    if (newPassword !== newPasswordConfirmation) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword, newPasswordConfirmation);
      toast.success('Password changed successfully');
      e.currentTarget.reset();
    } catch (err: any) {
      setError(err.message ?? 'Failed to change password');
      toast.error('Failed to change password');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Change Password</h2>
        <p className="text-sm text-gray-600 mb-4">Update your admin password. Minimum 8 characters.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="new_password_confirmation" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            id="new_password_confirmation"
            name="new_password_confirmation"
            type="password"
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Change Password
        </button>
      </form>
    </div>
  );
}
