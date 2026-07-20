import { verifyWebhook } from "@clerk/backend/webhooks"
import { httpRouter } from "convex/server"

import { internal } from "./_generated/api"
import { env, httpAction } from "./_generated/server"

const http = httpRouter()

function correlationCredential(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined
  }
  const value = (metadata as Record<string, unknown>).operationsHubClaim
  return typeof value === "string" ? value : undefined
}

http.route({
  path: "/clerk-webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET
    if (!signingSecret) {
      return new Response("Webhook signing secret is not configured", {
        status: 503,
      })
    }
    const eventId = request.headers.get("svix-id")
    if (!eventId) return new Response("Missing webhook event ID", { status: 400 })

    let event: Awaited<ReturnType<typeof verifyWebhook>>
    try {
      event = await verifyWebhook(request, { signingSecret })
    } catch {
      return new Response("Webhook verification failed", { status: 400 })
    }

    if (
      event.type === "organizationInvitation.created" ||
      event.type === "organizationInvitation.revoked" ||
      event.type === "organizationInvitation.accepted"
    ) {
      await ctx.runMutation(internal.employees.applyClerkWebhook, {
        eventId,
        eventType: event.type,
        organizationId: event.data.organization_id,
        clerkUserId:
          event.type === "organizationInvitation.accepted"
            ? event.data.user_id
            : undefined,
        invitationId: event.data.id,
        invitationStatus:
          event.type === "organizationInvitation.created"
            ? "pending"
            : event.type === "organizationInvitation.revoked"
              ? "revoked"
              : "accepted",
        correlationCredential: correlationCredential(event.data.public_metadata),
      })
    } else if (
      event.type === "organizationMembership.created" ||
      event.type === "organizationMembership.updated" ||
      event.type === "organizationMembership.deleted"
    ) {
      await ctx.runMutation(internal.employees.applyClerkWebhook, {
        eventId,
        eventType: event.type,
        organizationId: event.data.organization.id,
        clerkUserId: event.data.public_user_data.user_id,
        correlationCredential: correlationCredential(event.data.public_metadata),
      })
    }

    return new Response("OK")
  }),
})

export default http
