<template>
	<Dialog.Root v-model="open">
		<Dialog.Content
			class="zw-drawer__panel"
			:close-on-click-outside="true"
		>
			<template v-if="device">
				<header class="zw-drawer__header">
					<div class="zw-drawer__icon">
						<component
							:is="device.archetype.icon"
							:size="ICON_SIZE.drawerHeader"
						/>
					</div>
					<div class="zw-drawer__name-col">
						<div class="zw-drawer__name">{{ device.name }}</div>
						<div class="zw-drawer__sub">
							Node {{ paddedNodeId }}
							<template v-if="device.manufacturer">
								· {{ device.manufacturer }}
							</template>
							<template v-if="device.productCode">
								· {{ device.productCode }}
							</template>
						</div>
					</div>
					<Dialog.Close
						as="button"
						class="zw-drawer__close"
						aria-label="Close drawer"
					>
						<XIcon :size="ICON_SIZE.topbar" />
					</Dialog.Close>
				</header>
				<div class="zw-drawer__body">
					<ZwNodeDetailsBody
						:device="device"
						@action="(d, a) => emit('action', d, a)"
					/>
				</div>
			</template>
		</Dialog.Content>
	</Dialog.Root>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog } from '@vuetify/v0'
import ZwNodeDetailsBody from '@/components/dashboard/components/ZwNodeDetailsBody.vue'
import { ICON_SIZE, XIcon } from '@/lib/icons'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device | null; viewport: number }>()
const emit = defineEmits<{
	close: []
	action: [Device, DeviceAction]
}>()

const paddedNodeId = computed(() =>
	String(props.device?.nodeId ?? 0).padStart(3, '0'),
)

const panelWidth = computed(() => {
	if (props.viewport < 600) return props.viewport
	return Math.max(460, Math.min(Math.round(props.viewport * 0.6), 1000))
})

// Bridge prop ↔ Dialog v-model. When the dialog closes itself (ESC, native
// cancel, click-outside), emit `close` so the parent can null the prop.
const open = ref(props.device !== null)

watch(
	() => props.device,
	(d) => {
		open.value = d !== null
	},
)

watch(open, (v) => {
	if (!v && props.device !== null) emit('close')
})
</script>

<style>
/* Unscoped — V0 primitives set inheritAttrs:false; .zw-drawer namespace is
   unique to this component. Native <dialog> is rendered by Dialog.Content;
   showModal() supplies focus trap, ESC handling, and the top-layer backdrop. */
.zw-drawer__panel {
	display: flex;
	flex-direction: column;
	position: fixed;
	inset: 0 0 0 auto;
	margin: 0;
	width: v-bind('panelWidth + "px"');
	max-width: 100%;
	height: 100%;
	max-height: 100%;
	background: var(--zw-card);
	box-shadow: var(--zw-e-drawer);
	border: none;
	padding: 0;
	overflow: hidden;
	color: var(--zw-fg);
}

/* Native <dialog> UA style hides closed dialogs via `dialog:not([open])`,
   but the author class above beats that selector in the cascade. Restate
   the hidden state explicitly so the panel is invisible until showModal(). */
.zw-drawer__panel:not([open]) {
	display: none;
}

.zw-drawer__panel[open] {
	animation: zw-slide-in-right 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.zw-drawer__panel::backdrop {
	background: rgba(30, 25, 20, 0.32);
	animation: zw-fade-in 0.18s;
}

@media (max-width: 600px) {
	.zw-drawer__panel {
		width: 100% !important;
	}
}

.zw-drawer__header {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 18px;
	border-bottom: 1px solid var(--zw-line);
}

.zw-drawer__icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	border-radius: 12px;
	background: var(--zw-chip-bg);
	color: var(--zw-fg);
	flex: 0 0 44px;
}

.zw-drawer__name-col {
	flex: 1;
	min-width: 0;
}

.zw-drawer__name {
	font-size: 16px;
	font-weight: 600;
	color: var(--zw-fg);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-drawer__sub {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	margin-top: 2px;
}

.zw-drawer__close {
	appearance: none;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--zw-fg-soft);
	padding: 6px;
	border-radius: 999px;
	transition: background 0.12s;
}

.zw-drawer__close:hover {
	background: rgba(0, 0, 0, 0.04);
}

.zw-drawer__close:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: 1px;
}

.zw-drawer__body {
	flex: 1;
	overflow-y: auto;
}
</style>
