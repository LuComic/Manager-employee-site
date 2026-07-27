import type { AppMessageKey } from "@/i18n/messages"

const semanticKeyPattern = /^[a-z][A-Za-z0-9]*$/
const convexErrorKeyPattern = /\bUncaught Error:\s*([a-z][A-Za-z0-9]*)\b/

function errorStrings(error: unknown) {
  const values: string[] = []

  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "string"
  ) {
    values.push(error.data)
  }
  if (error instanceof Error) values.push(error.message)
  else if (typeof error === "string") values.push(error)

  return values
}

export function extractAppErrorKey(error: unknown): AppMessageKey | null {
  for (const value of errorStrings(error)) {
    const exact = value.trim()
    if (semanticKeyPattern.test(exact)) return exact as AppMessageKey

    const convexKey = value.match(convexErrorKeyPattern)?.[1]
    if (convexKey) return convexKey as AppMessageKey
  }

  return null
}
