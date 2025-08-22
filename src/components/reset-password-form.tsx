import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "motion/react"
import { Lock, Eye, EyeOff, Loader2, CheckIcon } from "lucide-react"
import { TextureButton } from "./TextureButton"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { useNavigate, useSearchParams } from "react-router-dom"

interface ResetPasswordFormProps {
  className?: string
}

export function ResetPasswordForm({
  className,
  ...props
}: ResetPasswordFormProps & React.ComponentProps<"form">) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Password strength validation
  const resetPasswordSchema = z.object({
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

  // Session handling is now done in the parent ResetPasswordPage component

  const validateForm = (): boolean => {
    try {
      resetPasswordSchema.parse({ password, confirmPassword });
      setValidationErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setError(null)
    setSuccess(null)
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    
    try {
      const supabase = createClient()
      
      // User is already authenticated from the reset link, just update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        throw updateError
      }

      setSuccess('Password updated successfully! Signing you out and redirecting to login...')
      
      // Sign out the user and redirect to login after 3 seconds
      setTimeout(async () => {
        try {
          const supabase = createClient()
          await supabase.auth.signOut()
          navigate('/login?message=Password+reset+successful.+Please+login+with+your+new+password.')
        } catch (signOutError) {
          console.error('Error signing out:', signOutError)
          navigate('/login?message=Password+reset+successful.+Please+login+with+your+new+password.')
        }
      }, 3000)

    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your password')
    } finally {
      setIsLoading(false)
    }
  }

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthColors = ['bg-gray-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']
  const strengthLabels = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong']

  return (
    <form 
      className={cn("flex flex-col gap-8", className)} 
      onSubmit={handleSubmit} 
      noValidate
      {...props}
    >
      {/* Header */}
      <motion.div 
        className="text-center space-y-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
        <p className="text-muted-foreground">
          Choose a strong password for your account
        </p>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div 
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Success Display */}
      {success && (
        <motion.div 
          className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start gap-3">
            <CheckIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        </motion.div>
      )}

      {/* Password Field */}
      <motion.div 
        className="space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Label htmlFor="password" className="text-sm font-medium">
          New Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your new password"
            className={cn(
              "pl-10 pr-10 h-12 bg-background border-border focus:border-primary transition-colors duration-200",
              validationErrors.password && "border-destructive focus:border-destructive"
            )}
            disabled={isLoading}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
            disabled={isLoading}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Password Strength Indicator */}
        {password && (
          <div className="space-y-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-200",
                    passwordStrength >= level ? strengthColors[passwordStrength] : "bg-gray-200"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Password strength: {strengthLabels[passwordStrength]}
            </p>
          </div>
        )}
        
        {validationErrors.password && (
          <p className="text-sm text-destructive mt-1">{validationErrors.password}</p>
        )}
      </motion.div>

      {/* Confirm Password Field */}
      <motion.div 
        className="space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            className={cn(
              "pl-10 h-12 bg-background border-border focus:border-primary transition-colors duration-200",
              validationErrors.confirmPassword && "border-destructive focus:border-destructive"
            )}
            disabled={isLoading}
            required
          />
        </div>
        {validationErrors.confirmPassword && (
          <p className="text-sm text-destructive mt-1">{validationErrors.confirmPassword}</p>
        )}
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <TextureButton 
          variant="accent"
          type="submit" 
          color="primary"
          disabled={isLoading}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <motion.span
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            className="flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "Updating..." : "Update Password"}
          </motion.span>
        </TextureButton>
      </motion.div>
    </form>
  )
}
