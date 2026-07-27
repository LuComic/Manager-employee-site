import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

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

  const addTranslationExpression = (node: ts.Expression) => {
    if (ts.isStringLiteralLike(node)) {
      add(node.text)
      return
    }

    if (ts.isConditionalExpression(node)) {
      addTranslationExpression(node.whenTrue)
      addTranslationExpression(node.whenFalse)
      return
    }

    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      addTranslationExpression(node.expression)
    }
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
        node.arguments[0]
      ) {
        addTranslationExpression(node.arguments[0])
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

function untranslatedPrimitiveMessages() {
  const messages = new Set<string>()
  const translatedAttributes: Record<string, Set<string>> = {
    Button: new Set(["aria-label", "title"]),
    Input: new Set(["aria-label", "placeholder", "title"]),
    SegmentedControl: new Set(["aria-label"]),
    SelectTrigger: new Set(["aria-label", "title"]),
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
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
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

function notificationMessageKeys() {
  const keys = new Set<string>()
  for (const file of sourceFiles("convex")) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(
      /(?:titleKey|messageKey|publishedTitleKey|updatedTitleKey|unpublishedTitleKey):\s*"([^"]+)"/g
    )) {
      keys.add(match[1])
    }
  }
  return keys
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

  test("does not ship an English-value reverse lookup", () => {
    const source = readFileSync("i18n/messages.ts", "utf8")
    expect(source).not.toContain("new Map")
    expect(source).not.toContain("Object.entries")
    expect(source).not.toContain("resolveMessageKey")
    expect(source).toContain("import type en")
  })

  test("uses semantic keys in statically declared T and t calls", () => {
    const nonSemantic = [...translatedSourceMessages()].filter(
      (message) => !Object.hasOwn(en.App, message)
    )

    expect(nonSemantic).toEqual([])
  })

  test("requires explicit translations on passive UI primitives", () => {
    const literalPassthroughs = new Set(["+372 5555 5555"])
    const nonSemantic = [...untranslatedPrimitiveMessages()].filter(
      (message) => !literalPassthroughs.has(message)
    )

    expect(nonSemantic).toEqual([])
  })

  test("keeps stored notification keys in both locale catalogs", () => {
    const missing = [...notificationMessageKeys()].filter(
      (key) => !Object.hasOwn(en.App, key) || !Object.hasOwn(et.App, key)
    )

    expect(missing).toEqual([])
  })
})
