<template>
	<ZwDialog
		:model-value="show"
		:size="dialogSize"
		:severity="severity"
		:title="title"
		:dismiss="dismiss"
		:actions="dialogActions"
		@update:model-value="show = $event"
		@after-leave="reset"
	>
		<div v-if="message" class="confirm-message" v-html="message"></div>

		<v-form
			v-if="options.inputs"
			v-model="valid"
			ref="form"
			:id="id"
			validate-on="lazy"
			@submit.prevent="agree"
		>
			<v-container grid-list-md class="pa-0">
				<v-row>
					<v-col
						v-for="(input, index) in inputs"
						:key="index"
						:cols="input.cols || 12"
					>
						<v-text-field
							v-if="input.type === 'text'"
							v-model.trim="values[input.key]"
							:label="input.label"
							:hint="input.hint"
							:rules="inputProps[input.key].rules"
							:required="input.required"
							:min="input.min"
							:disabled="input.disabled"
							:persistent-hint="!!input.hint"
							:max="input.max"
						></v-text-field>
						<v-text-field
							v-if="input.type === 'number'"
							v-model.number="values[input.key]"
							:label="input.label"
							:hint="input.hint"
							:rules="inputProps[input.key].rules"
							type="number"
							:persistent-hint="!!input.hint"
							:required="input.required"
							:min="input.min"
							:max="input.max"
							:disabled="input.disabled"
						></v-text-field>
						<v-switch
							v-if="input.type === 'boolean'"
							v-model="values[input.key]"
							:rules="inputProps[input.key].rules"
							:label="input.label"
							:hint="input.hint"
							:persistent-hint="!!input.hint"
							:required="input.required"
							:disabled="input.disabled"
						></v-switch>
						<v-checkbox
							v-if="input.type === 'checkbox'"
							v-model="values[input.key]"
							:rules="inputProps[input.key].rules"
							:label="input.label"
							:hint="input.hint"
							:hide-details="!input.hint"
							:persistent-hint="!!input.hint"
							:required="input.required"
							:disabled="input.disabled"
						></v-checkbox>
						<v-select
							:menu-props="menuProps"
							v-if="
								input.type === 'list' &&
								!input.allowManualEntry &&
								!input.autocomplete
							"
							v-model="values[input.key]"
							:item-title="input.itemText || 'title'"
							:item-value="input.itemValue || 'value'"
							:items="input.items"
							:rules="inputProps[input.key].rules"
							:label="input.label"
							@update:model-value="
								inputProps[input.key].onChange($event)
							"
							:persistent-hint="!!input.hint"
							:multiple="!!input.multiple"
							:hint="input.hint"
							:required="input.required"
							:disabled="input.disabled"
						></v-select>
						<v-autocomplete
							v-if="
								input.type === 'list' &&
								!input.allowManualEntry &&
								input.autocomplete
							"
							:menu-props="menuProps"
							v-model="values[input.key]"
							:item-title="input.itemText || 'title'"
							:item-value="input.itemValue || 'value'"
							:items="input.items"
							:rules="inputProps[input.key].rules"
							:label="input.label"
							@update:model-value="
								inputProps[input.key].onChange($event)
							"
							:persistent-hint="!!input.hint"
							:multiple="!!input.multiple"
							:hint="input.hint"
							:required="input.required"
							:disabled="input.disabled"
						></v-autocomplete>
						<v-combobox
							v-if="
								input.type === 'list' && input.allowManualEntry
							"
							:menu-props="menuProps"
							v-model="values[input.key]"
							:item-title="input.itemText || 'title'"
							:item-value="input.itemValue || 'value'"
							chips
							:items="input.items"
							:rules="inputProps[input.key].rules"
							:label="input.label"
							:multiple="!!input.multiple"
							:persistent-hint="!!input.hint"
							:hint="input.hint"
							:return-object="false"
							:required="input.required"
							:disabled="input.disabled"
						>
						</v-combobox>
						<list-input
							v-if="input.type === 'array' && input.list"
							:menu-props="menuProps"
							v-model="values[input.key]"
							:rules="inputProps[input.key].rules"
							:input="input"
						></list-input>
						<v-file-input
							v-if="input.type === 'file'"
							v-model.trim="values[input.key]"
							:label="input.label"
							:hint="input.hint"
							:rules="inputProps[input.key].rules"
							:required="input.required"
							:persistent-hint="!!input.hint"
							:accept="input.accept"
							chips
							show-size
							:multiple="input.multiple"
							truncate-length="15"
						></v-file-input>
						<v-container v-if="input.type === 'code'">
							<p v-html="input.hint"></p>
							<prism-editor
								class="mono"
								:line-numbers="true"
								v-model="values[input.key]"
								language="js"
								:highlight="highlighter"
								:disabled="input.disabled"
							></prism-editor>
						</v-container>
						<v-container v-if="input.type === 'button'">
							<v-btn
								@click="inputProps[input.key].onChange()"
								:color="input.color"
								:variant="
									input.outlined ? 'outlined' : undefined
								"
								:prepend-icon="input.icon"
							>
								{{ input.label }}</v-btn
							>
						</v-container>
					</v-col>
				</v-row>
			</v-container>
		</v-form>

		<!-- QR-Code -->
		<qr-reader
			v-else-if="options.qrScan && dialog"
			@result="onDetect"
			:rules="[validQR]"
		></qr-reader>
	</ZwDialog>
