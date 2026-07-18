import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import type { Metadata } from "next"
import { Suspense } from "react"
import { Geist_Mono, Noto_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ConvexClientProvider } from "@/components/providers/convex-client-provider"
import { OperationsProvider } from "@/components/providers/operations-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Operations hub",
  description: "Today’s information and practical guides for smooth shifts.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
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
        <ClerkProvider appearance={{ theme: shadcn }} afterSignOutUrl="/">
          <ConvexClientProvider>
            <ThemeProvider defaultTheme="light">
              <Suspense fallback={<div className="min-h-svh bg-background" />}>
                <OperationsProvider>{children}</OperationsProvider>
              </Suspense>
              <Toaster />
            </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
