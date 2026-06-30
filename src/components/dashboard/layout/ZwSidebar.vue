<template>
	<!-- Mobile: V0 Dialog overlay (focus trap, ESC, ::backdrop) -->
	<Dialog.Root v-if="modeIsMobile" v-model="mobileOpenModel">
		<Dialog.Content
			class="zw-sidebar__dialog"
			:close-on-click-outside="true"
		>
			<aside class="zw-sidebar zw-sidebar--mobile">
				<SidebarBody
					:wide="true"
					:show-close="true"
					:show-collapse="false"
					@close="mobileOpenModel = false"
				/>
			</aside>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Desktop / tablet -->
	<aside
		v-else
		class="zw-sidebar"
		:class="{ 'zw-sidebar--collapsed': mode === 'collapsed' }"
	>
		<SidebarBody
			:wide="mode === 'wide'"
			:show-close="false"
			:show-collapse="!!showCollapseToggle"
			@toggle-collapse="emit('toggleCollapse')"
		/>
	</aside>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, type Component } from 'vue'
import { Dialog } from '@vuetify/v0'
import { storeToRefs } from 'pinia'
import useDashboardStore from '@/stores/dashboard'
import ZwUpdateNotifier from '@/components/dashboard/atoms/ZwUpdateNotifier.vue'
import {
	AlertIcon,
	ChevronRightIcon,
	ControllerIcon,
	DownloadIcon,
	GraphIcon,
	GridIcon,
	ICON_SIZE,
	NetworkIcon,
	PlayIcon,
	PowerIcon,
	PulseIcon,
	QrIcon,
	RefreshIcon,
	SceneIcon,
	SettingsIcon,
	StopIcon,
	XIcon,
} from '@/lib/icons'

export type SidebarMode = 'wide' | 'collapsed' | 'mobile'

export type RowActionIcon = 'play' | 'stop'

export interface RowAction {
	navId: string
	id: string
	ariaLabel: string
	icon: RowActionIcon
	iconActive?: RowActionIcon
	tone?: 'default' | 'danger'
	active: boolean
}

const props = defineProps<{
	active: string
	mode: SidebarMode
	mobileOpen?: boolean
	rowActions?: RowAction[]
	showCollapseToggle?: boolean
}>()

const emit = defineEmits<{
	select: [string]
	'update:mobileOpen': [boolean]
	toggleCollapse: []
	rowAction: [string, string]
	restart: []
	checkUpdates: []
}>()

const store = useDashboardStore()
const {
	deviceCount,
	attentionCount,
	activityCount,
	homeHex,
	appVersion,
	zwaveVersion,
} = storeToRefs(store)

const modeIsMobile = computed(() => props.mode === 'mobile')

const mobileOpenModel = computed<boolean>({
	get: () => !!props.mobileOpen,
	set: (v) => emit('update:mobileOpen', v),
})

type NavEntry =
	| { kind: 'section'; label: string }
	| {
			kind: 'item'
			id: string
			icon: keyof typeof ICONS
			label: string
			meta?: 'count' | 'attention' | 'activity'
	  }

const ICONS = {
	graph: GraphIcon,
	alert: AlertIcon,
	pulse: PulseIcon,
	qr: QrIcon,
	scene: SceneIcon,
	grid: GridIcon,
	network: NetworkIcon,
	settings: SettingsIcon,
	download: DownloadIcon,
	controller: ControllerIcon,
} as const

const NAV_ENTRIES: NavEntry[] = [
	{ kind: 'section', label: 'Network' },
	{
		kind: 'item',
		id: 'overview',
		icon: 'graph',
		label: 'Overview',
		meta: 'count',
	},
	{
		kind: 'item',
		id: 'attention',
		icon: 'alert',
		label: 'Needs attention',
		meta: 'attention',
	},
	{
		kind: 'item',
		id: 'activity',
		icon: 'pulse',
		label: 'Activity',
		meta: 'activity',
	},
	{ kind: 'section', label: 'Manage' },
	{ kind: 'item', id: 'smart-start', icon: 'qr', label: 'Smart Start' },
	{ kind: 'item', id: 'scenes', icon: 'scene', label: 'Scenes' },
	{
		kind: 'item',
		id: 'configuration-templates',
		icon: 'grid',
		label: 'Templates',
	},
	{ kind: 'item', id: 'mesh', icon: 'network', label: 'Network graph' },
	{ kind: 'section', label: 'System' },
	{ kind: 'item', id: 'settings', icon: 'settings', label: 'Settings' },
	{ kind: 'item', id: 'store', icon: 'download', label: 'Store' },
	{ kind: 'item', id: 'debug', icon: 'controller', label: 'Debug' },
]

