import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { LucideIcon } from "lucide-react"

type PromptInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
})

function usePromptInput() {
  const context = useContext(PromptInputContext)
  if (!context) {
    throw new Error("usePromptInput must be used within a PromptInput")
  }
  return context
}

type PromptInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
}

function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          textareaRef,
        }}
      >
        <div
          className={cn(
            "sticky bottom-0 z-20 border-t border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 cursor-text rounded-none shadow-2xl",
            className
          )}
          onClick={() => textareaRef.current?.focus()}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  )
}

export type PromptInputTextareaProps = {
  disableAutosize?: boolean
} & React.ComponentProps<typeof Textarea>

function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } =
    usePromptInput()

  useEffect(() => {
    if (disableAutosize) return

    if (!textareaRef.current) return
    textareaRef.current.style.height = "auto"
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`
  }, [value, maxHeight, disableAutosize])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      const isMentionOpen = !!document.querySelector(
        '[data-slot="mention-content"][data-state="open"]'
      )
      if (isMentionOpen) {
        if (e.shiftKey) {
          // Shift+Enter should insert a newline even when mention is open
          e.preventDefault()
          const el = textareaRef.current
          if (el) {
            const start = (el as HTMLTextAreaElement).selectionStart ?? (value?.length ?? 0)
            const end = (el as HTMLTextAreaElement).selectionEnd ?? (value?.length ?? 0)
            const before = value?.slice(0, start) ?? ""
            const after = value?.slice(end) ?? ""
            const next = `${before}\n${after}`
            setValue(next)
            // restore caret after inserted newline
            queueMicrotask(() => {
              (el as HTMLTextAreaElement).selectionStart = (el as HTMLTextAreaElement).selectionEnd = start + 1
            })
          }
          return
        }
        // Enter should select the highlighted mention item
        e.preventDefault()
        const highlighted = document.querySelector<HTMLElement>(
          '[data-slot="mention-item"][data-highlighted]'
        )
        if (highlighted) {
          highlighted.click()
          return
        }
        // Fallback: do nothing if none highlighted
        return
      }
      // No mention open: Enter submits; Shift+Enter creates newline by default
      if (!e.shiftKey) {
        e.preventDefault()
        onSubmit?.()
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "text-foreground w-full resize-none border-none bg-transparent dark:bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 px-4 py-3 scrollbar-hide",
        className
      )}
      rows={1}
      disabled={disabled}
      {...props}
    />
  )
}

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>

function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}

type PromptInputActionProps = {
  className?: string
  tooltip: React.ReactNode
  icon: LucideIcon
  side?: "top" | "bottom" | "left" | "right"
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "sm" | "md" | "lg"
  onClick?: () => void
  onMouseDown?: (e: React.MouseEvent) => void
} & React.ComponentProps<typeof Tooltip>

function PromptInputAction({
  tooltip,
  icon,
  className,
  side = "top",
  variant = "default",
  size = "md",
  onClick,
  onMouseDown,
  ...props
}: PromptInputActionProps) {
  const { disabled } = usePromptInput()

  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
  }

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10", 
    lg: "h-12 w-12"
  }

  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled} onClick={event => event.stopPropagation()}>
        <div 
          className={cn(
            "inline-flex items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
            variantClasses[variant],
            sizeClasses[size],
            className
          )}
          onClick={onClick}
          onMouseDown={onMouseDown}
        >
          {React.createElement(icon, {
            size: size === "sm" ? 16 : size === "md" ? 20 : 24,
            className: "text-current"
          })}
        </div>
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
}
