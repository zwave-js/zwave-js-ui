<template>
	<button
		type="button"
		class="zw-dlg-close zw-focus-ring"
		aria-label="Close"
		@click="emit('click', $event)"
	>
		<XIcon :size="ICON_SIZE.topbar" />
	</button>
</template>

<script setup lang="ts">
import { ICON_SIZE, XIcon } from '@/lib/icons'

const emit = defineEmits<{ click: [MouseEvent] }>()
</script>

<style scoped>
/* Negative margin pulls the tap target back to the header edge without
   shrinking it. Scoped rules ride the component's own data-attr, so they
   still apply after v-dialog teleports the content out of the DOM subtree. */
.zw-dlg-close {
	appearance: none;
	border: none;
	cursor: pointer;
	background: transparent;
	color: var(--zw-muted);
	padding: 6px;
	margin: -6px -8px 0 0;
	border-radius: var(--zw-radius-md);
	flex-shrink: 0;
	align-self: flex-start;
	display: inline-flex;
	transition:
		background 0.12s,
		color 0.12s;
}

.zw-dlg-close:hover {
	background: var(--zw-chip-bg);
	color: var(--zw-fg);
}
</style>
