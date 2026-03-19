<template>
  <canvas ref="canvasEl" class="event-canvas" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasEl = ref(null)
let animFrameId = null

onMounted(() => {
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d')
  let w = canvas.width = window.innerWidth
  let h = canvas.height = window.innerHeight

  const particles = Array.from({ length: 28 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0.25 + Math.random() * 0.9,
    vy: -0.2 + Math.random() * 0.45,
    r: 0.8 + Math.random() * 1.8,
    c: Math.random() > 0.5 ? '0,200,149' : '194,247,255'
  }))

  function draw() {
    ctx.clearRect(0, 0, w, h)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x > w + 10) p.x = -10
      if (p.y > h + 10) p.y = -10
      if (p.y < -10) p.y = h + 10
      ctx.beginPath()
      ctx.fillStyle = `rgba(${p.c},0.78)`
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    animFrameId = requestAnimationFrame(draw)
  }

  draw()

  function onResize() {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight
  }
  window.addEventListener('resize', onResize)

  onUnmounted(() => {
    cancelAnimationFrame(animFrameId)
    window.removeEventListener('resize', onResize)
  })
})
</script>

<style scoped>
.event-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  opacity: 0.25;
  pointer-events: none;
}
</style>
