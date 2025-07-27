# Authentication Setup for Vite React Project

This guide shows how to implement a complete authentication system in your Vite React TypeScript project.

## 📁 Project Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # Authentication context and provider
├── components/
│   ├── auth/
│   │   ├── LoginPage.tsx        # Login form component
│   │   ├── RegisterPage.tsx     # Registration form component
│   │   └── ProtectedRoute.tsx   # Route protection component
│   └── ui/                      # Your existing UI components
├── AppWithAuth.tsx              # Example app with authentication
└── ...
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install react-router-dom
npm install --save-dev @types/react-router-dom  # If using TypeScript
```

### 2. Files Created

#### AuthContext.tsx
- Provides authentication state management
- Handles login, register, and logout functionality
- Uses localStorage for session persistence
- Mock authentication (replace with real API calls)

#### LoginPage.tsx
- Beautiful login form with validation
- Email and password fields
- Form validation and error handling
- Demo credentials: `demo@example.com` / `password`

#### RegisterPage.tsx
- Registration form with name, email, password fields
- Password confirmation
- Terms and conditions checkbox
- Form validation

#### ProtectedRoute.tsx
- Wrapper component for protected routes
- Redirects to login if user is not authenticated
- Shows loading state while checking authentication

## 🔧 Integration with Your Existing App

### Option 1: Replace Your Current App.tsx

Replace your current `App.tsx` with the authentication-enabled version:

```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';

// Your existing components
import YourExistingApp from './YourExistingApp';

const AppWithAuth: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected routes */}
          <Route 
            path="/app/*" 
            element={
              <ProtectedRoute>
                <YourExistingApp />
              </ProtectedRoute>
            } 
          />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/app" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default AppWithAuth;
```

### Option 2: Wrap Specific Components

Wrap individual components or routes that need protection:

```tsx
import ProtectedRoute from './components/auth/ProtectedRoute';

function MyProtectedComponent() {
  return (
    <ProtectedRoute>
      <YourComponent />
    </ProtectedRoute>
  );
}
```

## 🎨 Customization

### Styling
- Uses Tailwind CSS classes
- Fully responsive design
- Dark mode support
- Customize colors and styling as needed

### Authentication Logic
Replace the mock authentication in `AuthContext.tsx` with your real API:

```tsx
const login = async (email: string, password: string) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      const userData = await response.json();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return { success: true };
    } else {
      return { success: false, error: 'Invalid credentials' };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};
```

## 🔒 Security Considerations

1. **Token Storage**: Consider using secure storage instead of localStorage
2. **HTTPS**: Always use HTTPS in production
3. **Token Expiration**: Implement token refresh logic
4. **Input Validation**: Add server-side validation
5. **Rate Limiting**: Implement rate limiting for login attempts

## 🧪 Testing

Demo credentials for testing:
- **Email**: `demo@example.com`
- **Password**: `password`

## 📝 Features Included

- ✅ Login and registration forms
- ✅ Form validation with error messages
- ✅ Protected routes
- ✅ Authentication state management
- ✅ Session persistence
- ✅ Loading states
- ✅ Responsive design
- ✅ TypeScript support
- ✅ Dark mode support

## 🚀 Next Steps

1. Replace mock authentication with real API calls
2. Add password reset functionality
3. Implement social login (Google, GitHub, etc.)
4. Add user profile management
5. Implement role-based access control
6. Add email verification

This authentication system provides a solid foundation that you can extend based on your specific requirements!