const rowActionsByNav = computed(() => {
	const map: Record<string, RowAction[]> = {}
	for (const ra of props.rowActions ?? []) {
		;(map[ra.navId] ??= []).push(ra)
	}
	return map
})

function metaValue(entry: Extract<NavEntry, { kind: 'item' }>): number | null {
	if (entry.meta === 'count') return deviceCount.value
	if (entry.meta === 'attention') {
		return attentionCount.value > 0 ? attentionCount.value : null
	}
	if (entry.meta === 'activity') {
		return activityCount.value > 0 ? activityCount.value : null
	}
	return null
}

function railBadge(
	entry: Extract<NavEntry, { kind: 'item' }>,
): { show: false } | { show: true; tone: 'danger' | 'accent'; label: string } {
	if (entry.meta !== 'attention' && entry.meta !== 'activity') {
		return { show: false }
	}
	const v = metaValue(entry)
	if (v === null) return { show: false }
	return {
		show: true,
		tone: entry.meta === 'attention' ? 'danger' : 'accent',
		label: String(v),
	}
}

// On the collapsed rail, an active row action surfaces as a status dot
// on the nav icon, toned to match the action.
function railActionDot(
	entry: Extract<NavEntry, { kind: 'item' }>,
): { show: false } | { show: true; tone: 'danger' | 'accent' } {
	const action = (rowActionsByNav.value[entry.id] ?? []).find((a) => a.active)
	if (!action) return { show: false }
	return { show: true, tone: action.tone === 'danger' ? 'danger' : 'accent' }
}

function onSelect(navId: string): void {
	emit('select', navId)
	if (modeIsMobile.value) emit('update:mobileOpen', false)
}

const ROW_ACTION_ICONS: Record<RowActionIcon, Component> = {
	play: PlayIcon,
	stop: StopIcon,
}

const SidebarBody = defineComponent({
	props: {
		wide: { type: Boolean, required: true },
		showClose: { type: Boolean, required: true },
		showCollapse: { type: Boolean, required: true },
	},
	emits: ['close', 'toggleCollapse'],
	setup(p, { emit: bodyEmit }) {
		return () => {
			const isWide = p.wide
			return h('div', { class: 'zw-sb' }, [
				renderBrand(isWide, p.showClose, p.showCollapse, bodyEmit),
				!isWide && p.showCollapse ? renderRailExpand(bodyEmit) : null,
				renderNav(isWide),
				isWide ? renderFooterWide() : renderFooterRail(),
			])
		}
	},
})

function renderBrand(
	isWide: boolean,
	showClose: boolean,
	showCollapse: boolean,
	bodyEmit: (e: 'close' | 'toggleCollapse') => void,
) {
	return h(
		'div',
		{
			class: ['zw-sb__brand', { 'zw-sb__brand--rail': !isWide }],
		},
		[
			h('div', { class: 'zw-sb__logo' }, 'Z'),
			isWide
				? h('div', { class: 'zw-sb__brand-text' }, [
						h('div', { class: 'zw-sb__home' }, 'Z-Wave JS UI'),
						h(
							'div',
							{ class: 'zw-sb__home-id', title: 'Home ID' },
							homeHex.value || '—',
						),
					])
				: null,
			isWide && showClose
				? h(
						'button',
						{
							class: 'zw-sb__icon-btn',
							title: 'Close',
							'aria-label': 'Close sidebar',
							onClick: () => bodyEmit('close'),
						},
						h(XIcon, { size: ICON_SIZE.nav }),
					)
				: null,
			isWide && showCollapse
				? h(
						'button',
						{
							class: 'zw-sb__icon-btn',
							title: 'Collapse sidebar',
							'aria-label': 'Collapse sidebar',
							onClick: () => bodyEmit('toggleCollapse'),
						},
						h(ChevronRightIcon, {
							size: ICON_SIZE.nav,
							style: 'transform: rotate(180deg)',
						}),
					)
				: null,
		],
	)
}

