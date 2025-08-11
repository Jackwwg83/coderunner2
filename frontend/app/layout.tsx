import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono as GeistMono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const geistMono = GeistMono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CodeRunner2 - Deploy & Monitor",
  description: "Real-time deployment platform with live monitoring",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geistMono.className} bg-black text-white antialiased`}>
        {children}
        <Toaster 
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgb(23 23 23)',
              border: '1px solid rgb(64 64 64)',
              color: 'white',
            },
          }}
        />
      </body>
    </html>
  )
}
