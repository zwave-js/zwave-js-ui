<template>
	<div class="zw-toolbar" :class="{ 'zw-toolbar--compact': compact }">
		<span v-if="!compact" class="zw-toolbar__label">Group</span>
		<ZwSegmented
			:model-value="grouping"
			:options="GROUP_OPTIONS"
			:compact="compact"
			@update:model-value="(v) => emit('grouping', v as Grouping)"
		/>

		<span class="zw-toolbar__sep" />

		<span v-if="!compact" class="zw-toolbar__label">View</span>
		<ZwSegmented
			:model-value="view"
			:options="VIEW_OPTIONS"
			:compact="compact"
			@update:model-value="(v) => emit('view', v as View)"
		/>

		<div class="zw-toolbar__spacer" />

		<ZwColumnsMenu
			v-if="view === 'table'"
			:model-value="visibleCols as ToggleableCol[]"
			:trigger-label-hidden="viewport < 600"
			@update:model-value="(next) => emit('update:visibleCols', next)"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwSegmented from '@/components/dashboard/atoms/ZwSegmented.vue'
import ZwColumnsMenu from '@/components/dashboard/components/ZwColumnsMenu.vue'
import { GridIcon, ListIcon, LocationsIcon, TypeIcon } from '@/lib/icons'

type Grouping = 'location' | 'type' | 'all'
type View = 'cards' | 'table'
type ToggleableCol = 'activity' | 'location' | 'value' | 'power' | 'lastSeen'

const props = defineProps<{
	grouping: Grouping
	view: View
	viewport: number
	visibleCols: readonly string[]
}>()

const emit = defineEmits<{
	grouping: [Grouping]
	view: [View]
	'update:visibleCols': [string[]]
}>()

const compact = computed(() => props.viewport < 600)

const GROUP_OPTIONS = [
	{ value: 'location', label: 'Locations', icon: LocationsIcon },
	{ value: 'type', label: 'Types', icon: TypeIcon },
	{ value: 'all', label: 'All', icon: ListIcon },
]

const VIEW_OPTIONS = [
	{ value: 'cards', label: 'Cards', icon: GridIcon },
	{ value: 'table', label: 'Table', icon: ListIcon },
]
</script>

<style scoped>
.zw-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 20px;
	background: var(--zw-card);
	border-bottom: 1px solid var(--zw-line-soft);
	flex-shrink: 0;
	flex-wrap: wrap;
}

.zw-toolbar--compact {
	padding: 6px 12px;
}

.zw-toolbar__label {
	font-size: 10px;
	font-weight: 600;
	color: var(--zw-fg-soft);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-toolbar__sep {
	width: 1px;
	height: 16px;
	background: var(--zw-line-soft);
}

.zw-toolbar__spacer {
	flex: 1;
}
</style>
