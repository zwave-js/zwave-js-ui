<template>
	<v-dialog
		v-model="show"
		max-width="560px"
		:persistent="saving"
		@keydown.esc="close"
	>
		<v-card>
			<v-card-title>
				<span class="text-h5">
					{{ editMode ? 'Edit user' : 'Add user' }}
				</span>
			</v-card-title>

			<v-card-text>
				<v-container>
					<v-alert
						v-if="error"
						type="error"
						density="compact"
						class="mb-4"
					>
						{{ error }}
					</v-alert>

					<v-form ref="form" v-model="valid" validate-on="lazy">
						<v-row>
							<v-col v-if="namingSupported" cols="12">
								<v-text-field
									v-model="form.userName"
									label="Name"
									:counter="capabilities?.maxUserNameLength"
									:rules="nameRules"
									:disabled="saving"
								/>
							</v-col>

							<v-col cols="12">
								<div
									class="text-caption text-medium-emphasis mb-1"
								>
									Status
								</div>
								<v-radio-group
									v-model="form.active"
									inline
									hide-details
									class="mt-0"
									:disabled="saving"
								>
									<v-radio :value="true" label="Active" />
									<v-radio :value="false" label="Inactive" />
								</v-radio-group>
							</v-col>

							<v-col
								v-if="userTypeOptions.length > 1"
								cols="12"
								sm="6"
							>
								<v-select
									v-model="form.userType"
									:items="userTypeOptions"
									label="User type"
									:hint="userTypeHint"
									persistent-hint
									:disabled="saving"
								>
									<template #item="{ item, props }">
										<v-list-item
											v-bind="props"
											:title="item.raw.title"
											:subtitle="item.raw.subtitle"
										/>
									</template>
								</v-select>
							</v-col>
							<v-col
								v-if="
									form.userType ===
									UserCredentialUserType.Expiring
								"
								cols="12"
								sm="6"
							>
								<v-text-field
									v-model.number="form.expiringTimeoutMinutes"
									label="Expires after"
									suffix="min"
									type="number"
									:min="1"
									:rules="expiringRules"
									:disabled="saving"
								/>
							</v-col>

							<v-col v-if="ruleOptions.length > 1" cols="12">
								<div
									class="text-caption text-medium-emphasis mb-1"
								>
									Credential rule
								</div>
								<v-radio-group
									v-model="form.credentialRule"
									inline
									:hint="ruleHint"
									persistent-hint
									class="mt-0"
									:disabled="saving"
								>
									<v-radio
										v-for="r in ruleOptions"
										:key="r.value"
										:value="r.value"
										:label="r.title"
									/>
								</v-radio-group>
							</v-col>
						</v-row>

						<template v-if="!editMode">
							<v-divider class="my-4" />

							<div class="d-flex align-center mb-3">
								<span class="text-overline"
									>Initial credential</span
								>
								<v-chip
									v-if="requiresCredential"
									size="x-small"
									color="error"
									variant="tonal"
									class="ml-2"
								>
									required
								</v-chip>
								<v-chip
									v-else
									size="x-small"
									color="info"
									variant="tonal"
									class="ml-2"
								>
									optional
								</v-chip>
							</div>

							<v-row>
								<v-col cols="4" sm="3">
									<v-select
										v-model="credential.type"
										:items="directEntryOptions"
										label="Type"
										:disabled="
											saving ||
											directEntryOptions.length < 2
										"
										hide-details
									/>
								</v-col>
								<v-col cols="8" sm="9">
									<v-text-field
										v-model="credential.data"
										label="Value"
										:hint="lengthHint"
										persistent-hint
										class="font-monospace"
										:rules="credentialRules"
										:disabled="saving"
									/>
								</v-col>
							</v-row>
						</template>
					</v-form>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn
					color="blue-darken-1"
					variant="text"
					:disabled="saving"
					@click="close"
				>
					Cancel
				</v-btn>
				<v-btn
					color="blue-darken-1"
					variant="text"
					:disabled="!canSave"
					:loading="saving"
					@click="save"
				>
					{{ editMode ? 'Save' : 'Add' }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import {
	UserCredentialUserType,
	UserCredentialType,
	userTypeLabel,
	userTypeDescription,
	credentialTypeLabel,
	ruleLabels,
	ruleDescription,
	nextFreeUserSlot,
	nextFreeCredentialSlot,
	isDirectEntry,
} from '@/lib/accessControl.ts'

export default {
	props: {
		modelValue: Boolean,
		capabilities: Object,
		initial: Object,
		editMode: Boolean,
		saving: Boolean,
		users: { type: Array, default: () => [] },
		credentials: { type: Array, default: () => [] },
	},
	emits: ['update:modelValue', 'save'],
	data() {
		return {
			UserCredentialUserType,
			form: this.makeForm(),
			credential: { type: UserCredentialType.PINCode, data: '' },
			error: '',
			valid: true,
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
		namingSupported() {
			return (
				!!this.capabilities &&
				this.capabilities.maxUserNameLength != null &&
				this.capabilities.maxUserNameLength > 0
			)
		},
		userTypeOptions() {
			if (!this.capabilities) return []
			return this.capabilities.supportedUserTypes.map((t) => ({
				title: userTypeLabel(t),
				subtitle: userTypeDescription(t),
				value: t,
			}))
		},
		userTypeHint() {
			return userTypeDescription(this.form.userType)
		},
		ruleOptions() {
			if (!this.capabilities) return []
			return this.capabilities.supportedCredentialRules.map((r) => ({
				title: ruleLabels[r],
				value: r,
			}))
		},
		ruleHint() {
			return ruleDescription
		},
		directEntryOptions() {
			if (!this.capabilities) return []
			return this.capabilities.supportedCredentialTypes
				.filter((t) => isDirectEntry(t.type))
				.map((t) => ({
					title: credentialTypeLabel(t.type),
					value: t.type,
				}))
		},
		requiresCredential() {
			return !!this.capabilities?.requiresCredentialAtUserCreation
		},
		credentialCap() {
			return this.capabilities?.supportedCredentialTypes.find(
				(t) => t.type === this.credential.type,
			)
		},
		lengthHint() {
			const cap = this.credentialCap
			if (!cap) return ''
			if (cap.minCredentialLength === cap.maxCredentialLength) {
				return `${cap.minCredentialLength} characters`
			}
			return `${cap.minCredentialLength}–${cap.maxCredentialLength} characters`
		},
		nameRules() {
			const max = this.capabilities?.maxUserNameLength ?? 0
			return [(v) => !v || v.length <= max || `Maximum ${max} characters`]
		},
		expiringRules() {
			return [(v) => (v != null && v > 0) || 'Must be greater than 0']
		},
		credentialRules() {
			const cap = this.credentialCap
			return [
				(v) => {
					if (!v) {
						return this.requiresCredential
							? 'Required for this lock'
							: true
					}
					if (
						cap &&
						(v.length < cap.minCredentialLength ||
							v.length > cap.maxCredentialLength)
					) {
						return this.lengthHint
					}
					return true
				},
			]
		},
		credentialValid() {
			if (this.editMode) return true
			const cap = this.credentialCap
			const value = this.credential.data
			if (!value) return !this.requiresCredential
			if (!cap) return true
			return (
				value.length >= cap.minCredentialLength &&
				value.length <= cap.maxCredentialLength
			)
		},
		canSave() {
			if (!this.capabilities) return false
			if (
				this.form.userType === UserCredentialUserType.Expiring &&
				!(this.form.expiringTimeoutMinutes > 0)
			) {
				return false
			}
			if (!this.credentialValid) return false
			return true
		},
	},
	watch: {
		modelValue(v) {
			if (v) {
				this.form = this.makeForm()
				this.credential = {
					type:
						this.directEntryOptions[0]?.value ??
						UserCredentialType.PINCode,
					data: '',
				}
				this.error = ''
				this.$nextTick(() => this.$refs.form?.resetValidation())
			}
		},
	},
	methods: {
		makeForm() {
			const base = {
				userId: 1,
				active: true,
				userType: UserCredentialUserType.General,
				userName: '',
				credentialRule:
					this.capabilities?.supportedCredentialRules[0] ?? 1,
				expiringTimeoutMinutes: null,
			}
			if (this.initial) {
				return { ...base, ...this.initial }
			}
			if (this.capabilities) {
				base.userId = nextFreeUserSlot(
					this.users,
					this.capabilities.maxUsers,
				)
			}
			return base
		},
		close() {
			if (this.saving) return
			this.show = false
		},
		save() {
			const options = {
				active: this.form.active,
				userType: this.form.userType,
			}
			if (this.namingSupported && this.form.userName)
				options.userName = this.form.userName
			if (this.form.credentialRule)
				options.credentialRule = this.form.credentialRule
			if (this.form.userType === UserCredentialUserType.Expiring)
				options.expiringTimeoutMinutes =
					this.form.expiringTimeoutMinutes

			const payload = { userId: this.form.userId, options }
			let credential
			if (!this.editMode && this.credential.data) {
				const cap = this.credentialCap
				const slot = cap
					? nextFreeCredentialSlot(
							this.credentials,
							this.credential.type,
							cap.numberOfCredentialSlots,
						)
					: 1
				credential = {
					type: this.credential.type,
					slot,
					data: this.credential.data,
				}
			}
			this.$emit('save', { payload, credential })
		},
	},
}
</script>

<style scoped>
.v-radio-group {
	margin-inline-start: -10px;
}

.v-radio-group :deep(.v-input__details) {
	padding-inline-start: 10px;
}
</style>
