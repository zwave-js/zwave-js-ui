<template>
	<Button.Root
		class="zw-update"
		:class="{ 'zw-update--compact': compact }"
		:aria-label="`Update available: ${current} → ${available}`"
		@click="emit('click')"
	>
		<DownloadIcon :size="compact ? ICON_SIZE.inline : ICON_SIZE.dense" />
		<span v-if="compact" class="zw-update__dot" />
		<span v-else class="zw-update__body">
			<span class="zw-update__title">Update available</span>
			<span class="zw-update__versions"
				>{{ current }} → {{ available }}</span
			>
		</span>
	</Button.Root>
</template>

<script setup lang="ts">
import { Button } from '@vuetify/v0'
import { DownloadIcon, ICON_SIZE } from '@/lib/icons'

defineProps<{
	current: string
	available: string
	compact?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<style>
.zw-update {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 6px 8px;
	border: 1px solid rgba(var(--v0-primary), 0.3);
	background: var(--zw-accent-soft);
	border-radius: 6px;
	color: var(--zw-accent-dark);
	text-align: left;
	cursor: pointer;
	font-family: inherit;
}

.zw-update:hover:not([data-disabled='true']) {
	background: rgba(var(--v0-primary-soft), 0.85);
}

.zw-update:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: 1px;
}

.zw-update__body {
	display: inline-flex;
	flex-direction: column;
	line-height: 1.2;
}

/* Design calls for 11/600, which has no type-scale role. */
.zw-update__title {
	font-size: 11px;
	font-weight: 600;
}

.zw-update__versions {
	font: var(--zw-text-mono-micro);
	color: var(--zw-fg-soft);
}

.zw-update--compact {
	position: relative;
	width: 32px;
	height: 32px;
	padding: 0;
	justify-content: center;
}

.zw-update__dot {
	position: absolute;
	top: 4px;
	right: 4px;
	width: 7px;
	height: 7px;
	background: var(--zw-accent);
	border-radius: 50%;
	box-shadow: 0 0 0 1.5px var(--zw-card);
}
</style>
