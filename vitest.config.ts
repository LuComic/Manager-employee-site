import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.vitest.ts"],
    env: {
      CLERK_WEBHOOK_SIGNING_SECRET:
        "whsec_c2VjdXJpdHktdGVzdC1vbmx5LXNlY3JldA==",
      HUB_CREDENTIALS_ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
})
