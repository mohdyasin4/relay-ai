import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';

// Main dashboard component (your existing app logic)
const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="h-screen w-screen text-slate-800 dark:text-slate-200 flex font-sans antialiased">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Welcome, {user?.name}!</h1>
            <button 
              onClick={logout} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </header>
          
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <p className="text-slate-600 dark:text-slate-400">
              This is your protected dashboard. Only authenticated users can see this content.
            </p>
            
            {/* Here you would integrate your existing chat components */}
            <div className="mt-6 p-4 bg-slate-200 dark:bg-slate-700 rounded">
              <p className="text-sm text-slate-500">
                Replace this section with your existing Sidebar, ChatView, and other components.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Auth guard component
const AuthGuard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/register" 
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} 
      />
      
      {/* Protected routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Default redirect */}
      <Route 
        path="/" 
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
      />
      
      {/* Catch all - redirect to login */}
      <Route 
        path="*" 
        element={<Navigate to="/login" replace />} 
      />
    </Routes>
  );
};

const AppWithAuth: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AuthGuard />
      </Router>
    </AuthProvider>
  );
};

export default AppWithAuth;
