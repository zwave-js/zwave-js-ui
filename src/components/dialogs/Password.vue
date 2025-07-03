<template>
	<!-- DIALOG PASSWORD -->
	<v-dialog
		:model-value="show"
		@update:model-value="$emit('update:show', $event)"
		@click:outside="$emit('close')"
		max-width="500px"
	>
		<v-card>
			<v-card-title>
				<span class="headline">Password Change</span>
			</v-card-title>
			<v-card-text>
				<v-container grid-list-md>
					<v-form v-model="valid" ref="form" lazy-validation>
						<v-row dense>
							<v-col cols="12">
								<v-text-field
									:rules="[required]"
									v-model="password.current"
									label="Current Password"
									:type="showPsw ? 'text' : 'password'"
									:append-icon="
										showPsw
											? 'visibility'
											: 'visibility_off'
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
										showPsw1
											? 'visibility'
											: 'visibility_off'
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
										showPsw2
											? 'visibility'
											: 'visibility_off'
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
			</v-card-text>
			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn color="primary" text @click="closeDialog()">Close</v-btn>
				<v-btn
					color="primary"
					:disabled="!valid"
					text
					@click="updatePassword()"
					>Save</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>

	<!-- END DIALOG PASSWORD -->
</template>

<script>
export default {
	name: 'Password',
	props: {
		show: Boolean,
		password: Object,
	},
	emits: ['close', 'save', 'update:show'],
	watch: {
		show() {
			this.$refs.form && this.$refs.form.reset()
		},
	},
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
	},
	methods: {
		updatePassword: function () {
			if (this.$refs.form.validate()) {
				this.$emit('updatePassword')
			}
		},
		closeDialog: function () {
			this.$emit('close')
		},
	},
}
</script>
