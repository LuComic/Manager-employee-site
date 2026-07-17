import type { ReactNode } from "react"
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react"

import type { RichTextDocument } from "@/lib/rich-text"
import { normalizeRichTextLink } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

const renderRichText = renderJSONContentToReactElement({
  nodeMapping: {
    doc: ({ children }) => <>{children}</>,
    text: ({ node }) => node.text ?? "",
    paragraph: ({ children }) => <p>{children}</p>,
    heading: ({ node, children }) => {
      if (node.attrs?.level === 3) return <h3>{children}</h3>
      return <h2>{children}</h2>
    },
    bulletList: ({ children }) => <ul>{children}</ul>,
    orderedList: ({ node, children }) => (
      <ol start={typeof node.attrs?.start === "number" ? node.attrs.start : 1}>
        {children}
      </ol>
    ),
    listItem: ({ children }) => <li>{children}</li>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    hardBreak: () => <br />,
  },
  markMapping: {
    bold: ({ children }) => <strong>{children}</strong>,
    italic: ({ children }) => <em>{children}</em>,
    underline: ({ children }) => <u>{children}</u>,
    link: ({ mark, children }) => {
      const href = normalizeRichTextLink(String(mark.attrs?.href ?? ""))
      if (!href) return <>{children}</>
      const external = href.startsWith("http")
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
        >
          {children}
        </a>
      )
    },
  },
  unhandledNode: ({ children }) => <>{children}</>,
  unhandledMark: ({ children }) => <>{children}</>,
})

export function RichTextContent({
  content,
  className,
}: {
  content: RichTextDocument
  className?: string
}) {
  return (
    <div className={cn("rich-text-content", className)}>
      {renderRichText({ content }) as ReactNode}
    </div>
  )
}
