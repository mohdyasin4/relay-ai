import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode, CodeBlockHeader } from "./code-block"

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
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)
    const resolvedTheme = theme === "dark" ? "vesper" : "github-light-high-contrast"
    console.log(`Using theme: ${resolvedTheme} for language: ${language}`)
    return (
      <CodeBlock className={className}>
        <CodeBlockHeader
          language={language}
          handleCopy={() => handleCopy?.(children as string)}
          copied={copied}
          setCopied={setCopied}
        />
        <CodeBlockCode code={children as string} language={language} theme={resolvedTheme} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
        urlTransform={(url: string) => {
          // Allow our custom mention: scheme while keeping other URIs intact
          if (typeof url === "string" && url.startsWith("mention:")) return url
          return url
        }}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

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
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={{
            ...components,
            code: (props: any) =>
              (INITIAL_COMPONENTS.code as any)?.({
                ...props,
                theme,
                handleCopy,
                copied,
                setCopied,
              }),
          }}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
