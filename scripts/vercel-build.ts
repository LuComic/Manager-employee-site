import { vercelDeploymentError } from "../lib/vercel-deployment"

const error = vercelDeploymentError({
  VERCEL_ENV: process.env.VERCEL_ENV,
  CONVEX_DEPLOY_KEY: process.env.CONVEX_DEPLOY_KEY,
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
})
if (error) {
  console.error(error)
  process.exit(1)
}

if (process.env.VERCEL_ENV === "preview") {
  // All previews use the configured development URL. Never deploy a backend,
  // even if a stale deploy key is still present in Vercel's Preview scope.
  for (const command of ["typecheck", "build"]) {
    const child = Bun.spawn(["bun", "run", command], {
      env: { ...process.env, CONVEX_DEPLOY_KEY: undefined },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
    const exitCode = await child.exited
    if (exitCode !== 0) process.exit(exitCode)
  }
  process.exit(0)
}

// Production: Convex injects its URL into the frontend build. Vercel publishes
// its output only if both the build and backend deployment succeed.
const child = Bun.spawn(
  [
    "bunx",
    "convex",
    "deploy",
    "--cmd",
    "bun run typecheck && bun run build",
    "--cmd-url-env-var-name",
    "NEXT_PUBLIC_CONVEX_URL",
  ],
  {
    env: { ...process.env, CONVEX_DEPLOYMENT: undefined },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }
)
process.exit(await child.exited)
