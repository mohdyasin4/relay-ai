import { useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "motion/react"
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { TextureButton } from "./TextureButton"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Simple validation schema
  const loginSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters')
  });

  const validateForm = (): boolean => {
    try {
      loginSchema.parse({ email, password })
      setValidationErrors({})
      return true
    } catch (error: any) {
      const errors: Record<string, string> = {}
      error.issues?.forEach((err: any) => {
        errors[err.path[0]] = err.message
      })
      setValidationErrors(errors)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Validate form data first
    const isValid = validateForm()
    
    if (!isValid) {
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        setError(error.message)
        return
      }
      
      if (data?.user) {
        console.log('Login successful, redirecting to /app');
        window.location.href = '/app'; // Use direct browser navigation instead of React Router
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Use exact current URL for the redirect
      const redirectUri = `${window.location.origin}/auth/callback`
      console.log("Using redirect URI:", redirectUri)
      
      const supabase = createClient()
      
      // Clear any existing session and local storage data to prevent conflicts
      await supabase.auth.signOut()
      
      // Clear any potential stale flow state
      localStorage.removeItem('gemini-messenger-auth')
      localStorage.removeItem('supabase.auth.token')
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          scopes: "profile email openid https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts.other.readonly",
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true'
          },
          skipBrowserRedirect: false
        }
      })
      
      if (error) {
        console.error('Error initiating Google sign in:', error)
        setError(error.message)
      } else {
        console.log('OAuth flow initiated successfully')
        // No need to navigate, the OAuth flow will redirect
      }
    } catch (err: any) {
      console.error('Unexpected error during Google sign in:', err)
      setError(err.message || 'An error occurred during sign in with Google')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form 
      className={cn("flex flex-col gap-8", className)} 
      onSubmit={handleSubmit} 
      noValidate
      {...props}
    >
      <motion.div
        className="flex flex-col items-center gap-3 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent tracking-tight">
          Welcome back
        </h1>
        <p className="text-muted-foreground text-base font-medium">
          Sign in to your account to continue
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm font-medium"
        >
          {error}
        </motion.div>
      )}
      
      <div className="grid gap-4">
        <motion.div 
          className="grid gap-3"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Label htmlFor="email" className="text-foreground font-semibold text-sm">
            Email Address
          </Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#3B37FE] transition-colors z-10 pointer-events-none" />
            <Input 
              id="email" 
              type="email" 
              placeholder="Enter your email" 
              required 
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (validationErrors.email) {
                  const { email: _, ...rest } = validationErrors
                  setValidationErrors(rest)
                }
              }}
              disabled={isLoading}
              className={cn(
                "pl-10 h-12 rounded-lg focus:border-[#3B37FE] focus:ring-[#3B37FE] transition-all duration-200 bg-background/50 backdrop-blur-sm",
                validationErrors.email && "border-destructive focus:border-destructive focus:ring-destructive"
              )}
            />
          </div>
          {validationErrors.email && (
            <p className="text-sm text-destructive mt-1">{validationErrors.email}</p>
          )}
        </motion.div>
        
        <motion.div 
          className="grid gap-3"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-foreground font-semibold text-sm">
              Password
            </Label>
            <motion.a
              href="/forgot-password"
              className="text-sm text-[#3B37FE] hover:text-[#2B27EE] font-medium transition-colors duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Forgot password?
            </motion.a>
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#3B37FE] transition-colors z-10 pointer-events-none" />
            <Input 
              id="password" 
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              required 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (validationErrors.password) {
                  const { password: _, ...rest } = validationErrors
                  setValidationErrors(rest)
                }
              }}
              disabled={isLoading}
              className={cn(
                "pl-10 pr-10 h-12 rounded-lg focus:border-[#3B37FE] focus:ring-[#3B37FE] transition-all duration-200 bg-background/50 backdrop-blur-sm",
                validationErrors.password && "border-destructive focus:border-destructive focus:ring-destructive"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {validationErrors.password && (
            <p className="text-sm text-destructive mt-1">{validationErrors.password}</p>
          )}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <TextureButton 
            variant="accent"
            type="submit" 
            color="primary"
            disabled={isLoading}
            className="w-full h-12 bg-[#3B37FE] hover:bg-[#2B27EE] text-white font-semibold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <motion.span
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? "Signing in..." : "Sign In"}
            </motion.span>
          </TextureButton>
        </motion.div>
        
        <motion.div 
          className="relative text-center text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-4 text-muted-foreground font-medium tracking-wider">
              Or continue with
            </span>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
            <TextureButton 
            variant="minimal" 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-12 transition-all duration-200 font-semibold mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <motion.span
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="flex items-center justify-center gap-2"
            >
              <FcGoogle className="w-5 h-5" />
              {isLoading ? "Signing in with Google..." : "Continue with Google"}
            </motion.span>
          </TextureButton>
        </motion.div>
      </div>
      
      <motion.div 
        className="text-center text-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <span className="text-muted-foreground">Don't have an account? </span>
        <motion.a 
          href="/register" 
          className="text-[#3B37FE] hover:text-[#2B27EE] font-semibold transition-colors duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Sign up
        </motion.a>
      </motion.div>
    </form>
  )
}
