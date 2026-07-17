export type RichTextMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type RichTextNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: RichTextNode[]
  marks?: RichTextMark[]
  text?: string
}

export type RichTextDocument = RichTextNode & { type: "doc" }

export type LegacyGuideStep = {
  title: string
  detail: string
  tip?: string
}

export const emptyRichTextDocument: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

export function paragraphDocument(text: string): RichTextDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : undefined,
      },
    ],
  }
}

export function guideStepsToRichText(
  steps: LegacyGuideStep[]
): RichTextDocument {
  return {
    type: "doc",
    content: [
      {
        type: "orderedList",
        attrs: { start: 1, type: null },
        content: steps.map((step) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: step.title,
                  marks: [{ type: "bold" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: step.detail }],
            },
            ...(step.tip
              ? [
                  {
                    type: "blockquote",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "Useful tip: ",
                            marks: [{ type: "bold" }],
                          },
                          { type: "text", text: step.tip },
                        ],
                      },
                    ],
                  },
                ]
              : []),
          ],
        })),
      },
    ],
  }
}

export function richTextToPlainText(document: RichTextNode | undefined) {
  const parts: string[] = []

  function visit(node: RichTextNode) {
    if (node.text) parts.push(node.text)
    node.content?.forEach(visit)
    if (
      ["paragraph", "heading", "listItem", "blockquote", "hardBreak"].includes(
        node.type
      )
    )
      parts.push("\n")
  }

  if (document) visit(document)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

export function isRichTextEmpty(document: RichTextDocument) {
  return !richTextToPlainText(document)
}

export function normalizeRichTextLink(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? candidate
      : null
  } catch {
    return null
  }
}
