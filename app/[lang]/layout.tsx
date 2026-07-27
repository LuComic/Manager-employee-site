import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Geist_Mono, Noto_Sans } from "next/font/google"

import "../globals.css"
import { I18nProvider } from "@/components/providers/i18n-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ConvexClientProvider } from "@/components/providers/convex-client-provider"
import { OperationsProvider } from "@/components/providers/operations-provider"
import { Toaster } from "@/components/ui/sonner"
import { clerkAppearance } from "@/lib/clerk-appearance"
import { cn } from "@/lib/utils"
import { isLocale, locales } from "@/i18n/config"
import { getMessages } from "@/i18n/messages"

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const messages = await getMessages(lang)

  return {
    title: messages["Operations hub"],
    description:
      messages["Today’s information and practical guides for smooth shifts."],
  }
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const messages = await getMessages(lang)

  return (
    <html
      lang={lang}
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
        <I18nProvider locale={lang} messages={messages}>
          <ClerkProvider
            appearance={clerkAppearance}
            afterSignOutUrl={`/${lang}`}
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
        </I18nProvider>
      </body>
    </html>
  )
}
