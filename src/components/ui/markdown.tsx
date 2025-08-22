import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useEffect, useState } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode, CodeBlockHeader } from "./code-block"
import { useTheme } from "@/components/theme-provider"

export type MarkdownProps = {
  children: string
  theme?: string
  id?: string
  className?: string
  handleCopy?: (code: string) => void
  copied?: boolean
  setCopied?: (val: boolean) => void
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

type CodeComponentProps = React.HTMLAttributes<HTMLElement> & {
  className?: string
  theme?: string
  handleCopy?: (code: string) => void
  copied?: boolean
  setCopied?: (val: boolean) => void
  children?: React.ReactNode
  node?: any
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, theme, handleCopy, copied, setCopied, children, ...props }: CodeComponentProps) {
    const { theme: currentTheme } = useTheme();

    const [resolvedTheme, setResolvedTheme] = useState<"vesper" | "github-light-high-contrast">(
      currentTheme === "dark" ? "vesper" : "github-light-high-contrast"
    );

    useEffect(() => {
      // Recompute on theme change
      const root = document.documentElement;
      const isDark = root.classList.contains("dark");
      setResolvedTheme(isDark ? "vesper" : "github-light-high-contrast");
    }, [currentTheme]);

    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-muted/80 dark:bg-muted/60 text-foreground rounded-sm px-1.5 py-0.5 text-sm border border-border/50 font-mono",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)
    const codeContent = children as string
    
    // Debug logging for code blocks
    console.log('Code block rendering:', {
      language,
      contentLength: codeContent?.length || 0,
      isInline,
      className,
      hasCodeContent: !!codeContent,
      codeContent: codeContent?.substring(0, 100) // Show first 100 chars
    });
    
    return (
      <CodeBlock className={cn(className)}>
        <CodeBlockHeader
          language={language}
          handleCopy={() => handleCopy?.(codeContent)}
          copied={copied}
          setCopied={setCopied}
        />
        <CodeBlockCode code={codeContent} language={language} theme={resolvedTheme} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    console.log('Pre component called with children:', children);
    return <>{children}</>
  },
}



function MarkdownComponent({
  children,
  id,
  className,
  theme,
  handleCopy,
  copied,
  setCopied,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  // Debug logging for markdown content
  if (typeof children === 'string' && children.includes('```')) {
    console.log('Markdown component received content with code blocks:', {
      contentLength: children.length,
      hasCodeBlocks: children.includes('```'),
      sample: children.substring(0, 200),
      fullContent: children // Log the full content for debugging
    });
  }
  
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          ...components,
          code: (props: any) => {
            console.log('ReactMarkdown code component called:', props);
            return INITIAL_COMPONENTS.code ? (
              (INITIAL_COMPONENTS.code as any)({
                ...props,
                handleCopy,
                copied,
                setCopied,
              })
            ) : null;
          },
          // Add explicit handling for pre tags to ensure code blocks are processed
          pre: (props: any) => {
            console.log('ReactMarkdown pre component called:', props);
            return <pre {...props} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
