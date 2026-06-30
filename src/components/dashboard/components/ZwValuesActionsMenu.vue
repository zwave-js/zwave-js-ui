<template>
	<Popover.Root v-model="open" :id="contentId">
		<Popover.Activator
			as="button"
			type="button"
			class="zw-vam__trigger zw-focus-ring"
			aria-label="More actions"
			aria-haspopup="menu"
		>
			<MoreIcon :size="ICON_SIZE.std" />
		</Popover.Activator>
		<Popover.Content as="div" class="zw-vam__panel" role="menu">
			<button
				type="button"
				class="zw-vam__item"
				role="menuitem"
				@click="run('refresh-all')"
			>
				<RefreshIcon
					:size="ICON_SIZE.chip"
					class="zw-vam__icon zw-vam__icon--accent"
				/>
				Refresh all values
			</button>
			<div class="zw-vam__sep" />
			<button
				type="button"
				class="zw-vam__item"
				role="menuitem"
				@click="run('expand-all')"
			>
				<ChevronDownIcon :size="ICON_SIZE.chip" class="zw-vam__icon" />
				Expand all
			</button>
			<button
				type="button"
				class="zw-vam__item"
				role="menuitem"
				@click="run('collapse-all')"
			>
				<ChevronRightIcon :size="ICON_SIZE.chip" class="zw-vam__icon" />
				Collapse all
			</button>
		</Popover.Content>
	</Popover.Root>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { Popover } from '@vuetify/v0'
import {
	ChevronDownIcon,
	ChevronRightIcon,
	ICON_SIZE,
	MoreIcon,
	RefreshIcon,
} from '@/lib/icons'
import { usePopoverFallback } from '@/lib/popover-fallback.ts'

const emit = defineEmits<{
	'refresh-all': []
	'expand-all': []
	'collapse-all': []
}>()

const open = ref(false)
const contentId = `zw-vam-${useId()}`

usePopoverFallback({ open, contentId })

function run(event: 'refresh-all' | 'expand-all' | 'collapse-all') {
	open.value = false
	emit(event)
}
</script>

<style>
.zw-vam__trigger {
	appearance: none;
	background: transparent;
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	width: 28px;
	height: 28px;
	padding: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--zw-muted);
	cursor: pointer;
}

.zw-vam__trigger[data-open] {
	background: var(--zw-chip-bg);
}

.zw-vam__panel {
	position-area: none !important;
	position-anchor: auto !important;
	min-width: 200px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line-soft);
	border-radius: 6px;
	box-shadow: var(--zw-e8);
	overflow: hidden;
	animation: zw-fade-in 0.12s;
}

.zw-vam__panel::backdrop {
	display: none;
}

.zw-vam__item {
	display: flex;
	align-items: center;
	gap: 9px;
	width: 100%;
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 8px 12px;
	color: var(--zw-fg);
	font: var(--zw-text-body-s);
	text-align: left;
}

.zw-vam__item:hover {
	background: var(--zw-row-hover);
}

.zw-vam__icon {
	color: var(--zw-muted);
}

.zw-vam__icon--accent {
	color: var(--zw-accent);
}

.zw-vam__sep {
	height: 1px;
	background: var(--zw-line);
	margin: 2px 0;
}
</style>
