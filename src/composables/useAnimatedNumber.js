import { ref, watch, onBeforeUnmount, isRef } from 'vue'

/**
 * Smoothly counts a displayed number toward its new value (display only —
 * the real value is never altered). Skips the animation for users who prefer
 * reduced motion. ~450ms ease-out; cancels cleanly on unmount.
 */
export function useAnimatedNumber(source, duration = 450) {
  const read = () => Number(isRef(source) ? source.value : source()) || 0
  const display = ref(read())
  let frame = null

  const reduced = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  watch(read, (to) => {
    cancelAnimationFrame(frame)
    const from = display.value
    if (reduced() || from === to) { display.value = to; return }
    const start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      display.value = p < 1 ? from + (to - from) * eased : to
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  })

  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return display
}