function renderRailExpand(bodyEmit: (e: 'close' | 'toggleCollapse') => void) {
	return h('div', { class: 'zw-sb__rail-expand' }, [
		h(
			'button',
			{
				class: 'zw-sb__icon-btn zw-sb__icon-btn--square',
				title: 'Expand sidebar',
				'aria-label': 'Expand sidebar',
				onClick: () => bodyEmit('toggleCollapse'),
			},
			h(ChevronRightIcon, { size: ICON_SIZE.nav }),
		),
	])
}

function renderNav(isWide: boolean) {
	return h(
		'nav',
		{ class: ['zw-sb__nav', { 'zw-sb__nav--rail': !isWide }] },
		NAV_ENTRIES.map((entry, i) => renderEntry(entry, i, isWide)),
	)
}

function renderEntry(entry: NavEntry, i: number, isWide: boolean) {
	if (entry.kind === 'section') {
		if (isWide) {
			return h(
				'div',
				{ class: 'zw-sb__section', key: `s-${i}` },
				entry.label,
			)
		}
		if (i === 0) {
			return h('div', { class: 'zw-sb__rail-spacer', key: `s-${i}` })
		}
		return h(
			'div',
			{ class: 'zw-sb__rail-divider', key: `s-${i}` },
			h('span'),
		)
	}
	const isActive = props.active === entry.id
	if (!isWide) {
		const badge = railBadge(entry)
		const dot = badge.show ? { show: false as const } : railActionDot(entry)
		return h(
			'button',
			{
				class: ['zw-sb__rail-btn', { 'is-active': isActive }],
				title: entry.label,
				key: entry.id,
				onClick: () => onSelect(entry.id),
			},
			[
				h(ICONS[entry.icon], { size: ICON_SIZE.topbar }),
				badge.show
					? h(
							'span',
							{
								class: [
									'zw-sb__rail-badge',
									`zw-sb__rail-badge--${badge.tone}`,
								],
							},
							badge.label,
						)
					: null,
				dot.show
					? h('span', {
							class: [
								'zw-sb__rail-dot',
								`zw-sb__rail-dot--${dot.tone}`,
							],
						})
					: null,
			],
		)
	}
	const meta = metaValue(entry)
	const isAttention =
		entry.meta === 'attention' && (attentionCount.value ?? 0) > 0
	const actions = rowActionsByNav.value[entry.id] ?? []
	return h(
		'div',
		{
			class: [
				'zw-sb__row',
				{
					'is-active': isActive,
					'zw-sb__row--with-actions': actions.length > 0,
				},
			],
			key: entry.id,
		},
		[
			h(
				'button',
				{
					class: 'zw-sb__row-btn',
					onClick: () => onSelect(entry.id),
				},
				[
					h(ICONS[entry.icon], {
						size: ICON_SIZE.nav,
						class: 'zw-sb__row-icon',
					}),
					h('span', { class: 'zw-sb__row-label' }, entry.label),
					meta !== null && actions.length === 0
						? h(
								'span',
								{
									class: [
										'zw-sb__row-meta',
										{
											'zw-sb__row-meta--danger':
												isAttention,
										},
									],
								},
								String(meta),
							)
						: null,
				],
			),
			...actions.map((ra) => {
				const glyph = ra.active ? (ra.iconActive ?? ra.icon) : ra.icon
				return h(
					'button',
					{
						key: ra.id,
						type: 'button',
						class: [
							'zw-sb__row-action',
							{
								'zw-sb__row-action--danger':
									ra.tone === 'danger',
								'is-active': ra.active,
							},
						],
						title: ra.ariaLabel,
						'aria-label': ra.ariaLabel,
						'aria-pressed': ra.active,
						onClick: (e: MouseEvent) => {
							e.stopPropagation()
							emit('rowAction', entry.id, ra.id)
						},
					},
					h(ROW_ACTION_ICONS[glyph], {
						size: ICON_SIZE.dense,
						// Solid fill for stop; line-style for play (looks better).
						...(glyph === 'stop' ? { fill: 'currentColor' } : {}),
						'aria-hidden': 'true',
					}),
				)
			}),
		],
	)
}

