import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { OwnerDashboard } from './OwnerDashboard';
import { ViewerDashboard } from './ViewerDashboard';

export const DashboardRouter = () => {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  if (user?.role === 'viewer') {
    return <ViewerDashboard />;
  }

  // Default to Owner dashboard for regular owner accounts
  return <OwnerDashboard />;
};
