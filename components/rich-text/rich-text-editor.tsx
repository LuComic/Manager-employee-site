"use client"

import { T, useI18n } from "@/components/providers/i18n-provider"

import { useState } from "react"
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RichTextDocument } from "@/lib/rich-text"
import { normalizeRichTextLink } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: RichTextDocument
  onChange: (value: RichTextDocument) => void
  ariaLabel: string
  className?: string
}) {
  const { t } = useI18n()
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState("")
  const [linkError, setLinkError] = useState("")
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class:
          "min-h-96 px-6 py-5 text-sm leading-7 focus:outline-none sm:text-base",
      },
    },
    onUpdate: ({ editor: currentEditor }) =>
      onChange(currentEditor.getJSON() as RichTextDocument),
  })

  if (!editor) return <div className="min-h-96 border bg-background" />

  const blockType = editor.isActive("heading", { level: 2 })
    ? "heading-2"
    : editor.isActive("heading", { level: 3 })
      ? "heading-3"
      : "paragraph"

  function applyLink() {
    if (!editor) return
    const href = normalizeRichTextLink(linkValue)
    if (!href) {
      setLinkError("Enter an http, https, or email link.")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    setLinkOpen(false)
    setLinkError("")
  }

  return (
    <div className={cn("overflow-hidden border bg-background", className)}>
      <div
        className="flex flex-wrap items-center gap-2 border-b bg-muted/40 p-2"
        role="toolbar"
        aria-label={t("{label} formatting", { label: ariaLabel })}
      >
        <Select
          value={blockType}
          onValueChange={(value) => {
            const chain = editor.chain().focus()
            if (value === "heading-2") chain.setHeading({ level: 2 }).run()
            else if (value === "heading-3") chain.setHeading({ level: 3 }).run()
            else chain.setParagraph().run()
          }}
        >
          <SelectTrigger
            size="sm"
            className="border border-input bg-background px-3"
            aria-label={t("Text style")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">
              <T>Paragraph</T>
            </SelectItem>
            <SelectItem value="heading-2">
              <T>Section heading</T>
            </SelectItem>
            <SelectItem value="heading-3">
              <T>Subsection heading</T>
            </SelectItem>
          </SelectContent>
        </Select>
        <FormatButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </FormatButton>
        <FormatButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </FormatButton>
        <FormatButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline />
        </FormatButton>
        <FormatButton
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </FormatButton>
        <FormatButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </FormatButton>
        <FormatButton
          label="Block quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </FormatButton>
        <FormatButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            setLinkValue(String(editor.getAttributes("link").href ?? ""))
            setLinkOpen((open) => !open)
            setLinkError("")
          }}
        >
          <Link2 />
        </FormatButton>
        <span className="mx-1 h-6 border-l" aria-hidden="true" />
        <FormatButton
          label="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </FormatButton>
        <FormatButton
          label="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </FormatButton>
      </div>
      {linkOpen && (
        <div className="flex flex-col gap-2 border-b bg-background p-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  applyLink()
                }
              }}
              placeholder="https://example.com or mailto:name@example.com"
              aria-label="Link address"
              className="border border-input px-3"
            />
            {linkError && (
              <p className="mt-2 text-xs text-destructive">{linkError}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={applyLink}>
              <T>Apply link</T>
            </Button>
            {editor.isActive("link") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  editor.chain().focus().unsetLink().run()
                  setLinkOpen(false)
                }}
              >
                <T>Remove</T>
              </Button>
            )}
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

function FormatButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "selected" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
