<template>
	<Popover.Root v-model="open" :id="contentId">
		<Button.Group class="zw-asb__group">
			<Button.Root
				class="zw-asb__face"
				:class="{ 'zw-asb__face--compact': compact }"
				@click="onFaceClick"
			>
				<AddIcon :size="ICON_SIZE.inline" />
				<span v-if="!compact">{{ wide ? 'Add device' : 'Add' }}</span>
			</Button.Root>
			<span class="zw-asb__divider" />
			<Popover.Activator
				as="button"
				class="zw-asb__chev"
				:class="{ 'zw-asb__chev--open': open }"
				aria-haspopup="menu"
			>
				<ChevronDownIcon :size="ICON_SIZE.inline" />
			</Popover.Activator>
		</Button.Group>
		<Popover.Content as="div" class="zw-asb__menu" role="menu">
			<button
				v-for="item in MENU"
				:key="item.id"
				type="button"
				role="menuitem"
				class="zw-asb__item"
				:class="{ 'zw-asb__item--destructive': item.destructive }"
				@click="onItemClick(item.id)"
			>
				<span
					class="zw-asb__item-icon"
					:class="{
						'zw-asb__item-icon--destructive': item.destructive,
					}"
				>
					<component :is="item.icon" :size="ICON_SIZE.inline" />
				</span>
				<span class="zw-asb__item-text">
					<span class="zw-asb__item-title">{{ item.title }}</span>
					<span class="zw-asb__item-desc">{{ item.desc }}</span>
				</span>
			</button>
		</Popover.Content>
	</Popover.Root>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { Button, Popover } from '@vuetify/v0'
import {
	AddIcon,
	ChevronDownIcon,
	ICON_SIZE,
	RefreshIcon,
	TrashIcon,
} from '@/lib/icons'
import { usePopoverFallback } from '@/lib/popover-fallback.ts'

type Action = 'include' | 'replace-failed' | 'exclude'

defineProps<{
	compact?: boolean
	wide?: boolean
}>()

const emit = defineEmits<{ action: [Action] }>()

const open = ref(false)
const contentId = `zw-asb-${useId()}`

usePopoverFallback({ open, contentId })

const MENU = [
	{
		id: 'include' as const,
		icon: AddIcon,
		title: 'Include device',
		desc: 'Add a new device to the network',
		destructive: false,
	},
	{
		id: 'replace-failed' as const,
		icon: RefreshIcon,
		title: 'Replace failed device',
		desc: 'Swap an unresponsive node in place',
		destructive: false,
	},
	{
		id: 'exclude' as const,
		icon: TrashIcon,
		title: 'Exclude device',
		desc: 'Remove a device from the network',
		destructive: true,
	},
]

function onFaceClick(): void {
	emit('action', 'include')
}

function onItemClick(id: Action): void {
	emit('action', id)
	open.value = false
}
</script>

<style>
.zw-asb__group {
	display: inline-flex;
	border-radius: 6px;
	overflow: hidden;
	box-shadow: 0 1px 2px rgba(25, 118, 210, 0.3);
}

.zw-asb__face,
.zw-asb__chev {
	appearance: none;
	border: none;
	cursor: pointer;
	background: var(--zw-accent);
	color: #fff;
	font-family: var(--zw-font);
	font-weight: 600;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	transition: background 0.12s;
}

.zw-asb__face {
	font-size: 12px;
	padding: 7px 14px;
}

.zw-asb__face--compact {
	padding: 7px 9px;
}

.zw-asb__face:hover,
.zw-asb__chev:hover {
	background: var(--zw-accent-dark);
}

.zw-asb__divider {
	width: 1px;
	background: rgba(255, 255, 255, 0.28);
}

.zw-asb__chev {
	padding: 7px 10px;
}

.zw-asb__chev--open,
.zw-asb__chev[data-open] {
	background: var(--zw-accent-dark);
}

.zw-asb__chev--open svg,
.zw-asb__chev[data-open] svg {
	transform: rotate(180deg);
	transition: transform 0.15s;
}

/* V0 hard-codes `position-area: bottom` inline on the popover and Vue
   re-applies it on every render, so neutralise via stylesheet so Floating
   UI's manual top/left writes drive the actual position. See ZwToggleMenu. */
.zw-asb__menu {
	position-area: none !important;
	position-anchor: auto !important;
	min-width: 260px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	box-shadow: var(--zw-e8);
	padding: 4px;
	animation: zw-fade-in 0.12s;
}

.zw-asb__menu::backdrop {
	display: none;
}

.zw-asb__item {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 8px 10px;
	border-radius: 4px;
	text-align: left;
	color: var(--zw-fg);
	font-family: var(--zw-font);
	font-size: 13px;
}

.zw-asb__item:hover {
	background: var(--zw-row-hover);
}

.zw-asb__item--destructive {
	color: var(--zw-danger);
}

.zw-asb__item--destructive:hover {
	background: var(--zw-danger-soft);
}

.zw-asb__item-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 6px;
	background: var(--zw-accent-soft);
	color: var(--zw-accent);
	flex: 0 0 28px;
}

.zw-asb__item-icon--destructive {
	background: var(--zw-danger-soft);
	color: var(--zw-danger);
}

.zw-asb__item-text {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.zw-asb__item-title {
	font-weight: 600;
	font-size: 13px;
	line-height: 1.2;
}

.zw-asb__item-desc {
	font-size: 11px;
	color: var(--zw-muted);
	line-height: 1.2;
}

.zw-asb__item--destructive .zw-asb__item-desc {
	color: rgba(229, 57, 53, 0.7);
}
</style>
