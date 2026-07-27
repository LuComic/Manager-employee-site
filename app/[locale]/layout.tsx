import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Geist_Mono, Noto_Sans } from "next/font/google"

import "../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ConvexClientProvider } from "@/components/providers/convex-client-provider"
import { OperationsProvider } from "@/components/providers/operations-provider"
import { Toaster } from "@/components/ui/sonner"
import { toMessageKey } from "@/i18n/messages"
import { getPathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { clerkAppearance } from "@/lib/clerk-appearance"
import { cn } from "@/lib/utils"

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: "App" })

  return {
    title: t(toMessageKey("Operations hub")),
    description: t(
      toMessageKey(
        "Today’s information and practical guides for smooth shifts."
      )
    ),
  }
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        notoSans.variable
      )}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <ClerkProvider
            appearance={clerkAppearance}
            afterSignOutUrl={getPathname({ locale, href: "/" })}
          >
            <ConvexClientProvider>
              <ThemeProvider defaultTheme="light">
                <Suspense
                  fallback={<div className="min-h-svh bg-background" />}
                >
                  <OperationsProvider>{children}</OperationsProvider>
                </Suspense>
                <Toaster />
              </ThemeProvider>
            </ConvexClientProvider>
          </ClerkProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
