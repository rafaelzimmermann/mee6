import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const { state } = useAuth();

  if (state === 'loading')          return <div>Loading…</div>;
  if (state === 'setup_required')   return <Navigate to="/setup" replace />;
  if (state === 'unauthenticated')  return <Navigate to="/login" replace />;
  return children;
}
