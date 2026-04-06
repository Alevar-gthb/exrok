// app/layout.tsx — Root layout (wajib ada di Next.js App Router)
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Exrok — Ops System',
  description: 'Integrated Expense & Inventory System · Roketin & Spacehub',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
