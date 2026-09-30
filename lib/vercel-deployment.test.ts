import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { vercelDeploymentError } from "./vercel-deployment"

const developmentUrl = "https://development-example.convex.cloud"

describe("Vercel production and shared development backends", () => {
  test("production requires a deploy key even with a configured URL", () => {
    expect(
      vercelDeploymentError({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CONVEX_URL: developmentUrl,
      })
    ).toContain("Set CONVEX_DEPLOY_KEY")
  })
  test("accepts a scoped production key without a preconfigured URL", () => {
    expect(
      vercelDeploymentError({
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY: "prod:example|fixture",
      })
    ).toBeNull()
  })
  test.each([
    "preview:team:project|fixture",
    "dev:example|fixture",
    "project:team:project|fixture",
    "local|fixture",
    "prod:example",
    "prod:example|",
    "prod:example|fixture with spaces",
    "prod:example|fixture|extra",
  ])("production rejects invalid keys without echoing them (%s)", (key) => {
    const error = vercelDeploymentError({
      VERCEL_ENV: "production",
      CONVEX_DEPLOY_KEY: key,
    })
    expect(error).toContain("prod-scoped")
    expect(error).not.toContain(key)
  })
  test.each([undefined, "", "  "])(
    "previews require a configured backend URL (%s)",
    (NEXT_PUBLIC_CONVEX_URL) => {
      expect(
        vercelDeploymentError({
          VERCEL_ENV: "preview",
          NEXT_PUBLIC_CONVEX_URL,
          CONVEX_DEPLOY_KEY: "preview:team:project|fixture",
        })
      ).toContain("Set NEXT_PUBLIC_CONVEX_URL")
    }
  )
  test.each([
    undefined,
    "dev:example|fixture",
    "preview:team:project|fixture",
    "prod:example|fixture",
  ])(
    "previews accept the development URL regardless of a stale key (%s)",
    (CONVEX_DEPLOY_KEY) => {
      expect(
        vercelDeploymentError({
          VERCEL_ENV: "preview",
          NEXT_PUBLIC_CONVEX_URL: developmentUrl,
          CONVEX_DEPLOY_KEY,
        })
      ).toBeNull()
    }
  )
  test.each([undefined, "development", "unsupported"])(
    "local and unsupported environments use the normal build command (%s)",
    (VERCEL_ENV) => {
      expect(vercelDeploymentError({ VERCEL_ENV })).toContain(
        "Use bun run build"
      )
    }
  )
})

// Run the real entrypoint with fake executables, so a regression can never
// deploy Convex or trigger a real frontend build during these tests.
async function runBuild(env: Record<string, string | undefined>) {
  const directory = await mkdtemp(join(tmpdir(), "vercel-build-"))
  const logPath = join(directory, "commands.jsonl")
  const executable = `#!${process.execPath}
import { appendFileSync } from "node:fs";
appendFileSync(process.env.COMMAND_LOG, JSON.stringify({
  command: process.argv[1].split("/").pop(),
  args: process.argv.slice(2),
  url: process.env.NEXT_PUBLIC_CONVEX_URL,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  deployKey: process.env.CONVEX_DEPLOY_KEY,
  deployment: process.env.CONVEX_DEPLOYMENT,
}) + "\\n");
process.exit(process.argv.at(-1) === process.env.FAIL_COMMAND ? 7 : 0);
`
  try {
    await writeFile(logPath, "")
    for (const command of ["bun", "bunx"])
      await writeFile(join(directory, command), executable, { mode: 0o755 })
    const child = Bun.spawn(
      [
        process.execPath,
        fileURLToPath(new URL("../scripts/vercel-build.ts", import.meta.url)),
      ],
      {
        cwd: directory,
        env: { PATH: directory, COMMAND_LOG: logPath, ...env },
        stdout: "pipe",
        stderr: "pipe",
      }
    )
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ])
    const commands = (await readFile(logPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    return { exitCode, stderr, commands }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const previewEnv = {
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_CONVEX_URL: developmentUrl,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
  CLERK_SECRET_KEY: "sk_test_fixture",
}

describe("Vercel build entrypoint", () => {
  test.each([
    undefined,
    "preview:team:project|fixture",
    "prod:example|fixture",
  ])(
    "preview only typechecks/builds with its configured URL and Clerk keys (%s)",
    async (key) => {
      const result = await runBuild({
        ...previewEnv,
        ...(key ? { CONVEX_DEPLOY_KEY: key } : {}),
      })
      expect(result.exitCode).toBe(0)
      expect(result.commands).toEqual(
        ["typecheck", "build"].map((command) => ({
          command: "bun",
          args: ["run", command],
          url: developmentUrl,
          publishableKey: "pk_test_fixture",
          secretKey: "sk_test_fixture",
        }))
      )
    }
  )
  test.each(["typecheck", "build"])(
    "preview propagates a %s failure and stops",
    async (FAIL_COMMAND) => {
      const result = await runBuild({ ...previewEnv, FAIL_COMMAND })
      expect(result.exitCode).toBe(7)
      expect(result.commands.map((command) => command.args.at(-1))).toEqual(
        FAIL_COMMAND === "typecheck" ? ["typecheck"] : ["typecheck", "build"]
      )
    }
  )
  test("production deploys/builds with its key and clears local deployment selection", async () => {
    const result = await runBuild({
      VERCEL_ENV: "production",
      CONVEX_DEPLOY_KEY: "prod:example|fixture",
      CONVEX_DEPLOYMENT: "dev:local-fixture",
    })
    expect(result.exitCode).toBe(0)
    expect(result.commands).toEqual([
      {
        command: "bunx",
        args: [
          "convex",
          "deploy",
          "--cmd",
          "bun run typecheck && bun run build",
          "--cmd-url-env-var-name",
          "NEXT_PUBLIC_CONVEX_URL",
        ],
        deployKey: "prod:example|fixture",
      },
    ])
  })
  test("production propagates a deployment/build failure", async () => {
    const result = await runBuild({
      VERCEL_ENV: "production",
      CONVEX_DEPLOY_KEY: "prod:example|fixture",
      FAIL_COMMAND: "NEXT_PUBLIC_CONVEX_URL",
    })
    expect(result.exitCode).toBe(7)
  })
  test.each([
    { VERCEL_ENV: "preview" },
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: "production", CONVEX_DEPLOY_KEY: "dev:example|fixture" },
    { VERCEL_ENV: "development" },
  ])(
    "invalid configuration fails before spawning commands (%j)",
    async (env) => {
      const result = await runBuild(env)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).not.toBe("")
      expect(result.commands).toEqual([])
    }
  )
})
