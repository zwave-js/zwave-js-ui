<template>
	<v-dialog v-model="_value" max-width="900px" :persistent="running">
		<v-card v-if="preview">
			<v-card-title class="text-h5">Import floorplans</v-card-title>
			<v-card-subtitle>
				{{ mapsSummary }}
				<span v-if="preview.exportedAt">
					· exported {{ exportedAt }}</span
				>
			</v-card-subtitle>
			<v-card-text>
				<p class="mb-2">
					Pick the node each device in the file belongs to here.
					Devices you don't match keep their spot as a placeholder,
					which you can link to a node later. Existing maps are never
					changed, the maps are added.
				</p>
				<v-table density="compact">
					<thead>
						<tr>
							<th>In the file</th>
							<th>Match</th>
							<th style="width: 350px">Node here</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="e in preview.entries" :key="e.ref">
							<td>
								<div>
									{{ e.name || 'Unnamed device' }}
									<span
										v-if="e.controller"
										class="text-caption"
										>(controller)</span
									>
								</div>
								<div class="text-caption text-medium-emphasis">
									{{ describe(e) }}
								</div>
							</td>
							<td>
								<v-chip
									size="small"
									:color="confidenceColor(e)"
									v-tooltip="confidenceHint(e)"
									>{{ confidenceLabel(e) }}</v-chip
								>
							</td>
							<td>
								<v-autocomplete
									v-model="matches[e.ref]"
									:items="choices"
									:item-props="itemProps(e.ref)"
									density="compact"
									variant="outlined"
									hide-details
								></v-autocomplete>
							</td>
						</tr>
					</tbody>
				</v-table>
				<v-alert
					v-if="duplicate"
					type="error"
					density="compact"
					class="mt-3"
					>{{ duplicate }} is chosen for more than one device</v-alert
				>
			</v-card-text>
			<v-card-actions>
				<span class="text-caption ml-2">
					{{ linkedCount }} linked ·
					{{ preview.entries.length - linkedCount }} placeholders
				</span>
				<v-spacer></v-spacer>
				<v-btn :disabled="running" @click="_value = false"
					>Cancel</v-btn
				>
				<v-btn
					color="primary"
					variant="flat"
					:loading="running"
					:disabled="!!duplicate"
					@click="commit"
					>Import</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis.js'
import InstancesMixin from '@/mixins/InstancesMixin.js'

const CONFIDENCE = {
	certain: ['Certain', 'success'],
	likely: ['Likely', 'primary'],
	possible: ['Possible', 'warning'],
}

export default {
	name: 'DialogFloorPlanImport',
	mixins: [InstancesMixin],
	props: {
		modelValue: { type: Boolean, default: false },
		/** the import preview: token, maps, entries (with proposals), nodes */
		preview: { type: Object, default: null },
	},
	emits: ['update:modelValue', 'imported'],
	data() {
		return { matches: {}, running: false }
	},
	computed: {
		_value: {
			get() {
				return this.modelValue
			},
			set(val) {
				this.$emit('update:modelValue', val)
			},
		},
		choices() {
			return [
				{ title: 'Keep as placeholder', value: null },
				...this.preview.nodes.map((n) => ({
					title: `${n.name || `NodeID ${n.id}`} (node ${n.id})${n.loc ? ` · ${n.loc}` : ''}`,
					value: n.key,
				})),
			]
		},
		mapsSummary() {
			return this.preview.maps
				.map(
					(m) =>
						`${m.name} (${m.placements} node${m.placements === 1 ? '' : 's'}${m.hasImage ? ', picture' : ''}${m.hasDarkImage ? ' + dark' : ''})`,
				)
				.join(', ')
		},
		exportedAt() {
			const d = new Date(this.preview.exportedAt)
			return isNaN(d) ? this.preview.exportedAt : d.toLocaleString()
		},
		linkedCount() {
			return Object.values(this.matches).filter(Boolean).length
		},
		/** name of a node chosen twice, if any */
		duplicate() {
			const seen = new Set()
			for (const key of Object.values(this.matches)) {
				if (!key) continue
				if (seen.has(key)) {
					return this.choices.find((c) => c.value === key)?.title
				}
				seen.add(key)
			}
			return null
		},
	},
	watch: {
		preview: {
			immediate: true,
			handler(p) {
				this.matches = Object.fromEntries(
					(p?.entries ?? []).map((e) => [e.ref, e.key ?? null]),
				)
			},
		},
	},
	methods: {
		describe(e) {
			return [
				e.loc,
				e.productLabel || e.deviceId,
				e.nodeId != null ? `node ${e.nodeId}` : '',
			]
				.filter(Boolean)
				.join(' · ')
		},
		/** the proposal's confidence while the user keeps it */
		proposed(e) {
			return e.key && this.matches[e.ref] === e.key ? e.confidence : null
		},
		confidenceLabel(e) {
			const c = this.proposed(e)
			if (c) return CONFIDENCE[c][0]
			if (this.matches[e.ref]) return 'Your pick'
			return e.tied ? `${e.tied} candidates` : 'No match'
		},
		confidenceColor(e) {
			const c = this.proposed(e)
			if (c) return CONFIDENCE[c][1]
			return this.matches[e.ref] ? 'primary' : undefined
		},
		confidenceHint(e) {
			const c = this.proposed(e)
			if (c === 'certain') {
				return 'Same network and node, or both are the controller'
			}
			if (c === 'likely') return 'Same name and device model'
			if (c === 'possible') {
				return 'Same model and location, or the same name'
			}
			if (e.tied && !this.matches[e.ref]) {
				return `${e.tied} nodes match equally well, pick one`
			}
			return ''
		},
		/** grey out nodes another device already has */
		itemProps(ref) {
			return (item) => {
				const takenBy = Object.entries(this.matches).find(
					([r, key]) => r !== ref && key && key === item.value,
				)
				return {
					title: item.title,
					subtitle: takenBy ? 'chosen for another device' : undefined,
				}
			}
		},
		async commit() {
			this.running = true
			try {
				const res = await ConfigApis.commitFloorPlanImport(
					this.preview.token,
					this.matches,
				)
				if (!res.success) throw Error(res.message)
				this.$emit('imported', res.data)
				this._value = false
			} catch (error) {
				this.showSnackbar(`Import failed: ${error.message}`, 'error')
			} finally {
				this.running = false
			}
		},
	},
}
</script>
