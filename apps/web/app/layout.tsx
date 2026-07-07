import { Source_Sans_3 } from "next/font/google"
import Link from "next/link"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", sourceSans3.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <header className="border-b border-border/50 px-6 py-3 flex items-center gap-6">
              <span className="font-semibold tracking-tight text-sm">metal</span>
              <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground transition-colors">Demo</Link>
                <Link href="/feed" className="hover:text-foreground transition-colors">Feed</Link>
                <Link href="/policy" className="hover:text-foreground transition-colors">Policy</Link>
              </nav>
            </header>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
