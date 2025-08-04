import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import AuthCallback from './routes/AuthCallback';
import App from './App';
import { ThemeProvider } from "@/components/theme-provider"
import "./index.css";
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';

// Auth guard component to handle routing
const AuthGuard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/app" replace /> : <LoginPage />} 
      />
      <Route 
        path="/register" 
        element={user ? <Navigate to="/app" replace /> : <RegisterPage />} 
      />
      <Route
        path='/forgot-password'
        element={user ? <Navigate to="/app" replace/> : <ForgotPasswordPage />}
      />
      
      {/* Auth callback route */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Protected routes */}
      <Route 
        path="/app" 
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } 
      />
      
      {/* Default redirect */}
      <Route 
        path="/" 
        element={<Navigate to={user ? "/app" : "/login"} replace />} 
      />
      
      {/* Catch all - redirect to login */}
      <Route 
        path="*" 
        element={<Navigate to="/login" replace />} 
      />
    </Routes>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
    <AuthProvider>
      <Router>
        <AuthGuard />
      </Router>
    </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);