<template>
	<v-row align-center>
		<v-text-field
			prepend-icon="attach_file"
			single-line
			v-model="filename"
			:label="label.toUpperCase()"
			:required="required"
			@click="onFocus"
			:rules="rules"
			:disabled="disabled"
			ref="fileTextField"
		></v-text-field>
		<v-btn
			style="margin: 0"
			icon="clear"
			aria-label="Clear file input"
			@click.stop="clearInput()"
		/>
		<input
			style="position: absolute; left: -99999px"
			type="file"
			:accept="accept"
			:multiple="multiple"
			:disabled="disabled"
			ref="fileInput"
			@change="onFileChange"
		/>
	</v-row>
</template>

<script>
export default {
	props: {
		modelValue: {
			type: [Array, String],
		},
		keyProp: {
			type: String,
		},
		rules: {
			type: [Array],
		},
		accept: {
			type: String,
			default: '*',
		},
		label: {
			type: String,
			default: 'choose_file',
		},
		required: {
			type: Boolean,
			default: false,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		multiple: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:modelValue', 'onFileSelect', 'formData'],
	data() {
		return {
			filename: '',
		}
	},
	watch: {
		modelValue(v) {
			this.filename = v
		},
	},
	mounted() {
		this.filename = this.modelValue
	},
	methods: {
		getFormData(files) {
			const forms = []
			for (const file of files) {
				const form = new FormData()
				form.append('data', file, file.name)
				forms.push(form)
			}
			return forms
		},
		clearInput() {
			this.filename = null
			this.$emit('update:modelValue', this.filename)
			this.$emit('onFileSelect', { files: [], key: this.keyProp })
			this.$emit('formData', null)
		},
		onFocus() {
			if (!this.disabled) {
				this.$refs.fileInput.click()
			}
		},
		onFileChange($event) {
			const files = $event.target.files || $event.dataTransfer.files
			const form = this.getFormData(files)
			if (files) {
				if (files.length > 0) {
					this.filename = [...files]
						.map((file) => file.name)
						.join(', ')
				} else {
					this.filename = null
				}
			} else {
				this.filename = $event.target.value.split('\\').pop()
			}

			this.$emit('update:modelValue', this.filename)
			this.$emit('onFileSelect', { files: files, key: this.keyProp })
			this.$emit('formData', form)
		},
	},
}
</script>
