<template>
	<button
		ref="el"
		type="button"
		class="zw-close zw-focus-ring"
		:class="{ 'zw-close--flush': flush }"
		:aria-label="label"
		@click="emit('click', $event)"
	>
		<XIcon :size="size" />
	</button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ICON_SIZE, XIcon } from '@/lib/icons'

const props = withDefaults(
	defineProps<{
		label?: string
		size?: number
		// Pull the tap target back to a container edge without shrinking it
		flush?: boolean
	}>(),
	{ label: 'Close', size: ICON_SIZE.topbar, flush: false },
)

const emit = defineEmits<{ click: [MouseEvent] }>()

const el = ref<HTMLButtonElement | null>(null)

defineExpose({ el, focus: () => el.value?.focus() })
</script>

<style scoped>
/* Scoped rules ride the component's own data-attr, so they still apply
   after v-dialog teleports the content out of the DOM subtree */
.zw-close {
	appearance: none;
	border: none;
	cursor: pointer;
	background: transparent;
	color: var(--zw-muted);
	padding: 6px;
	border-radius: var(--zw-radius-md);
	flex-shrink: 0;
	display: inline-flex;
	transition:
		background 0.12s,
		color 0.12s;
}

.zw-close--flush {
	margin: -6px -8px 0 0;
	align-self: flex-start;
}

.zw-close:hover {
	background: var(--zw-chip-bg);
	color: var(--zw-fg);
}
</style>