function renderFooterWide() {
	return h('div', { class: 'zw-sb__footer' }, [
		h('div', { class: 'zw-sb__credit' }, [
			h('span', { class: 'zw-sb__credit-line' }, [
				h('span', 'Made with'),
				h(
					'span',
					{ class: 'zw-sb__heart', 'aria-hidden': 'true' },
					'♥',
				),
				h('span', 'by'),
				h('span', { class: 'zw-sb__credit-name' }, 'Daniel Lando'),
			]),
			h('span', { class: 'zw-sb__credit-line' }, [
				h('span', 'Enjoying it?'),
				h(
					'a',
					{
						class: 'zw-sb__credit-link',
						href: 'https://github.com/sponsors/robertsLando',
						target: '_blank',
						rel: 'noopener noreferrer',
					},
					'Support me',
				),
				h('span', { 'aria-hidden': 'true' }, '🙌'),
			]),
		]),
		h('div', { class: 'zw-sb__hr' }),
		h('div', { class: 'zw-sb__versions' }, [
			h('div', { class: 'zw-sb__version-row' }, [
				h('span', { class: 'zw-sb__version-name' }, [
					h('span', 'Z-Wave JS UI'),
					h(
						'button',
						{
							class: 'zw-sb__icon-btn zw-sb__icon-btn--tiny',
							title: 'Check for updates',
							'aria-label': 'Check for updates',
							onClick: () => emit('checkUpdates'),
						},
						h(RefreshIcon, { size: 11 }),
					),
				]),
				h('span', { class: 'zw-sb__version-value' }, appVersion.value),
			]),
			h('div', { class: 'zw-sb__version-row' }, [
				h('span', { class: 'zw-sb__version-name' }, 'Z-Wave JS'),
				h(
					'span',
					{ class: 'zw-sb__version-value' },
					zwaveVersion.value,
				),
			]),
		]),
		h(ZwUpdateNotifier, { current: '11.17.0', available: '11.18.1' }),
		h('div', { class: 'zw-sb__conn' }, [
			h('span', { class: 'zw-sb__avatar' }, 'A'),
			h('span', { class: 'zw-sb__conn-stack' }, [
				h('span', { class: 'zw-sb__conn-user' }, 'admin'),
				h('span', { class: 'zw-sb__conn-status' }, [
					h('span', { class: 'zw-sb__conn-dot' }),
					'connected',
				]),
			]),
			h(
				'button',
				{
					class: 'zw-sb__restart',
					title: 'Restart Z-Wave JS UI',
					'aria-label': 'Restart Z-Wave JS UI',
					onClick: () => emit('restart'),
				},
				h(PowerIcon, { size: ICON_SIZE.inline }),
			),
		]),
	])
}

function renderFooterRail() {
	return h('div', { class: 'zw-sb__footer-rail' }, [
		h(ZwUpdateNotifier, {
			current: '11.17.0',
			available: '11.18.1',
			compact: true,
		}),
		h(
			'div',
			{
				class: 'zw-sb__conn-rail',
				title: `connected · v${appVersion.value}`,
			},
			[h('span', { class: 'zw-sb__conn-dot' })],
		),
	])
}
</script>

<style>
.zw-sidebar {
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
	height: 100%;
	overflow: hidden;
	width: 240px;
	background: var(--zw-card);
	border-right: 1px solid var(--zw-line-soft);
	box-shadow: 1px 0 0 rgba(0, 0, 0, 0.04);
	transition: width 0.18s ease;
}

.zw-sidebar--collapsed {
	width: 56px;
}

.zw-sidebar--mobile {
	width: 260px;
	max-width: 100%;
	border-right: 1px solid var(--zw-line-soft);
}

.zw-sidebar__dialog {
	margin: 0;
	padding: 0;
	border: none;
	background: transparent;
	width: auto;
	max-width: 100%;
	height: 100%;
	max-height: 100%;
	inset: 0 auto 0 0;
}

.zw-sidebar__dialog::backdrop {
	background: rgba(0, 0, 0, 0.4);
	animation: zw-fade-in 0.16s;
}

.zw-sb {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-width: 0;
	width: 100%;
}

/* ─ brand ─ */

.zw-sb__brand {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 0 12px 0 16px;
	border-bottom: 1px solid var(--zw-line-soft);
	box-sizing: border-box;
	height: 57px;
	flex-shrink: 0;
}

.zw-sb__brand--rail {
	justify-content: center;
	padding: 0;
}

