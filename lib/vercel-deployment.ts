type DeploymentEnvironment = {
  VERCEL_ENV?: string
  CONVEX_DEPLOY_KEY?: string
  NEXT_PUBLIC_CONVEX_URL?: string
}

export function vercelDeploymentError(
  env: DeploymentEnvironment
): string | null {
  if (env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview")
    return "build:vercel requires VERCEL_ENV=production or preview. Use bun run build for a local build."
  if (env.VERCEL_ENV === "preview") {
    if (!env.NEXT_PUBLIC_CONVEX_URL?.trim())
      return "Set NEXT_PUBLIC_CONVEX_URL to the shared development backend in Vercel's Preview environment before building. Preview builds do not deploy Convex."
    return null
  }
  // Production must use its scoped key, never a developer's login or deployment.
  if (!env.CONVEX_DEPLOY_KEY)
    return "Set CONVEX_DEPLOY_KEY in Vercel's production environment before deploying. Clerk keys do not deploy Convex functions."
  if (
    !env.CONVEX_DEPLOY_KEY.startsWith("prod:") ||
    !/^[^|\s]+\|[^|\s]+$/.test(env.CONVEX_DEPLOY_KEY)
  )
    return "Vercel production requires a prod-scoped CONVEX_DEPLOY_KEY. Do not share production keys with previews."
  return null
}
