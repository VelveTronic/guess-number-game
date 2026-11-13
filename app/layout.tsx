import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'
import { Field } from '@/components/field'
import './globals.css'

const pixel = localFont({
  src: '../public/fonts/cabinet-pixel.woff2',
  display: 'block',
  adjustFontFallback: false,
})

export const metadata: Metadata = {
  title: '猜数字',
  description: '双人猜数字',
  applicationName: '猜数字',
  appleWebApp: { capable: true, statusBarStyle: 'black', title: '猜数字' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07080a',
}

const contract = `<!--
THESIS: The phone is the cabinet glass: one dropped row of bricks, one count back. No rules page, no chat log.
OWN-WORLD: Black well, square bricks, 1px light edge, 1px dark edge, one color per digit, ivory stamps. Behind the glass, flat bricks fall slowly in the dark. No glow, no violet wash, no gradient sky.
STORY: Both players lock a secret, trade one guess a turn, and mark a private grid.
FIRST VIEWPORT: Portrait cabinet. Title 猜数字. Thumb-zone bricks 开房, 加入, 匹配. The well holds length bricks 3 4 5 6 with one filled. No subtitle.
FORM: Brief-pinned arcade brick cabinet, Operate. User pin, no concept seed.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hans">
      <body className={pixel.className}>
        <div hidden dangerouslySetInnerHTML={{ __html: contract }} />
        <Field />
        {children}
      </body>
    </html>
  )
}