.zw-sb__logo {
	width: 28px;
	height: 28px;
	border-radius: 6px;
	background: var(--zw-accent);
	color: #fff;
	font-weight: 700;
	font-size: 13px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.zw-sb__brand-text {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.zw-sb__home {
	font-size: 13px;
	font-weight: 600;
	color: var(--zw-fg);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 1.2;
}

.zw-sb__home-id {
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 500;
	color: var(--zw-fg-soft);
	letter-spacing: 0.2px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 1.2;
}

/* ─ icon buttons ─ */

.zw-sb__icon-btn {
	appearance: none;
	border: none;
	background: transparent;
	cursor: pointer;
	padding: 6px;
	border-radius: 6px;
	color: var(--zw-fg-soft);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font: inherit;
}

.zw-sb__icon-btn:hover {
	background: rgba(0, 0, 0, 0.04);
}

.zw-sb__icon-btn--square {
	width: 32px;
	height: 32px;
}

.zw-sb__icon-btn--tiny {
	width: 18px;
	height: 18px;
	padding: 0;
	border-radius: 3px;
	color: rgba(0, 0, 0, 0.45);
}

.zw-sb__icon-btn--tiny:hover {
	background: rgba(0, 0, 0, 0.04);
	color: var(--zw-accent);
}

.zw-sb__rail-expand {
	display: flex;
	justify-content: center;
	padding: 6px 0 2px;
}

/* ─ nav list ─ */

.zw-sb__nav {
	flex: 1;
	overflow-y: auto;
	padding: 8px 8px 16px;
}

.zw-sb__nav--rail {
	padding: 8px 0 16px;
}

.zw-sb__section {
	padding: 14px 10px 6px;
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.8px;
	text-transform: uppercase;
	color: var(--zw-fg-soft);
}

.zw-sb__rail-divider {
	display: flex;
	justify-content: center;
	padding: 8px 0;
}

.zw-sb__rail-divider span {
	width: 24px;
	height: 1px;
	background: rgba(0, 0, 0, 0.1);
}

.zw-sb__rail-spacer {
	height: 4px;
}

/* ─ rail row (collapsed) ─ */

.zw-sb__rail-btn {
	width: 40px;
	height: 40px;
	margin: 2px auto;
	display: flex;
	align-items: center;
	justify-content: center;
	appearance: none;
	border: none;
	cursor: pointer;
	background: transparent;
	color: var(--zw-fg-soft);
	border-radius: 8px;
	position: relative;
	font: inherit;
}

.zw-sb__rail-btn:hover {
	background: rgba(0, 0, 0, 0.04);
}

.zw-sb__rail-btn.is-active {
	background: var(--zw-accent-soft);
	color: var(--zw-accent);
}

.zw-sb__rail-badge {
	position: absolute;
	top: 4px;
	right: 4px;
	min-width: 14px;
	height: 14px;
	padding: 0 4px;
	border-radius: 7px;
	color: #fff;
	font-size: 9px;
	font-weight: 700;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.zw-sb__rail-badge--danger {
	background: var(--zw-danger);
}

.zw-sb__rail-badge--accent {
	background: var(--zw-accent);
}

/* Status dot for an active row action on the collapsed rail. */
.zw-sb__rail-dot {
	position: absolute;
	top: 6px;
	right: 6px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	box-shadow: 0 0 0 1.5px var(--zw-card);
}

.zw-sb__rail-dot--danger {
	background: var(--zw-danger);
}

.zw-sb__rail-dot--accent {
	background: var(--zw-accent);
}

/* ─ wide row ─ */

.zw-sb__row {
	width: 100%;
	display: flex;
	align-items: center;
	border-radius: 6px;
	background: transparent;
}

/* Highlight lives on the row (not the inner button) so it spans the full
   width and any row action sits inside the highlighted menu item. */
.zw-sb__row:hover {
	background: rgba(0, 0, 0, 0.04);
}

.zw-sb__row.is-active,
.zw-sb__row.is-active:hover {
	background: var(--zw-accent-soft);
}

.zw-sb__row--with-actions {
	padding-right: 6px;
}

.zw-sb__row-btn {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 12px;
	border-radius: 6px;
	appearance: none;
	border: none;
	cursor: pointer;
	background: transparent;
	color: var(--zw-fg);
	font-size: 13px;
	font-weight: 500;
	text-align: left;
	font-family: inherit;
}

.zw-sb__row.is-active .zw-sb__row-btn {
	color: var(--zw-accent);
	font-weight: 600;
}

.zw-sb__row-icon {
	color: var(--zw-fg-soft);
	flex-shrink: 0;
}

.zw-sb__row.is-active .zw-sb__row-icon {
	color: var(--zw-accent);
}

.zw-sb__row-label {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-sb__row-meta {
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--zw-fg-soft);
	/* Shared padding box so the numbers right-align whether or not the
	   meta carries a colored background (e.g. the attention chip). */
	padding: 1px 6px;
	border-radius: 8px;
}

.zw-sb__row-meta--danger {
	color: var(--zw-danger);
	background: var(--zw-danger-soft);
}

/* ─ row action (sibling button) ─ */

/* Mirrors .zw-sb__restart: neutral surface button with a subtle border. */
.zw-sb__row-action {
	appearance: none;
	cursor: pointer;
	font: inherit;
	box-sizing: border-box;
	width: 22px;
	height: 22px;
	padding: 0;
	border-radius: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border: 1px solid var(--zw-line);
	background: var(--zw-card);
	color: var(--zw-fg-soft);
	transition:
		background 0.12s,
		border-color 0.12s,
		color 0.12s;
}

.zw-sb__row-action:hover {
	background: rgba(0, 0, 0, 0.04);
	border-color: var(--zw-line2);
}

/* Capture toggle: neutral idle (play), red tint on hover, and a solid red
   stop state while a capture is running. */
.zw-sb__row-action--danger:hover {
	background: var(--zw-danger-soft);
	border-color: rgba(var(--v0-error), 0.4);
	color: var(--zw-danger);
}

.zw-sb__row-action--danger.is-active {
	background: var(--zw-danger-soft);
	border-color: rgba(var(--v0-error), 0.45);
	color: var(--zw-danger);
}

/* ─ footer (wide) ─ */

.zw-sb__footer {
	padding: 10px 12px 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.zw-sb__credit {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	font-size: 11px;
	line-height: 1.45;
	color: var(--zw-fg-soft);
	letter-spacing: 0.1px;
	row-gap: 2px;
}

.zw-sb__credit-line {
	display: inline-flex;
	align-items: baseline;
	gap: 3px;
}

.zw-sb__heart {
	color: var(--zw-danger);
	font-size: 12px;
}

.zw-sb__credit-name {
	font-weight: 600;
	color: var(--zw-fg);
}

.zw-sb__credit-link {
	color: var(--zw-accent);
	font-weight: 600;
	text-decoration: none;
}

.zw-sb__credit-link:hover {
	text-decoration: underline;
}

.zw-sb__hr {
	height: 1px;
	background: var(--zw-line-soft);
	margin: 0 -12px;
}

.zw-sb__versions {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.zw-sb__version-row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
}

.zw-sb__version-row:first-child {
	align-items: center;
}

.zw-sb__version-name {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 10px;
	color: var(--zw-fg-soft);
	letter-spacing: 0.2px;
}

.zw-sb__version-value {
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 600;
	color: var(--zw-fg);
}

.zw-sb__conn {
	display: flex;
	align-items: center;
	gap: 8px;
}

.zw-sb__avatar {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: #90a4ae;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 10px;
	font-weight: 600;
	flex-shrink: 0;
}

.zw-sb__conn-stack {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.zw-sb__conn-user {
	font-size: 12px;
	font-weight: 500;
	color: var(--zw-fg);
	line-height: 1.2;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-sb__conn-status {
	font-size: 10px;
	color: var(--zw-fg-soft);
	display: inline-flex;
	align-items: center;
	gap: 5px;
	line-height: 1.2;
}

.zw-sb__conn-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #43a047;
	box-shadow: 0 0 0 2px rgba(67, 160, 71, 0.18);
}

.zw-sb__restart {
	appearance: none;
	cursor: pointer;
	font: inherit;
	width: 28px;
	height: 28px;
	padding: 0;
	border-radius: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border: 1px solid rgba(0, 0, 0, 0.1);
	background: var(--zw-card);
	color: var(--zw-fg-soft);
	transition:
		background 0.12s,
		border-color 0.12s,
		color 0.12s;
}

.zw-sb__restart:hover {
	background: #fff3e0;
	border-color: rgba(251, 140, 0, 0.4);
	color: #e65100;
}

/* ─ footer (rail) ─ */

.zw-sb__footer-rail {
	padding: 8px 0 10px;
	border-top: 1px solid var(--zw-line-soft);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
}

.zw-sb__conn-rail {
	width: 32px;
	height: 32px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--zw-fg-soft);
}
</style>
