type DeploymentEnvironment = {
  VERCEL_ENV?: string
  CONVEX_DEPLOY_KEY?: string
}

export function vercelDeploymentError(
  env: DeploymentEnvironment
): string | null {
  if (env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview")
    return "build:vercel requires VERCEL_ENV=production or preview. Use bun run build for a local build."
  const expected = env.VERCEL_ENV === "production" ? "prod" : "preview"
  // Require a scoped deploy key rather than falling back to a developer's
  // login or CONVEX_DEPLOYMENT. In particular, previews cannot write production.
  if (!env.CONVEX_DEPLOY_KEY)
    return `Set CONVEX_DEPLOY_KEY in Vercel's ${env.VERCEL_ENV} environment before deploying. Clerk keys do not deploy Convex functions.`
  if (
    !env.CONVEX_DEPLOY_KEY.startsWith(`${expected}:`) ||
    !/^[^|\s]+\|[^|\s]+$/.test(env.CONVEX_DEPLOY_KEY)
  )
    return `Vercel ${env.VERCEL_ENV} requires a ${expected}-scoped CONVEX_DEPLOY_KEY. Do not share production keys with previews.`
  return null
}
