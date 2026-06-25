<template>
	<header class="zw-topbar" :class="{ 'zw-topbar--compact': compact }">
		<Button.Root
			v-if="showMenuButton"
			class="zw-topbar__icon-btn"
			aria-label="Open menu"
			@click="emit('menu')"
		>
			<MenuIcon :size="ICON_SIZE.topbar" />
			<span
				v-if="menuBadge"
				class="zw-topbar__menu-badge"
				:class="`zw-topbar__menu-badge--${menuBadge.tone}`"
				:aria-label="menuBadge.aria"
			>
				{{ menuBadge.label }}
			</span>
		</Button.Root>

		<h1 v-if="viewport >= 760" class="zw-topbar__title">
			{{ scopeTitle }}
		</h1>

		<div class="zw-topbar__search">
			<ZwSearchInput
				:model-value="query"
				:placeholder="searchPlaceholder"
				:aria-label="'Search devices'"
				@update:model-value="(v) => emit('query', v)"
			/>
		</div>

		<span class="zw-topbar__spacer" />

		<Button.Root
			v-if="showActivityPill"
			class="zw-topbar__activity"
			:class="{ 'zw-topbar__activity--icon': !showActivityLabel }"
			:title="`Show activity (${activityCount})`"
			@click="emit('toggleActivity')"
		>
			<span class="zw-topbar__pulse" />
			<span v-if="showActivityLabel" class="zw-topbar__activity-label">
				<span>Activity</span>
				<span class="zw-topbar__activity-count">{{
					activityCount
				}}</span>
			</span>
			<span v-else class="zw-topbar__activity-badge">{{
				activityCount
			}}</span>
		</Button.Root>

		<ZwAddDeviceSplitButton
			class="zw-topbar__add"
			:wide="viewport >= 1100"
			:compact="compact"
			@action="(a) => emit('addAction', a)"
		/>
	</header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@vuetify/v0'
import { storeToRefs } from 'pinia'
import useDashboardStore from '@/stores/dashboard'
import ZwSearchInput from '@/components/dashboard/atoms/ZwSearchInput.vue'
import ZwAddDeviceSplitButton from '@/components/dashboard/components/ZwAddDeviceSplitButton.vue'
import { ICON_SIZE, MenuIcon } from '@/lib/icons'

type AddAction = 'include' | 'replace-failed' | 'exclude'

const props = defineProps<{
	query: string
	viewport: number
	scopeTitle: string
	activityHidden: boolean
	showMenuButton: boolean
}>()

const emit = defineEmits<{
	query: [string]
	menu: []
	toggleActivity: []
	addAction: [AddAction]
}>()

const store = useDashboardStore()
const { attentionCount, activityCount } = storeToRefs(store)

const compact = computed(() => props.viewport < 600)

const searchPlaceholder = computed(() =>
	compact.value ? 'Search…' : 'Search devices, locations, IDs…',
)

const menuBadge = computed<{
	tone: 'danger' | 'accent'
	label: string
	aria: string
} | null>(() => {
	if (attentionCount.value > 0) {
		return {
			tone: 'danger',
			label: String(attentionCount.value),
			aria: `${attentionCount.value} need attention`,
		}
	}
	if (activityCount.value > 0) {
		return {
			tone: 'accent',
			label: String(activityCount.value),
			aria: `${activityCount.value} active`,
		}
	}
	return null
})

const showActivityPill = computed(
	() => props.activityHidden && activityCount.value > 0,
)

const showActivityLabel = computed(() => props.viewport >= 760)
</script>

<style>
/* Unscoped — V0 primitives strip Vue's scoped data-v-* hash. .zw-topbar* is
   unique to this layout component. */

.zw-topbar {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 0 20px;
	background: var(--zw-card);
	border-bottom: 1px solid var(--zw-line-soft);
	box-shadow: var(--zw-e1);
	box-sizing: border-box;
	flex-shrink: 0;
	height: 57px;
	position: relative;
}

.zw-topbar--compact {
	padding: 0 12px;
	gap: 6px;
}

.zw-topbar__icon-btn {
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
	position: relative;
	font: inherit;
}

.zw-topbar__icon-btn:hover {
	background: rgba(0, 0, 0, 0.04);
}

.zw-topbar__menu-badge {
	position: absolute;
	top: 0;
	right: 0;
	min-width: 16px;
	height: 16px;
	padding: 0 4px;
	border-radius: 8px;
	color: #fff;
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 700;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: 2px solid var(--zw-card);
	transform: translate(35%, -35%);
}

.zw-topbar__menu-badge--danger {
	background: var(--zw-danger);
}

.zw-topbar__menu-badge--accent {
	background: var(--zw-accent);
}

.zw-topbar__title {
	font-size: 15px;
	font-weight: 600;
	color: var(--zw-fg);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	margin: 0;
	min-width: 0;
}

.zw-topbar__search {
	flex: 0 1 420px;
	min-width: 0;
}

.zw-topbar__spacer {
	flex: 1 1 0;
	min-width: 0;
}

.zw-topbar__add {
	flex-shrink: 0;
}

.zw-topbar__activity {
	appearance: none;
	cursor: pointer;
	font: inherit;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	height: 32px;
	background: var(--zw-accent-soft);
	color: #1565c0;
	border: 1px solid rgba(25, 118, 210, 0.32);
	border-radius: 999px;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.2px;
	flex-shrink: 0;
	position: relative;
	transition:
		background 0.12s,
		border-color 0.12s,
		color 0.12s;
}

.zw-topbar__activity:hover {
	background: rgba(227, 242, 253, 0.85);
}

.zw-topbar__activity--icon {
	width: 32px;
	height: 32px;
	padding: 0;
	justify-content: center;
	border-radius: 6px;
}

.zw-topbar__pulse {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--zw-accent);
	flex-shrink: 0;
	animation: zw-pulse 1.2s ease-in-out infinite;
}

.zw-topbar__activity-label {
	display: inline-flex;
	align-items: baseline;
	gap: 4px;
}

.zw-topbar__activity-count {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: #1565c0;
}

.zw-topbar__activity-badge {
	position: absolute;
	top: -4px;
	right: -4px;
	min-width: 16px;
	height: 16px;
	padding: 0 4px;
	border-radius: 8px;
	background: var(--zw-accent);
	color: #fff;
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 700;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: 2px solid var(--zw-card);
}

@keyframes zw-pulse {
	0%,
	100% {
		opacity: 0.55;
		transform: scale(1);
	}
	50% {
		opacity: 1;
		transform: scale(1.18);
	}
}
</style>
