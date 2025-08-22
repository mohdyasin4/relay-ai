import { cn } from "@/lib/utils"
import React, { useEffect, useRef, useState } from "react"
import { Button } from "./button"
import { Check, Copy } from "lucide-react"
import { shikiHighlighter } from "@/lib/shiki"
import { Badge } from "./badge"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-muted/50 dark:bg-muted/30 text-foreground rounded-xl shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  theme,
  className,
  ...props
}: CodeBlockCodeProps) {
  // Theme is resolved inside shiki highlighter; prop retained for API parity

  const lang: string = language ?? "plaintext";
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      try {
        if (!isVisible) return
        const html = await shikiHighlighter.highlight(code, lang)
        setHighlightedHtml(html)
      } catch (error) {
        console.error('Failed to highlight code:', error)
        // Fallback to plain code
        setHighlightedHtml(`<pre><code>${code.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</code></pre>`)
      }
    }
    highlight()
  }, [code, lang, theme, isVisible])

  const classNames = cn(
    "w-full px-4 dark:bg-black/30 bg-muted/50 overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4",
    className
  )


  return highlightedHtml ? (
    <div
      ref={containerRef}
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div ref={containerRef} className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }

export type CodeBlockHeaderProps = {
  language?: string
  filename?: string
  handleCopy?: () => void
  copied?: boolean
  setCopied?: (val: boolean) => void
  rightSlot?: React.ReactNode
  className?: string
}

function CodeBlockHeader({ language, filename, rightSlot, handleCopy, copied, setCopied: _setCopied, className }: CodeBlockHeaderProps) {

  return (
    <div className={cn("border-border border-b py-2 pr-2 pl-4 flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        {language && (
          <Badge variant="secondary" className="rounded px-2 py-1 text-xs font-medium">
            {language}
          </Badge>
        )}
        {filename && <span className="text-muted-foreground text-sm">{filename}</span>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleCopy}
      >
        {copied == true ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      {rightSlot}
    </div>
  )
}

export { CodeBlockHeader }
