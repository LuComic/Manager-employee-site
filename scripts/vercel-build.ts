import { vercelDeploymentError } from "../lib/vercel-deployment"

const error = vercelDeploymentError({
  VERCEL_ENV: process.env.VERCEL_ENV,
  CONVEX_DEPLOY_KEY: process.env.CONVEX_DEPLOY_KEY,
})
if (error) {
  console.error(error)
  process.exit(1)
}

// Convex injects the selected deployment's URL into the frontend build. Vercel
// publishes its output only if both the build and backend deployment succeed.
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
