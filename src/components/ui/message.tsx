import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Markdown } from "./markdown"
import { Badge } from "@/components/ui/badge"
import { getSenderToneClasses } from "@/utils/colorUtils"

export type MessageProps = {
  children: React.ReactNode
  theme?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children,theme, className, ...props }: MessageProps) => (
  <div className={cn("flex gap-3", className)} {...props}>
    {children}
  </div>
)

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarImage src={src} alt={alt} />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  theme?: string
  copied?: boolean
  handleCopy?: (text: string) => void

  className?: string
  resolveMentionContact?: (idOrName: string) => { name: string; avatarUrl?: string } | undefined
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  markdown,
  theme,
  copied, 
  handleCopy,
  className,
  ...props
}: MessageContentProps) => {
  const classNames = cn(
    "rounded-lg text-foreground prose prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-foreground prose-pre:text-foreground prose-blockquote:text-foreground prose-li:text-foreground prose-a:text-foreground whitespace-",
    className
  )

  // Mention coloring and hover-card rendering for links of the form [@Name](mention:ID)
  // Deprecated hashColorIndex retained for reference only
  // Deprecated palette replaced by shared color util to ensure parity

  const mentionComponents: React.ComponentProps<typeof Markdown>["components"] = {
    a: (anchorProps) => {
      const { href, children, ...rest } = anchorProps as React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>
      const url = typeof href === "string" ? href : ""
      if (url.startsWith("mention:")) {
        const id = decodeURIComponent(url.slice("mention:".length))
        const { text: toneText, bg: toneBg } = getSenderToneClasses(id)
        const info = (props as any).resolveMentionContact?.(id)
        const tag = (
          <Badge 
            variant="secondary" 
            className={cn("inline-flex items-center gap-1 px-2.5 py-[3px] text-[11px] font-semibold rounded-full shadow-sm hover:shadow transition-shadow duration-150 ring-1 ring-border/40", toneText, toneBg)}
          >
            @{children}
          </Badge>
        )
        if (!info) return tag
        return (
          <HoverCard>
            <HoverCardTrigger asChild>{tag}</HoverCardTrigger>
            <HoverCardContent className="flex items-center gap-3 w-64">
              <Avatar>
                <AvatarImage src={info.avatarUrl || ""} alt={info.name} />
                <AvatarFallback>{info.name?.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold">{info.name}</span>
                <span className="text-xs text-muted-foreground">Mentioned user</span>
              </div>
            </HoverCardContent>
          </HoverCard>
        )
      }
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      )
    },
  }

  // Filter out props that shouldn't be passed to DOM elements
  const { setCopied, resolveMentionContact, ...domProps } = props;

  return markdown ? (
    <Markdown className={classNames} theme={theme} copied={copied} handleCopy={handleCopy} components={{ ...props.components, ...mentionComponents }} {...domProps}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...domProps}>
      {children}
    </div>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn("text-muted-foreground flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
)

export type MessageActionProps = {
  className?: string
  tooltip?: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction }
