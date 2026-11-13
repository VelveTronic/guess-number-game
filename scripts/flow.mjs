import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = 'http://localhost:3000'
await mkdir('test-results', { recursive: true })

const browser = await chromium.launch()
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
const a = await browser.newContext(phone)
const b = await browser.newContext(phone)
const pageA = await a.newPage()
const pageB = await b.newPage()

async function digits(page, value) {
  for (const digit of value) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }
  await page.getByRole('button', { name: '下落' }).click()
}

async function roomJson(page) {
  return page.evaluate(async () => {
    const id = localStorage.getItem('guess-player')
    const code = new URLSearchParams(location.search).get('room')
    const response = await fetch(`/api/rooms/${code}`, { headers: { 'x-player-id': id ?? '' } })
    return response.json()
  })
}

await pageA.goto(base)
await pageA.screenshot({ path: 'test-results/home.png' })
const homeText = (await pageA.locator('body').innerText()).replace(/\s+/g, ' ').trim()
const match = await pageA.getByRole('button', { name: '匹配' }).boundingBox()
if (!match || match.y + match.height > 844) throw new Error(`匹配不在第一屏 ${JSON.stringify(match)}`)
await pageA.getByRole('button', { name: '开房' }).click()
await pageA.waitForFunction(() => location.search.includes('room='))
const code = new URL(pageA.url()).searchParams.get('room')
if (!code) throw new Error('没有房间码')
await pageA.screenshot({ path: 'test-results/wait.png' })

await pageB.goto(`${base}/?room=${code}`)
await pageA.getByRole('button', { name: '下落' }).waitFor()
await pageB.getByRole('button', { name: '下落' }).waitFor()
await digits(pageA, '1234')
await digits(pageB, '7541')
await pageA.screenshot({ path: 'test-results/locked.png' })

await digits(pageA, '4444')
await pageA.locator('.well [data-hits="1"]').waitFor()
const hidden = await roomJson(pageA)
if (hidden.oppSecret !== null) throw new Error(`秘密漏了 ${JSON.stringify(hidden)}`)
if (JSON.stringify(hidden).includes('7541')) throw new Error('响应里出现了对方的数')
if (hidden.guesses?.[0]?.hits !== 1) throw new Error(`命中不是 1 ${JSON.stringify(hidden.guesses)}`)
const open = await pageA.locator('.target').getAttribute('data-open')
if (open) throw new Error(`终局前翻开了 ${open}`)
await pageA.screenshot({ path: 'test-results/guess.png' })

await digits(pageB, '0000')
await digits(pageA, '7541')
await pageA.locator('.target[data-open="7541"]').waitFor()
await pageB.locator('.target[data-open="1234"]').waitFor()
await pageA.screenshot({ path: 'test-results/win.png' })

await pageA.getByRole('button', { name: '记' }).click()
await pageA.locator('[data-pos="0"][data-digit="4"]').click()
await pageA.screenshot({ path: 'test-results/notes.png' })
await pageA.reload()
await pageA.getByRole('button', { name: '记' }).waitFor()
await pageA.getByRole('button', { name: '记' }).click()
await pageA.locator('[data-pos="0"][data-digit="4"].out').waitFor()

await pageA.setViewportSize({ width: 844, height: 390 })
await pageA.screenshot({ path: 'test-results/landscape.png' })

console.log('HOME', homeText)
console.log('ROOM', code)
console.log('flow ok')
await browser.close()
