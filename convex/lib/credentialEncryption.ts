import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"

import type { Id } from "../_generated/dataModel"
import { env } from "../_generated/server"

const AES_GCM_IV_BYTES = 12
const AES_256_KEY_HEX_LENGTH = 64

type HubCredentials = {
  joinCode: string
  privateToken: string
}

type EncryptedHubCredentials = {
  ciphertext: string
  initializationVector: string
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

function additionalData(hubId: Id<"hubs">, credentialVersion: number) {
  return new TextEncoder().encode(
    `workhal:hub-credentials:v1:${hubId}:${credentialVersion}`
  )
}

export async function encryptHubCredentials(args: {
  hubId: Id<"hubs">
  credentialVersion: number
  credentials: HubCredentials
}): Promise<EncryptedHubCredentials> {
  const initializationVector = crypto.getRandomValues(
    new Uint8Array(AES_GCM_IV_BYTES)
  )
  const plaintext = new TextEncoder().encode(JSON.stringify(args.credentials))
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: initializationVector,
      additionalData: additionalData(args.hubId, args.credentialVersion),
    },
    await encryptionKey(),
    plaintext
  )
  return {
    ciphertext: bytesToHex(new Uint8Array(ciphertext)),
    initializationVector: bytesToHex(initializationVector),
  }
}

export async function decryptHubCredentials(args: {
  hubId: Id<"hubs">
  credentialVersion: number
  ciphertext: string
  initializationVector: string
}): Promise<HubCredentials> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: hexToBytes(args.initializationVector),
        additionalData: additionalData(args.hubId, args.credentialVersion),
      },
      await encryptionKey(),
      hexToBytes(args.ciphertext)
    )
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("joinCode" in parsed) ||
      typeof parsed.joinCode !== "string" ||
      !("privateToken" in parsed) ||
      typeof parsed.privateToken !== "string"
    ) {
      throw new TypeError()
    }
    return {
      joinCode: parsed.joinCode,
      privateToken: parsed.privateToken,
    }
  } catch {
    throw new Error("hubCredentialsUnavailable")
  }
}
