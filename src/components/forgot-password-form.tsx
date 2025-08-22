import { useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "motion/react"
import { Mail, ArrowLeft, Loader2, CheckIcon } from "lucide-react"
import { TextureButton } from "./TextureButton"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"

interface ForgotPasswordFormProps {
  className?: string
  onBack?: () => void
}

export function ForgotPasswordForm({
  className,
  onBack,
  ...props
}: ForgotPasswordFormProps & React.ComponentProps<"form">) {
  const [email, setEmail] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Simple validation schema
  const forgotPasswordSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  });

  const validateForm = (): boolean => {
    try {
      forgotPasswordSchema.parse({ email });
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
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(`Password reset instructions have been sent to ${email}. Please check your email and follow the link to reset your password.`)
        setEmail("")
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending the reset email')
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
      {/* Header */}
      <motion.div 
        className="text-center space-y-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
        <p className="text-muted-foreground">
          Enter your email address and we'll send you a link to reset your password
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

      {/* Email Field */}
      <motion.div 
        className="space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Label htmlFor="email" className="text-sm font-medium">
          Email address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className={cn(
              "pl-10 h-12 bg-background border-border focus:border-primary transition-colors duration-200",
              validationErrors.email && "border-destructive focus:border-destructive"
            )}
            disabled={isLoading}
            required
          />
        </div>
        {validationErrors.email && (
          <p className="text-sm text-destructive mt-1">{validationErrors.email}</p>
        )}
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
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
            {isLoading ? "Sending..." : "Send Reset Link"}
          </motion.span>
        </TextureButton>
      </motion.div>

      {/* Back to Login */}
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <motion.button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-200 font-medium"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </motion.button>
      </motion.div>
    </form>
  )
}