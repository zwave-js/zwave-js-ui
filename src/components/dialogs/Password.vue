<template>
	<!-- DIALOG PASSWORD -->
	<ZwDialog
		:model-value="_value"
		size="md"
		title="Password Change"
		:actions="dialogActions"
		@update:model-value="_value = $event"
		@after-leave="resetForm"
	>
		<v-container grid-list-md class="pa-0">
			<v-form v-model="valid" ref="form" validate-on="lazy">
				<v-row dense>
					<v-col cols="12">
						<v-text-field
							:rules="[required]"
							v-model="password.current"
							label="Current Password"
							:type="showPsw ? 'text' : 'password'"
							:append-icon="
								showPsw ? 'visibility' : 'visibility_off'
							"
							@click:append="showPsw = !showPsw"
							name="current-password"
							autocomplete
							hint="Insert here the current password"
							required
						></v-text-field>
					</v-col>
					<v-col cols="12">
						<v-text-field
							:rules="[required]"
							v-model="password.new"
							label="New Password"
							:type="showPsw1 ? 'text' : 'password'"
							:append-icon="
								showPsw1 ? 'visibility' : 'visibility_off'
							"
							@click:append="showPsw1 = !showPsw1"
							name="new-password"
							hint="Insert here the new password"
							required
						></v-text-field>
					</v-col>
					<v-col cols="12">
						<v-text-field
							:rules="[required, passwordMatch]"
							v-model="password.confirmNew"
							:type="showPsw2 ? 'text' : 'password'"
							:append-icon="
								showPsw2 ? 'visibility' : 'visibility_off'
							"
							@click:append="showPsw2 = !showPsw2"
							name="new-password-confirm"
							label="Confirm new password"
							hint="Confirm the new password"
							required
						></v-text-field>
					</v-col>
				</v-row>
			</v-form>
		</v-container>
	</ZwDialog>
	<!-- END DIALOG PASSWORD -->
</template>

<script>
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'
import { cancelAction, confirmAction } from '@/lib/dashboard-types'

export default {
	name: 'Password',
	components: { ZwDialog },
	props: {
		modelValue: Boolean,
		password: Object,
	},
	emits: ['update:modelValue', 'updatePassword', 'close'],
	data() {
		return {
			valid: true,
			showPsw: false,
			showPsw1: false,
			showPsw2: false,
			required(v) {
				return !!v || 'This is required'
			},
		}
	},
	computed: {
		passwordMatch() {
			return (
				this.password.new === this.password.confirmNew ||
				"Password doesn't match"
			)
		},
		dialogActions() {
			return [
				cancelAction(this.closeDialog),
				confirmAction('Save', this.updatePassword, {
					disabled: !this.valid,
				}),
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
	watch: {
		modelValue(v) {
			// `after-leave` never fires when a re-open cancels the leave
			if (v) this.resetForm()
		},
	},
	methods: {
		updatePassword: async function () {
			const result = await this.$refs.form.validate()
			if (result.valid) {
				this.$emit('updatePassword')
			}
		},
		resetForm() {
			this.$refs.form?.reset()
		},
		closeDialog: function () {
			this._value = false
		},
	},
}
</script>
