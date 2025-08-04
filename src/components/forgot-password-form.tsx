import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "motion/react"
import { Mail, ArrowLeft, Loader2 } from "lucide-react"
import { TextureButton } from "./TextureButton"
import { useState } from "react"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Simple validation schema
  const forgotPasswordSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  });

  const validateForm = (): boolean => {
    try {
      forgotPasswordSchema.parse({ email })
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) {
        setError(error.message)
        return
      }
      
      // Set success state if no error
      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred during password reset')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className={cn("flex flex-col gap-8", className)}>
        <motion.div 
          className="flex flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 bg-[#3B37FE]/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-[#3B37FE]" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent tracking-tight">
            Check your email
          </h1>
          <p className="text-muted-foreground text-base font-medium max-w-sm">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
        </motion.div>
        
        <motion.div 
          className="text-center text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.a 
            href="/login"
            className="inline-flex items-center gap-2 text-[#3B37FE] hover:text-[#2B27EE] font-semibold transition-colors duration-200"
            whileHover={{ scale: 1.02, x: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft className="size-4" />
            Back to Sign In
          </motion.a>
        </motion.div>
      </div>
    )
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
          Forgot Password?
        </h1>
        <p className="text-muted-foreground text-base font-medium max-w-sm">
          No worries! Enter your email address and we'll send you a reset link.
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
      
      <div className="grid gap-6">
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
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4 group-focus-within:text-[#3B37FE] transition-colors" />
            <Input 
              id="email" 
              type="email" 
              placeholder="Enter your email address" 
              required 
              autoComplete="email"
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
                validationErrors.email && "border-red-500 focus:border-red-500 focus:ring-red-500"
              )}
            />
          </div>
          {validationErrors.email && (
            <p className="text-sm text-red-500 mt-1">{validationErrors.email}</p>
          )}
        </motion.div>
        
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
            className="w-full h-12 bg-[#3B37FE] hover:bg-[#2B27EE] text-white font-semibold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <motion.span
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? "Sending..." : "Send Reset Link"}
            </motion.span>
          </TextureButton>
        </motion.div>
      </div>
      
      <motion.div 
        className="text-center text-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <motion.a 
          href="/login"
          className="inline-flex items-center gap-2 text-[#3B37FE] hover:text-[#2B27EE] font-semibold transition-colors duration-200"
          whileHover={{ scale: 1.02, x: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowLeft className="size-4" />
          Back to Sign In
        </motion.a>
      </motion.div>
    </form>
  )
}
