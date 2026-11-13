'use client'

import { useEffect, useRef } from 'react'
import type { Mesh, MeshBasicMaterial, BoxGeometry, WebGLRenderer } from 'three'

const COLORS = [0x00f0f0, 0x0000f0, 0xf0a000, 0xf0f000, 0x00f000, 0xf00000, 0xc8c8c8, 0x008080]

export function Field() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cancel = false
    let teardown = () => {}

    void import('three').then((THREE) => {
      if (cancel) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const renderer: WebGLRenderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
      })
      renderer.setClearColor(0x07080a, 1)

      const scene = new THREE.Scene()
      scene.fog = new THREE.Fog(0x07080a, 8, 18)
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40)
      camera.position.set(0, 0, 11)

      const rand = mulberry32(0x5eed)
      const geometries: BoxGeometry[] = [
        new THREE.BoxGeometry(0.72, 0.72, 0.16),
        new THREE.BoxGeometry(1.52, 0.72, 0.16),
        new THREE.BoxGeometry(0.72, 1.52, 0.16),
      ]
      const materials: MeshBasicMaterial[] = COLORS.map(
        (color) => new THREE.MeshBasicMaterial({ color: dim(color), fog: true }),
      )
      const pieces: Mesh[] = []

      const place = (mesh: Mesh, fromTop: boolean) => {
        const side = rand() < 0.5 ? -1 : 1
        mesh.position.set(side * (3.2 + rand() * 3.6), fromTop ? 7.4 + rand() * 1.6 : rand() * 14 - 7, -rand() * 6)
        mesh.rotation.z = (rand() - 0.5) * 0.45
        mesh.userData.vy = 0.32 + rand() * 0.28
        mesh.userData.spin = (rand() - 0.5) * 0.18
      }

      for (let index = 0; index < 14; index += 1) {
        const mesh = new THREE.Mesh(geometries[index % geometries.length], materials[index % materials.length])
        place(mesh, false)
        scene.add(mesh)
        pieces.push(mesh)
      }

      const fit = () => {
        const width = window.innerWidth
        const height = window.innerHeight
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
        renderer.setSize(width, height, false)
        camera.aspect = width / Math.max(1, height)
        camera.updateProjectionMatrix()
      }
      fit()
      renderer.render(scene, camera)

      let raf = 0
      let last = performance.now()
      let acc = 0
      let running = !reduce && document.visibilityState === 'visible'

      const step = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        acc += dt
        if (acc < 1 / 30) return
        const elapsed = acc
        acc = 0
        for (const mesh of pieces) {
          mesh.position.y -= Number(mesh.userData.vy) * elapsed
          mesh.rotation.z += Number(mesh.userData.spin) * elapsed
          if (mesh.position.y < -7.6) place(mesh, true)
        }
        renderer.render(scene, camera)
      }

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop)
        step(now)
      }

      const onVis = () => {
        const next = !reduce && document.visibilityState === 'visible'
        if (next && !running) {
          running = true
          last = performance.now()
          acc = 0
          raf = requestAnimationFrame(loop)
        } else if (!next && running) {
          running = false
          cancelAnimationFrame(raf)
        }
      }

      if (running) raf = requestAnimationFrame(loop)
      window.addEventListener('resize', fit)
      document.addEventListener('visibilitychange', onVis)

      teardown = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', fit)
        document.removeEventListener('visibilitychange', onVis)
        for (const geometry of geometries) geometry.dispose()
        for (const material of materials) material.dispose()
        renderer.dispose()
      }
    })

    return () => {
      cancel = true
      teardown()
    }
  }, [])

  return <canvas ref={ref} className="field" aria-hidden="true" />
}

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dim(hex: number) {
  const mix = (channel: number, base: number) => Math.round(channel * 0.62 + base * 0.38)
  const red = mix((hex >> 16) & 255, 7)
  const green = mix((hex >> 8) & 255, 8)
  const blue = mix(hex & 255, 10)
  return (red << 16) + (green << 8) + blue
}
