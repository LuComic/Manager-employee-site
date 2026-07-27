import en from "@/messages/en.json"

export type AppMessageKey = keyof typeof en.App

const messageKeyByEnglish = new Map(
  Object.entries(en.App).map(([key, message]) => [
    message,
    key as AppMessageKey,
  ])
)

export function resolveMessageKey(messageOrKey: string) {
  if (Object.hasOwn(en.App, messageOrKey)) {
    return messageOrKey as AppMessageKey
  }

  return messageKeyByEnglish.get(messageOrKey)
}

export function getMessageKey(messageOrKey: string) {
  const key = resolveMessageKey(messageOrKey)
  if (!key) {
    throw new Error(`Unknown app message: ${JSON.stringify(messageOrKey)}`)
  }

  return key
}
