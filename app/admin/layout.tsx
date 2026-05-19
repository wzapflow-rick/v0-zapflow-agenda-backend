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
  return <>{children}</>
}