</template>

<script>
import { tryParseDSKFromQRCodeString } from '@zwave-js/core'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'
import { wrapFunc, noop } from '../lib/utils'
import { cancelAction, confirmAction } from '@/lib/dashboard-types'
import { defineAsyncComponent } from 'vue'
import { nextTick } from 'vue'
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'

export default {
	components: {
		ZwDialog,
		PrismEditor: defineAsyncComponent(() =>
			import('vue-prism-editor').then((m) => m.PrismEditor),
		),
		QrReader: defineAsyncComponent(() => import('./custom/QrReader.vue')),
		ListInput: defineAsyncComponent(() => import('./custom/ListInput.vue')),
	},
	data: () => ({
		id: `confirm-form-${Math.random().toString(36).substring(2, 9)}`,
		dialog: false,
		resolve: null,
		reject: null,
		valid: true,
		message: null,
		values: {},
		title: null,
		options: null,
		inputProps: null,
		defaultOptions: {
			color: 'primary',
			width: 290,
			confirmText: 'Yes',
			cancelText: 'Cancel',
			persistent: false,
			qrScan: false,
			noCancel: false,
		},
	}),
	computed: {
		show: {
			get() {
				return this.dialog
			},
			set(value) {
				this.dialog = value
				if (value === false) {
					this.cancel()
				}
			},
		},
		menuProps() {
			return { attach: `#${this.id}` }
		},
		severity() {
			switch (this.options?.color) {
				case 'error':
					return 'danger'
				case 'warning':
					return 'warning'
				case 'success':
					return 'success'
				case 'info':
					return 'info'
				default:
					return 'default'
			}
		},
		// `noCancel` callers have no Cancel action, so the X would be the only
		// way out of a dialog whose whole point is an acknowledgement
		dismiss() {
			if (this.options?.noCancel) return 'none'
			return this.options?.persistent ? 'button' : 'all'
		},
		// `options.width` may be a bare number or a CSS length string, so parse
		// leading digits and bucket the result into a DialogSize breakpoint
		dialogSize() {
			const parsed = parseInt(this.options?.width, 10)
			const w = Number.isNaN(parsed) ? 290 : parsed
			if (w <= 400) return 'sm'
			if (w <= 560) return 'md'
			if (w <= 760) return 'lg'
			return 'xl'
		},
		dialogActions() {
			const o = this.options || {}
			const danger = this.severity === 'danger'
			const acts = []
			if (o.cancelText && !o.noCancel) {
				acts.push(
					cancelAction(this.cancel, {
						label: o.cancelText,
						autoFocus: danger,
					}),
				)
			}
			if (!o.qrScan) {
				acts.push(
					confirmAction(o.confirmText, this.agree, {
						tone: danger ? 'danger' : 'accent',
						autoFocus: !danger,
					}),
				)
			}
			return acts
		},
		inputs() {
			const values = this.options.values || {}
			const inputs = this.options.inputs || []

			for (const input of inputs) {
				const inited = !!this.inputProps[input.key]
				const inputProp = this.inputProps[input.key] ?? {
					show: false,
					onChange: noop,
					rules: [],
				}

				this.inputProps = {
					...this.inputProps,
					[input.key]: inputProp,
				}

				// this must be re-evaluated every time `this.values` changes
				if (typeof input.show === 'function') {
					inputProp.show = input.show(this.values)
				} else {
					inputProp.show = true
				}

				if (!inited) {
					if (input.default !== undefined) {
						this.values[input.key] =
							values[input.key] ?? input.default
					}

					if (input.rules) {
						inputProp.rules = input.rules.map((r) =>
							wrapFunc(r, this.values),
						)
					}

					if (
						input.onChange &&
						typeof input.onChange === 'function'
					) {
						inputProp.onChange = input.onChange.bind(
							this,
							this.values,
						)
					}
				}
			}

			return (
				inputs?.filter(
					(input) => !input.hidden && this.inputProps[input.key].show,
				) ?? []
			)
		},
	},
	methods: {
		noop,
		paintBoundingBox(detectedCodes, ctx) {
			for (const detectedCode of detectedCodes) {
				const {
					boundingBox: { x, y, width, height },
				} = detectedCode

				ctx.lineWidth = 2
				ctx.strokeStyle = '#007bff'
				ctx.strokeRect(x, y, width, height)
			}
		},
		validQR(value) {
			if (this.options.tryParseDsk) {
				const dsk = tryParseDSKFromQRCodeString(value)
				if (dsk) {
					return true
				}
			}

			return (
				(value &&
					value.startsWith('90') &&
					value.length > 52 &&
					/^\d+$/.test(value)) ||
				'Not valid. Must be 52 digits long and starts with "90"'
			)
		},
		async onDetect(qrString) {
			this.dialog = false
			await nextTick()
			this.resolve(qrString)
		},
		highlighter(code) {
			return highlight(code, languages.js) // returns html
		},
		open(title, message, options) {
			this.reset()
			this.dialog = true
			this.title = title
			this.message = message
			this.inputProps = {}

			Object.assign(this.options, options)

			return new Promise((resolve, reject) => {
				this.resolve = resolve
				this.reject = reject
			})
		},
		async agree() {
			if (this.options.inputs) {
				const result = await this.$refs.form.validate()
				if (result.valid) {
					this.dialog = false
					this.resolve(this.values)
				}
			} else {
				this.dialog = false
				this.resolve(true)
			}
		},
		cancel() {
			this.dialog = false
			this.resolve(this.options.inputs ? {} : false)
		},
		reset() {
			this.options = Object.assign({}, this.defaultOptions)
			this.values = {}
			this.inputProps = {}
		},
	},
	created() {
		this.reset()
	},
}
</script>

<style scoped>
/* Vuetify 3 global reset (`* { padding: 0; margin: 0 }`) strips default
   browser spacing from HTML elements rendered via v-html in the message.
   Restore sensible defaults for common block-level elements. */
.confirm-message :deep(ul),
.confirm-message :deep(ol) {
	padding-inline-start: 24px;
}

.confirm-message :deep(h1),
.confirm-message :deep(h2),
.confirm-message :deep(h3),
.confirm-message :deep(h4),
.confirm-message :deep(h5),
.confirm-message :deep(h6),
.confirm-message :deep(p) {
	margin-block: 0.5em;
}
</style>
