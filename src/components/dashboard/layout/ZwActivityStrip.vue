<template>
	<div v-if="activities.length > 0" class="zw-strip">
		<div
			class="zw-strip__scroll zw-strip__scroll--masked"
			:style="{ paddingLeft: padX + 'px' }"
		>
			<span class="zw-strip__label">Activity</span>
			<span
				v-for="d in visibleActivities"
				:key="d.nodeId"
				class="zw-strip__chip"
			>
				<span class="zw-strip__pulse" />
				{{ d.activity[0].label }} · {{ d.name || d.product }}
			</span>
			<span
				v-if="activities.length > visibleActivities.length"
				class="zw-strip__more"
			>
				+{{ activities.length - visibleActivities.length }} more
			</span>
		</div>
		<div class="zw-strip__hide" :style="{ paddingInline: padX - 6 + 'px' }">
			<Button.Root
				class="zw-strip__hide-btn"
				title="Hide activity"
				aria-label="Hide activity"
				@click="emit('hide')"
			>
				<XIcon :size="ICON_SIZE.inline" />
			</Button.Root>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@vuetify/v0'
import { ICON_SIZE, XIcon } from '@/lib/icons'
import type { Device } from '@/lib/dashboard-types'

const props = defineProps<{
	activities: Device[]
	viewport: number
}>()

const emit = defineEmits<{ hide: [] }>()

const padX = computed(() => (props.viewport < 600 ? 12 : 20))

// Cap the inline chips; the rest collapse into a "+N more" tail.
const MAX_CHIPS = 6
const visibleActivities = computed(() => props.activities.slice(0, MAX_CHIPS))
</script>

<style>
.zw-strip {
	display: flex;
	align-items: stretch;
	background: var(--zw-accent-soft);
	border-bottom: 1px solid rgba(25, 118, 210, 0.18);
	flex-shrink: 0;
}

.zw-strip__scroll {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 0 8px 20px;
	overflow-x: auto;
}

.zw-strip__scroll--masked {
	-webkit-mask-image: linear-gradient(
		to right,
		#000 0,
		#000 calc(100% - 24px),
		transparent 100%
	);
	mask-image: linear-gradient(
		to right,
		#000 0,
		#000 calc(100% - 24px),
		transparent 100%
	);
}

.zw-strip__label {
	font-size: 10px;
	font-weight: 700;
	color: var(--zw-accent);
	text-transform: uppercase;
	letter-spacing: 0.8px;
	flex-shrink: 0;
}

.zw-strip__chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 3px 10px;
	background: var(--zw-card);
	color: var(--zw-accent);
	border-radius: 999px;
	font-size: 11px;
	font-weight: 500;
	border: 1px solid rgba(25, 118, 210, 0.22);
	flex-shrink: 0;
}

.zw-strip__pulse {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--zw-accent);
	animation: zw-pulse 1.2s ease-in-out infinite;
	flex-shrink: 0;
}

.zw-strip__more {
	font-size: 11px;
	color: var(--zw-accent);
	font-family: var(--zw-mono);
	flex-shrink: 0;
}

.zw-strip__hide {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--zw-accent-soft);
}

.zw-strip__hide-btn {
	appearance: none;
	cursor: pointer;
	font: inherit;
	width: 24px;
	height: 24px;
	padding: 0;
	border-radius: 4px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: none;
	background: transparent;
	color: var(--zw-accent);
}

.zw-strip__hide-btn:hover {
	background: rgba(25, 118, 210, 0.15);
}
</style>
