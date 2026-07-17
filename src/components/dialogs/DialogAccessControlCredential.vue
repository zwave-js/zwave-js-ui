<template>
	<v-dialog
		v-model="show"
		max-width="520"
		:persistent="saving"
		@keydown.esc="close"
	>
		<v-card>
			<v-card-title class="d-flex align-center">
				<span class="text-h6">
					{{ editMode ? 'Replace credential' : 'Add credential' }}
				</span>
				<v-spacer />
				<v-btn
					icon="close"
					variant="text"
					:disabled="saving"
					@click="close"
				/>
			</v-card-title>
			<v-card-text>
				<v-row dense>
					<v-col cols="12">
						<v-select
							v-model="form.userId"
							:items="userItems"
							label="Owner"
							:disabled="saving || lockOwner || editMode"
							hide-details
						/>
					</v-col>
					<v-col cols="12" sm="6">
						<v-select
							v-model="form.type"
							:items="typeOptions"
							label="Type"
							hide-details
							:disabled="
								saving || editMode || typeOptions.length < 2
							"
						/>
					</v-col>
					<v-col cols="12" sm="6">
						<v-text-field
							v-model.number="form.slot"
							label="Slot"
							type="number"
							:min="1"
							:max="
								selectedTypeCap
									? selectedTypeCap.numberOfCredentialSlots
									: 1
							"
							:disabled="saving || editMode"
							hide-details
						/>
					</v-col>
					<v-col cols="12">
						<v-text-field
							v-model="form.data"
							:label="
								selectedTypeCap
									? `${typeLabel(form.type)} value`
									: 'Value'
							"
							:hint="lengthHint"
							persistent-hint
							class="font-monospace"
							:type="reveal ? 'text' : 'password'"
							:inputmode="isPinType ? 'numeric' : undefined"
							:pattern="isPinType ? '\\d*' : undefined"
							:maxlength="
								selectedTypeCap
									? selectedTypeCap.maxCredentialLength
									: undefined
							"
							:disabled="saving"
							@beforeinput="onCredentialBeforeInput"
						>
							<template #append-inner>
								<v-btn
									size="x-small"
									variant="text"
									:disabled="saving"
									@click="reveal = !reveal"
								>
									{{ reveal ? 'Hide' : 'Show' }}
								</v-btn>
							</template>
						</v-text-field>
					</v-col>
				</v-row>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" :disabled="saving" @click="close">
					Cancel
				</v-btn>
				<v-btn
					color="primary"
					:disabled="!canSave"
					:loading="saving"
					@click="save"
				>
					{{ editMode ? 'Replace' : 'Add' }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import {
	UserCredentialType,
	credentialTypeLabel,
	isDirectEntry,
	nextFreeCredentialSlot,
} from '@/lib/accessControl.ts'

export default {
	props: {
		modelValue: Boolean,
		capabilities: Object,
		initial: Object,
		editMode: Boolean,
		lockOwner: Boolean,
		saving: Boolean,
		users: { type: Array, default: () => [] },
		credentials: { type: Array, default: () => [] },
	},
	emits: ['update:modelValue', 'save'],
	data() {
		return {
			form: {
				userId: this.initial?.userId ?? 0,
				type: this.initial?.type ?? UserCredentialType.PINCode,
				slot: this.initial?.slot ?? 1,
				data: this.initial?.data ?? '',
			},
			reveal: false,
		}
	},
	computed: {
		show: {
			get() {
				return this.modelValue
			},
			set(v) {
				this.$emit('update:modelValue', v)
			},
		},
		userItems() {
			return this.users.map((u) => ({
				title: u.userName || `User ${u.userId}`,
				value: u.userId,
			}))
		},
		typeOptions() {
			if (!this.capabilities) return []
			return this.capabilities.supportedCredentialTypes
				.filter(
					(t) =>
						isDirectEntry(t.type) &&
						(this.editMode ||
							nextFreeCredentialSlot(
								this.credentials,
								t.type,
								t.numberOfCredentialSlots,
							) !== undefined),
				)
				.map((t) => ({
					title: credentialTypeLabel(t.type),
					value: t.type,
				}))
		},
		selectedTypeCap() {
			return this.capabilities?.supportedCredentialTypes.find(
				(t) => t.type === this.form.type,
			)
		},
		lengthHint() {
			const cap = this.selectedTypeCap
			if (!cap) return ''
			return `${cap.minCredentialLength}–${cap.maxCredentialLength} chars`
		},
		isPinType() {
			return this.form.type === UserCredentialType.PINCode
		},
		canSave() {
			if (!this.form.data || !this.form.userId || this.form.slot < 1) {
				return false
			}
			const cap = this.selectedTypeCap
			if (!cap) return false
			if (
				this.form.data.length < cap.minCredentialLength ||
				this.form.data.length > cap.maxCredentialLength
			) {
				return false
			}
			if (
				this.form.type === UserCredentialType.PINCode &&
				!/^\d+$/.test(this.form.data)
			) {
				return false
			}
			return true
		},
	},
	watch: {
		modelValue(v) {
			if (v) {
				const defaultType =
					this.initial?.type ??
					this.typeOptions[0]?.value ??
					UserCredentialType.PINCode
				const cap = this.capabilities?.supportedCredentialTypes.find(
					(t) => t.type === defaultType,
				)
				this.form = {
					userId: this.initial?.userId ?? this.users[0]?.userId ?? 0,
					type: defaultType,
					slot:
						this.initial?.slot ??
						nextFreeCredentialSlot(
							this.credentials,
							defaultType,
							cap?.numberOfCredentialSlots ?? 1,
						) ??
						0,
					data: this.initial?.data ?? '',
				}
				this.reveal = false
			}
		},
		'form.type'(newType) {
			if (this.editMode) return
			const cap = this.capabilities?.supportedCredentialTypes.find(
				(t) => t.type === newType,
			)
			this.form.slot =
				nextFreeCredentialSlot(
					this.credentials,
					newType,
					cap?.numberOfCredentialSlots ?? 1,
				) ?? 0
		},
	},
	methods: {
		typeLabel: credentialTypeLabel,
		onCredentialBeforeInput(e) {
			if (!this.isPinType) return
			if (e.data != null && !/^\d+$/.test(e.data)) {
				e.preventDefault()
			}
		},
		close() {
			if (this.saving) return
			this.show = false
		},
		save() {
			this.$emit('save', {
				payload: {
					userId: this.form.userId,
					type: this.form.type,
					slot: this.form.slot,
					data: this.form.data,
				},
			})
		},
	},
}
</script>
