import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
import { MyDocumentsPage } from './pages/documents/MyDocumentsPage';
import { SharedDocumentsPage } from './pages/documents/SharedDocumentsPage';
import { SearchPage } from './pages/documents/SearchPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { UserManagementPage } from './pages/users/UserManagementPage';
import { ProfileSettingsPage } from './pages/profile/ProfileSettingsPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Route guard for authenticated users
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B0A] flex items-center justify-center">
        <LoadingSpinner text="Authenticating vault session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Route guard for unauthenticated users (login/register)
const PublicRoute = ({ children }) => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B0A] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            {/* Protected App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardRouter />} />
              <Route path="documents" element={<MyDocumentsPage />} />
              <Route path="shared" element={<SharedDocumentsPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route path="settings" element={<ProfileSettingsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
