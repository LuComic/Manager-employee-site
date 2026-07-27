const correlationCredentialKeys = [
  "workhalClaim",
  // Read-only compatibility for invitations created before the workhal rename.
  "operationsHubClaim",
] as const

export function clerkCorrelationCredential(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined
  }

  const values = metadata as Record<string, unknown>
  for (const key of correlationCredentialKeys) {
    const value = values[key]
    if (typeof value === "string") return value
  }

  return undefined
}
