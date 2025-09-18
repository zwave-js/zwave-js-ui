<template>
	<v-dialog v-model="_value" max-width="600px" persistent>
		<v-card>
			<v-card-title>
				<span class="text-h5">{{ title }}</span>
			</v-card-title>

			<v-card-text>
				<v-container grid-list-md>
					<v-form v-model="valid" ref="form" validate-on="lazy">
						<v-row>
							<v-col cols="12">
								<v-text-field
									v-model="editedGroup.name"
									label="Group Name"
									required
									:rules="[required]"
									hint="Enter a descriptive name for this multicast group"
								></v-text-field>
							</v-col>
							<v-col cols="12">
								<v-select
									v-model="editedGroup.nodeIds"
									label="Nodes"
									required
									multiple
									item-title="_name"
									item-value="id"
									:items="nodes"
									:rules="[required, minNodes]"
									hint="Select at least 2 nodes for the multicast group"
									chips
									closable-chips
								>
									<template #chip="{ item }">
										<v-chip
											size="small"
											closable
											@click:close="
												removeNode(item.raw.id)
											"
										>
											{{ item.raw._name }}
										</v-chip>
									</template>
									<template
										#item="{ item, props: itemProps }"
									>
										<v-list-item
											v-bind="itemProps"
											:title="item.raw._name"
											:subtitle="`Node ID: ${item.raw.id}${item.raw.loc ? ' - ' + item.raw.loc : ''}`"
										>
											<template #prepend>
												<v-icon
													:color="
														item.raw.ready
															? 'success'
															: 'error'
													"
												>
													{{
														item.raw.ready
															? 'check_circle'
															: 'error'
													}}
												</v-icon>
											</template>
										</v-list-item>
									</template>
								</v-select>
							</v-col>
						</v-row>
					</v-form>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn
					color="blue-darken-1"
					variant="text"
					@click="$emit('close')"
				>
					Cancel
				</v-btn>
				<v-btn
					color="blue-darken-1"
					variant="text"
					@click="handleSave"
					:disabled="!valid"
				>
					Save
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
export default {
	props: {
		modelValue: Boolean,
		title: String,
		editedGroup: Object,
		nodes: Array,
	},
	watch: {
		modelValue(val) {
			if (val && this.$refs.form) {
				this.$refs.form.resetValidation()
			}
		},
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
	},
	data() {
		return {
			valid: true,
			required: (v) => !!v || 'This field is required',
			minNodes: (v) => (v && v.length >= 1) || 'Select at least 1 node',
		}
	},
	methods: {
		removeNode(nodeId) {
			const index = this.editedGroup.nodeIds.indexOf(nodeId)
			if (index > -1) {
				this.editedGroup.nodeIds.splice(index, 1)
			}
		},
		async handleSave() {
			const result = await this.$refs.form.validate()
			if (result.valid) {
				this.$emit('save')
			}
		},
	},
}
</script>
