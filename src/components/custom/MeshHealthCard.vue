<template>
	<div class="mesh-health">
		<v-chip
			v-if="!open"
			:color="worst ? colors[worst] : 'success'"
			variant="elevated"
			:prepend-icon="worst ? 'warning' : 'check_circle'"
			@click="open = true"
		>
			{{ summary }}
		</v-chip>
		<v-card v-else density="compact" class="mesh-health-card">
			<v-card-title class="d-flex align-center text-subtitle-1 py-1">
				Mesh health
				<v-spacer></v-spacer>
				<v-btn
					icon="close"
					size="x-small"
					variant="text"
					@click="open = false"
				></v-btn>
			</v-card-title>
			<v-card-text class="pa-0">
				<v-list v-if="items.length" density="compact" class="py-0">
					<v-list-item
						v-for="item in items"
						:key="item.id"
						@click="$emit('select', item.id)"
					>
						<template #prepend>
							<v-icon :color="colors[item.level]" size="small">{{
								item.level === 'bad' ? 'error' : 'warning'
							}}</v-icon>
						</template>
						<v-list-item-title class="text-body-2">{{
							item.label
						}}</v-list-item-title>
						<v-list-item-subtitle
							v-for="(r, i) in item.reasons"
							:key="i"
							class="text-caption"
							>{{ r }}</v-list-item-subtitle
						>
					</v-list-item>
				</v-list>
				<div v-else class="px-4 py-2 text-body-2">
					No problems found.
				</div>
				<div
					v-if="weakHops || oneWay"
					class="px-4 pb-2 text-caption text-medium-emphasis"
				>
					<div v-if="weakHops">
						{{ weakHops }} weak hop{{ weakHops === 1 ? '' : 's' }}
						on routes (marked "!")
					</div>
					<div v-if="oneWay">
						{{ oneWay }} one-way neighbor entr{{
							oneWay === 1 ? 'y' : 'ies'
						}}
						(dotted lines)
					</div>
				</div>
				<div class="px-4 pb-2 text-caption text-medium-emphasis">
					Neighbor counts are only judged once neighbor tables are
					known for most of the mesh.
				</div>
			</v-card-text>
		</v-card>
	</div>
</template>

<script>
import { HEALTH_COLORS } from '@/lib/meshView.js'

export default {
	name: 'MeshHealthCard',
	props: {
		/** flagged nodes: [{ id, label, level: 'warn'|'bad', reasons }] */
		items: { type: Array, default: () => [] },
		weakHops: { type: Number, default: 0 },
		oneWay: { type: Number, default: 0 },
	},
	emits: ['select'],
	data() {
		return { open: false, colors: HEALTH_COLORS }
	},
	computed: {
		worst() {
			if (this.items.some((i) => i.level === 'bad')) return 'bad'
			return this.items.length ? 'warn' : null
		},
		summary() {
			const n = this.items.length
			if (!n) return 'Mesh health: no problems'
			return `${n} node${n === 1 ? ' needs' : 's need'} attention`
		},
	},
}
</script>

<style scoped>
.mesh-health {
	position: absolute;
	right: 12px;
	bottom: 12px;
	z-index: 500;
	max-width: 340px;
}

.mesh-health-card {
	max-height: 50vh;
	overflow-y: auto;
}
</style>
