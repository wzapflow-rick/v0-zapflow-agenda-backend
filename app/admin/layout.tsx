import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin - ZapFlow Agenda",
  description: "Painel administrativo do ZapFlow Agenda",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="bg-background">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
