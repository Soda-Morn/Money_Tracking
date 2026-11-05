<script setup>
/**
 * The ONLY way icons are rendered in FinanceFlow.
 *
 *   UI icon:    <AppIcon :icon="Pencil" size="action" />
 *   Data icon:  <AppIcon :name="category.icon" fallback="tag" size="button" />
 *
 * `size` takes a token from ICON_SIZE (xs, action, button, nav, card, hero)
 * or a number in px. Stroke width follows the shared rule in strokeFor().
 * Icons are decorative (aria-hidden) — put accessible text on the button/label.
 */
import { computed } from 'vue'
import { ICON_SIZE, strokeFor, resolveIcon } from '../../icons'

const props = defineProps({
  icon: { type: [Object, Function], default: null },
  name: { type: String, default: '' },
  fallback: { type: String, default: 'tag' },
  size: { type: [String, Number], default: 'button' },
  strokeWidth: { type: Number, default: null },
})

const px = computed(() => (typeof props.size === 'number' ? props.size : ICON_SIZE[props.size] ?? ICON_SIZE.button))
const component = computed(() => props.icon || resolveIcon(props.name, props.fallback))
const stroke = computed(() => props.strokeWidth ?? strokeFor(px.value))
</script>

<template>
  <component
    :is="component"
    :size="px"
    :stroke-width="stroke"
    class="shrink-0"
    aria-hidden="true"
    focusable="false"
  />
</template>
