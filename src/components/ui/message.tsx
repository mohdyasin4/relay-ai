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

export type MessageProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, className, ...props }: MessageProps) => (
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
  copied?: boolean
  handleCopy?: (text: string) => void

  className?: string
  resolveMentionContact?: (idOrName: string) => { name: string; avatarUrl?: string } | undefined
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  markdown,
  copied, 
  handleCopy,
  className,
  ...props
}: MessageContentProps) => {
  const classNames = cn(
    "rounded-lg p-2 text-foreground bg-secondary prose break-words whitespace-normal",
    className
  )

  // Mention coloring and hover-card rendering for links of the form [@Name](mention:ID)
  const hashColorIndex = (key: string, modulo = 8) => {
    let hash = 5381
    for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i)
    return Math.abs(hash) % modulo
  }
  const palette = [
    { bg: "bg-blue-200 dark:bg-blue-800", text: "text-blue-950 dark:text-blue-50" },
    { bg: "bg-green-200 dark:bg-green-800", text: "text-green-950 dark:text-green-50" },
    { bg: "bg-amber-200 dark:bg-amber-800", text: "text-amber-950 dark:text-amber-50" },
    { bg: "bg-purple-200 dark:bg-purple-800", text: "text-purple-950 dark:text-purple-50" },
    { bg: "bg-rose-200 dark:bg-rose-800", text: "text-rose-950 dark:text-rose-50" },
    { bg: "bg-cyan-200 dark:bg-cyan-800", text: "text-cyan-950 dark:text-cyan-50" },
    { bg: "bg-teal-200 dark:bg-teal-800", text: "text-teal-950 dark:text-teal-50" },
    { bg: "bg-indigo-200 dark:bg-indigo-800", text: "text-indigo-950 dark:text-indigo-50" },
  ] as const

  const mentionComponents: React.ComponentProps<typeof Markdown>["components"] = {
    a: (anchorProps) => {
      const { href, children, ...rest } = anchorProps as React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>
      const url = typeof href === "string" ? href : ""
      if (url.startsWith("mention:")) {
        const id = decodeURIComponent(url.slice("mention:".length))
        const color = palette[hashColorIndex(id)]
        const info = (props as any).resolveMentionContact?.(id)
        const tag = (
          <span className={cn("inline-block rounded px-1 font-semibold", color.bg, color.text)}>
            {children}
          </span>
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

  return markdown ? (
    <Markdown className={classNames} copied={copied}  handleCopy={handleCopy} components={{ ...props.components, ...mentionComponents }} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
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
