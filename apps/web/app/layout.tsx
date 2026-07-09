import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google"

import "@workspace/ui/globals.css"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/app-shell"
import { cn } from "@workspace/ui/lib/utils"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export const metadata: Metadata = {
  metadataBase: new URL("https://metal-web.vercel.app"),
  title: "Bare Metal",
  description: "Unofficial Metal-inspired settlement infrastructure demo",
  openGraph: {
    title: "Bare Metal",
    description: "Unofficial Metal-inspired settlement infrastructure demo",
    url: "https://metal-web.vercel.app",
    siteName: "Bare Metal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bare Metal",
    description: "Unofficial Metal-inspired settlement infrastructure demo",
  },
}

const archivo = Archivo({ subsets: ["latin"], variable: "--font-sans" })
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif" })
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "dark font-sans antialiased",
        archivo.variable,
        newsreader.variable,
        plexMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
