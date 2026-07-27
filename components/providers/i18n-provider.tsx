"use client"

import { createContext, useCallback, useContext, useMemo } from "react"

import {
  languageTags,
  localizeHref,
  type Locale,
  localeCookieName,
} from "@/i18n/config"
import type { Messages } from "@/i18n/messages"

type Variables = Record<string, string | number>

type I18nContextValue = {
  locale: Locale
  messages: Messages
}

const I18nContext = createContext<I18nContextValue | null>(null)

function formatMessage(message: string, variables?: Variables) {
  if (!variables) return message

  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in variables ? String(variables[key]) : placeholder
  )
}

export function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode
  locale: Locale
  messages: Messages
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages])

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used inside I18nProvider")

  const t = useCallback(
    (key: string, variables?: Variables) =>
      formatMessage(context.messages[key] ?? key, variables),
    [context.messages]
  )
  const href = useCallback(
    (value: string) => localizeHref(value, context.locale),
    [context.locale]
  )
  const setLocalePreference = useCallback((locale: Locale) => {
    document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [])

  return {
    locale: context.locale,
    languageTag: languageTags[context.locale],
    t,
    href,
    setLocalePreference,
  }
}

export function T({
  children,
  values,
}: {
  children: string | number
  values?: Variables
}) {
  const { t } = useI18n()
  return t(String(children), values)
}
