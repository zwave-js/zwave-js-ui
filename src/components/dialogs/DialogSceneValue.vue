<template>
	<v-dialog v-model="value" max-width="500px" persistent>
		<v-card>
			<v-card-title>
				<span class="headline">Add association</span>
			</v-card-title>

			<v-card-text>
				<v-container grid-list-md>
					<v-form v-model="valid" ref="form" lazy-validation>
						<v-row>
							<v-col cols="12">
								<v-select
									v-model="editedValue.node"
									label="Node"
									required
									return-object
									item-text="_name"
									:rules="[required]"
									item-value="id"
									:items="nodes"
								></v-select>
							</v-col>
							<v-col v-if="editedValue.node" cols="12">
								<v-select
									v-model="editedValue.value"
									label="Value"
									required
									return-object
									item-text="label"
									:rules="validValue"
									item-value="id"
									:items="editedValue.node.values"
								>
									<template v-slot:selection="{ item }">
										{{
											(item.label || item.id) +
											(item.endpoint > 1
												? ' - Endpoint ' + item.endpoint
												: '')
										}}
									</template>
									<template v-slot:item="{ item }">
										<v-list-item-content>
											<v-list-item-title>{{
												(item.label || item.id) +
												(item.endpoint > 0
													? ' - Endpoint ' +
														item.endpoint
													: '')
											}}</v-list-item-title>
											<v-list-item-subtitle
												style="max-width: 500px"
												class="text-truncate text-no-wrap"
												>{{
													item.description
												}}</v-list-item-subtitle
											>
										</v-list-item-content>
									</template>
								</v-select>
							</v-col>
							<v-col v-if="editedValue.value" cols="12">
								<ValueID
									disable_send
									v-model="editedValue.value"
								></ValueID>
							</v-col>
							<v-col cols="12">
								<v-text-field
									v-model.number="editedValue.timeout"
									label="Timeout"
									hint="Seconds to wait before send this value. Set to 0 to send immediately"
									suffix="s"
									:rules="[positive]"
									required
									type="number"
								></v-text-field>
							</v-col>
						</v-row>
					</v-form>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn color="blue darken-1" text @click="$emit('close')"
					>Cancel</v-btn
				>
				<v-btn
					color="blue darken-1"
					text
					@click="$refs.form.validate() && $emit('save')"
					>Save</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
export default {
	components: {
		ValueID: () => import('@/components/ValueId.vue'),
	},
	props: {
		value: Boolean,
		title: String,
		editedValue: Object,
		nodes: Array,
	},
	watch: {
		// eslint-disable-next-line no-unused-vars
		value(val) {
			this.$refs.form && this.$refs.form.resetValidation()
		},
	},
	data() {
		return {
			valid: true,
			required: (v) => !!v || 'This field is required',
			positive: (v) => v >= 0 || 'Value must be positive',
			validValue: [
				(v) => !!v || 'This field is required',
				(v) => (v && v.writeable) || 'This value is Read Only',
			],
		}
	},
}
</script>
