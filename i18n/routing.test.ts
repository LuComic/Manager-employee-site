import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

import { getMessageKey, resolveMessageKey } from "@/i18n/messages"
import { getPathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { SITE_NAME } from "@/lib/branding"
import en from "@/messages/en.json"
import et from "@/messages/et.json"

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

function translatedSourceMessages() {
  const messages = new Set<string>()

  const add = (message: string) => {
    const normalized = message.replace(/\s+/g, " ").trim()
    if (normalized) messages.add(normalized)
  }

  for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )

    const visit = (node: ts.Node, insideT = false) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "t" &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        add(node.arguments[0].text)
      }

      if (
        ts.isJsxElement(node) &&
        node.openingElement.tagName.getText(source) === "T"
      ) {
        for (const child of node.children) visit(child, true)
        return
      }

      if (insideT && ts.isJsxText(node)) add(node.text)
      if (insideT && ts.isStringLiteralLike(node)) add(node.text)
      ts.forEachChild(node, (child) => visit(child, insideT))
    }

    visit(source)
  }

  return messages
}

function implicitlyTranslatedSourceMessages() {
  const messages = new Set<string>()
  const translatedAttributes: Record<string, Set<string>> = {
    Button: new Set(["aria-label", "title"]),
    Detail: new Set(["label"]),
    EmptyState: new Set(["actionLabel", "description", "title"]),
    Field: new Set(["label"]),
    Input: new Set(["aria-label", "placeholder", "title"]),
    ManagerHeading: new Set(["description", "title"]),
    PageHeading: new Set(["description", "title"]),
    SectionHeading: new Set(["description", "title"]),
    SegmentedControl: new Set(["aria-label"]),
    Select: new Set(["aria-label", "title"]),
    Textarea: new Set(["aria-label", "placeholder", "title"]),
  }
  const translatedChildren = new Set(["Badge", "Button", "SelectItem"])

  for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )

    const visit = (node: ts.Node) => {
      if (
        ts.isJsxOpeningElement(node) ||
        ts.isJsxSelfClosingElement(node)
      ) {
        const attributes = translatedAttributes[node.tagName.getText(source)]
        if (attributes) {
          for (const property of node.attributes.properties) {
            if (
              ts.isJsxAttribute(property) &&
              attributes.has(property.name.getText(source)) &&
              property.initializer &&
              ts.isStringLiteral(property.initializer)
            ) {
              messages.add(property.initializer.text)
            }
          }
        }
      }

      if (
        ts.isJsxElement(node) &&
        translatedChildren.has(node.openingElement.tagName.getText(source))
      ) {
        const message = node.children
          .filter(ts.isJsxText)
          .map((child) => child.getText(source))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()

        if (message) messages.add(message)
      }

      ts.forEachChild(node, visit)
    }

    visit(source)
  }

  return messages
}

describe("locale paths", () => {
  test("uses Estonian as the default and supports English", () => {
    expect(routing.defaultLocale).toBe("et")
    expect(routing.locales).toEqual(["et", "en"])
  })

  test("generates locale-prefixed application paths", () => {
    expect(getPathname({ locale: "et", href: "/guides" })).toBe("/et/guides")
    expect(getPathname({ locale: "en", href: "/calendar" })).toBe(
      "/en/calendar"
    )
  })
})

describe("translation dictionaries", () => {
  test("contain only non-empty messages", () => {
    expect(Object.values(en.App).every(Boolean)).toBeTrue()
    expect(Object.values(et.App).every(Boolean)).toBeTrue()
  })

  test("uses matching semantic keys for both locales", () => {
    expect(Object.keys(et.App)).toEqual(Object.keys(en.App))
    expect(
      Object.keys(en.App).every((key) => /^[a-z][A-Za-z0-9]*$/.test(key))
    ).toBeTrue()
    expect(new Set(Object.values(en.App)).size).toBe(Object.keys(en.App).length)
  })

  test("avoids the rejected Estonian hub terminology", () => {
    expect(
      Object.values(et.App).some((message) => /keskus/i.test(message))
    ).toBe(false)
  })

  test("keeps the untranslated site name out of the locale catalogs", () => {
    expect(SITE_NAME).toBe("workhal")
    expect(Object.values(en.App)).not.toContain(SITE_NAME)
    expect(Object.values(et.App)).not.toContain(SITE_NAME)
  })

  test("keeps English source-copy lookup as a runtime compatibility fallback", () => {
    expect(resolveMessageKey("bannerImageSizeLimit")).toBe(
      "bannerImageSizeLimit"
    )
    expect(resolveMessageKey("Banner images must be 10 MB or smaller")).toBe(
      "bannerImageSizeLimit"
    )
    expect(
      getMessageKey(
        "calendar changes are processed. Publishing imported events may add one employee notification per event."
      )
    ).toBe("calendarProcessingAndNotifications")
  })

  test("rejects unknown messages in server-rendered metadata", () => {
    expect(() => getMessageKey("Missing message")).toThrow(
      'Unknown app message: "Missing message"'
    )
  })

  test("uses semantic keys in statically declared T and t calls", () => {
    const nonSemantic = [...translatedSourceMessages()].filter(
      (message) => !Object.hasOwn(en.App, message)
    )

    expect(nonSemantic).toEqual([])
  })

  test("uses semantic keys on implicit translation surfaces", () => {
    const literalPassthroughs = new Set(["+372 5555 5555"])
    const nonSemantic = [...implicitlyTranslatedSourceMessages()].filter(
      (message) =>
        !Object.hasOwn(en.App, message) && !literalPassthroughs.has(message)
    )

    expect(nonSemantic).toEqual([])
  })
})
