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
import { SidebarProvider } from './components/ui/sidebar';
import { Loader2 } from 'lucide-react';

// Auth guard component to handle routing
const AuthGuard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4"/>
          <p className="text-neutral-400 dark:text-neutral-600">Loading...</p>
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
  <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
    <AuthProvider>
      <Router>
        <AuthGuard />
      </Router>
    </AuthProvider>
  </ThemeProvider>
);