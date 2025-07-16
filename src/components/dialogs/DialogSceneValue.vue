<template>
	<v-dialog v-model="_value" max-width="500px" persistent>
		<v-card>
			<v-card-title>
				<span class="text-h5">Add association</span>
			</v-card-title>

			<v-card-text>
				<v-container grid-list-md>
					<v-form v-model="valid" ref="form" validate-on="lazy">
						<v-row>
							<v-col cols="12">
								<v-select
									v-model="editedValue.node"
									label="Node"
									required
									return-object
									item-title="_name"
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
									item-title="label"
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
										<v-list-item-title>{{
											(item.label || item.id) +
											(item.endpoint > 0
												? ' - Endpoint ' + item.endpoint
												: '')
										}}</v-list-item-title>
										<v-list-item-subtitle
											style="max-width: 500px"
											class="text-truncate text-no-wrap"
											>{{
												item.description
											}}</v-list-item-subtitle
										>
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
				<v-btn
					color="blue-darken-1"
					variant="text"
					@click="$emit('close')"
					>Cancel</v-btn
				>
				<v-btn color="blue-darken-1" variant="text" @click="handleSave"
					>Save</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { defineAsyncComponent } from 'vue'

export default {
	components: {
		ValueID: defineAsyncComponent(() => import('@/components/ValueId.vue')),
	},
	props: {
		modelValue: Boolean,
		title: String,
		editedValue: Object,
		nodes: Array,
	},
	watch: {
		// eslint-disable-next-line no-unused-vars
		modelValue(val) {
			this.$refs.form && this.$refs.form.resetValidation()
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
			positive: (v) => v >= 0 || 'Value must be positive',
			validValue: [
				(v) => !!v || 'This field is required',
				(v) => (v && v.writeable) || 'This value is Read Only',
			],
		}
	},
	methods: {
		async handleSave() {
			const result = await this.$refs.form.validate()
			if (result.valid) {
				this.$emit('save')
			}
		},
	},
}
</script>
