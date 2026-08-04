<template>
	<ZwDialog
		:model-value="_value"
		size="md"
		:title="title || 'Scene value'"
		:actions="dialogActions"
		@update:model-value="_value = $event"
	>
		<v-container grid-list-md class="pa-0">
			<v-form v-model="valid" ref="form" validate-on="lazy">
				<v-row>
					<v-col cols="12">
						<v-select
							:menu-props="zwMenuProps"
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
							:menu-props="zwMenuProps"
							v-model="editedValue.value"
							label="Value"
							required
							return-object
							item-title="label"
							:rules="validValue"
							item-value="id"
							:items="editedValue.node.values"
						>
							<template #selection="{ item }">
								{{
									(item.raw.label || item.raw.id) +
									(item.raw.endpoint > 1
										? ' - Endpoint ' + item.raw.endpoint
										: '')
								}}
							</template>
							<template #item="{ item, props: itemProps }">
								<v-list-item
									v-bind="itemProps"
									:title="
										(item.raw.label || item.raw.id) +
										(item.raw.endpoint > 0
											? ' - Endpoint ' + item.raw.endpoint
											: '')
									"
									:subtitle="
										item.raw.description ||
										'No description available'
									"
								>
								</v-list-item>
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
	</ZwDialog>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'
import { cancelAction, confirmAction } from '@/lib/dashboard-types'
import OverlayAttachMixin from '@/mixins/OverlayAttachMixin.js'

export default {
	mixins: [OverlayAttachMixin],
	components: {
		ZwDialog,
		ValueID: defineAsyncComponent(() => import('@/components/ValueId.vue')),
	},
	props: {
		modelValue: Boolean,
		title: String,
		editedValue: Object,
		nodes: Array,
	},
	emits: ['update:modelValue', 'close', 'save'],
	watch: {
		modelValue() {
			this.$refs.form && this.$refs.form.resetValidation()
		},
	},
	computed: {
		dialogActions() {
			return [
				cancelAction(() => (this._value = false)),
				confirmAction('Save', this.handleSave),
			]
		},
		_value: {
			get() {
				return this.modelValue
			},
			// Lowering the model is the only dismissal path, so `close` rides it
			set(val) {
				this.$emit('update:modelValue', val)
				if (!val) this.$emit('close')
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
