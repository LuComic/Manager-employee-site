import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"

import type { Id } from "../_generated/dataModel"
import { env } from "../_generated/server"

const AES_GCM_IV_BYTES = 12
const AES_256_KEY_HEX_LENGTH = 64

export type DeputyTokens = {
  accessToken: string
  refreshToken: string
}

function encryptionKeyBytes() {
  const key = env.HUB_CREDENTIALS_ENCRYPTION_KEY
  if (key.length !== AES_256_KEY_HEX_LENGTH || !/^[\da-f]+$/i.test(key)) {
    throw new Error("invalidHubCredentialsEncryptionKey")
  }
  return hexToBytes(key)
}

async function encryptionKey() {
  return await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  )
}

function additionalData(hubId: Id<"hubs">, tokenVersion: number) {
  return new TextEncoder().encode(
    `workhal:deputy-credentials:v1:${hubId}:${tokenVersion}`
  )
}

export async function encryptDeputyTokens(args: {
  hubId: Id<"hubs">
  tokenVersion: number
  tokens: DeputyTokens
}) {
  const tokenInitializationVector = crypto.getRandomValues(
    new Uint8Array(AES_GCM_IV_BYTES)
  )
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: tokenInitializationVector,
      additionalData: additionalData(args.hubId, args.tokenVersion),
    },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(args.tokens))
  )
  return {
    tokenCiphertext: bytesToHex(new Uint8Array(ciphertext)),
    tokenInitializationVector: bytesToHex(tokenInitializationVector),
  }
}

export async function decryptDeputyTokens(args: {
  hubId: Id<"hubs">
  tokenVersion: number
  tokenCiphertext: string
  tokenInitializationVector: string
}): Promise<DeputyTokens> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: hexToBytes(args.tokenInitializationVector),
        additionalData: additionalData(args.hubId, args.tokenVersion),
      },
      await encryptionKey(),
      hexToBytes(args.tokenCiphertext)
    )
    const value: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    if (
      !value ||
      typeof value !== "object" ||
      !("accessToken" in value) ||
      typeof value.accessToken !== "string" ||
      !("refreshToken" in value) ||
      typeof value.refreshToken !== "string"
    ) {
      throw new TypeError()
    }
    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
    }
  } catch {
    throw new Error("deputyCredentialsUnavailable")
  }
}
