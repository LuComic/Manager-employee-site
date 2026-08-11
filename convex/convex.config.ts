import { defineApp } from "convex/server"
import { v } from "convex/values"

export default defineApp({
  env: {
    CLERK_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
    HUB_CREDENTIALS_ENCRYPTION_KEY: v.string(),
    DEPUTY_CLIENT_ID: v.optional(v.string()),
    DEPUTY_CLIENT_SECRET: v.optional(v.string()),
    DEPUTY_OAUTH_REDIRECT_URI: v.optional(v.string()),
  },
})
