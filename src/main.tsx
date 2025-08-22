import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import AuthCallback from "./routes/AuthCallback";
import EmailVerification from "./routes/EmailVerification";
import ForgotPasswordPage from "./routes/ForgotPasswordPage";
import ResetPasswordPage from "./routes/ResetPasswordPage";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { queryClient } from "./lib/queryClient";
import "./index.css";
// import { SidebarProvider } from './components/ui/sidebar';
import { HeroUIProvider } from "@heroui/react";
import { Loader } from "./components/ui/loader";

// Auth guard component to handle routing
const AuthGuard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 rounded-xl grid place-items-center">
          <Loader variant="circular" className="size-5" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
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
        path="/forgot-password"
        element={user ? <Navigate to="/app" replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={user ? <Navigate to="/app" replace /> : <ResetPasswordPage />}
      />

      {/* Auth callback route */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Email verification routes (both clean and legacy URLs) */}
      <Route path="/verify/:token" element={<EmailVerification />} />
      <Route path="/auth/verify" element={<EmailVerification />} />

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
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme={"system"} storageKey="vite-ui-theme">
      <HeroUIProvider>
        <AuthProvider>
          <Router>
            <AuthGuard />
          </Router>
        </AuthProvider>
      </HeroUIProvider>
    </ThemeProvider>
    {/* <ReactQueryDevtools initialIsOpen={false}  /> */}
  </QueryClientProvider>
);
