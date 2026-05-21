<template>
	<div class="zw-cards" :class="{ 'zw-cards--compact': compact }">
		<section
			v-for="[groupKey, items] in groups"
			:key="groupKey"
			class="zw-cards__group"
		>
			<header class="zw-cards__group-head">
				<h3 class="zw-cards__group-name">
					{{ groupKey === '__controller' ? 'Controller' : groupKey }}
				</h3>
				<span
					v-if="groupKey !== '__controller'"
					class="zw-cards__group-count"
				>
					{{ items.length }}
				</span>
				<span class="zw-cards__group-line" />
			</header>
			<div
				class="zw-cards__grid"
				:style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
			>
				<ZwDeviceCard
					v-for="d in items"
					:key="d.id"
					:device="d"
					@open="(dev) => emit('open', dev)"
					@action="(dev, a) => emit('action', dev, a)"
				/>
			</div>
		</section>
		<ZwEmptyState v-if="groups.length === 0" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwDeviceCard from '@/components/dashboard/components/ZwDeviceCard.vue'
import ZwEmptyState from '@/components/dashboard/components/ZwEmptyState.vue'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{
	groups: [string, Device[]][]
	viewport: number
}>()

const emit = defineEmits<{
	open: [Device]
	action: [Device, DeviceAction]
}>()

const compact = computed(() => props.viewport < 600)

const cols = computed(() => {
	const w = props.viewport
	if (w < 480) return 1
	if (w < 760) return 2
	if (w < 1100) return 3
	if (w < 1380) return 4
	return 5
})
</script>

<style scoped>
/* Plan 55 v1 ships without virtualization (DynamicScroller integration is
   deferred). CSS grid handles up to a few hundred devices comfortably; the
   500+ device acceptance criterion needs the virtualization layer described
   in plan 55 tasks 3-4 to land. */

.zw-cards {
	flex: 1;
	overflow-y: auto;
	padding: 20px 24px 40px;
	background: var(--zw-bg);
}

.zw-cards--compact {
	padding: 14px 12px 32px;
}

.zw-cards__group {
	margin-bottom: 28px;
}

.zw-cards__group-head {
	display: flex;
	align-items: baseline;
	gap: 10px;
	margin-bottom: 12px;
}

.zw-cards__group-name {
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	letter-spacing: -0.1px;
	color: var(--zw-fg);
}

.zw-cards--compact .zw-cards__group-name {
	font-size: 14px;
}

.zw-cards__group-count {
	font-size: 11px;
	color: var(--zw-fg-soft);
	font-family: var(--zw-mono);
}

.zw-cards__group-line {
	flex: 1;
	height: 1px;
	background: var(--zw-line-soft);
}

.zw-cards__grid {
	display: grid;
	gap: 14px;
}

.zw-cards--compact .zw-cards__grid {
	gap: 10px;
}
</style>
