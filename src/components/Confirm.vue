<template>
	<v-dialog
		v-model="show"
		:max-width="options.width"
		:style="{ zIndex: options.zIndex }"
		@keydown.esc="cancel"
		:persistent="options.persistent"
	>
		<v-card>
			<v-toolbar
				class="sticky-title"
				:color="options.color"
				dark
				dense
				flat
			>
				<v-toolbar-title class="white--text">{{
					title
				}}</v-toolbar-title>
			</v-toolbar>
			<v-card-text
				v-show="!!message"
				v-html="message"
				class="px-4 pt-4"
			></v-card-text>
			<v-card-text v-if="options.inputs" class="px-4">
				<v-container grid-list-md>
					<v-form
						v-model="valid"
						ref="form"
						lazy-validation
						@submit.prevent="agree"
					>
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
									:persistent-hint="!!input.hint"
									:required="input.required"
									:disabled="input.disabled"
								></v-checkbox>
								<v-select
									v-if="
										input.type === 'list' &&
										!input.allowManualEntry &&
										!input.autocomplete
									"
									v-model="values[input.key]"
									:item-text="input.itemText || 'text'"
									:item-value="input.itemValue || 'value'"
									:items="input.items"
									:rules="inputProps[input.key].rules"
									:label="input.label"
									@change="
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
									v-model="values[input.key]"
									:item-text="input.itemText || 'text'"
									:item-value="input.itemValue || 'value'"
									:items="input.items"
									:rules="inputProps[input.key].rules"
									:label="input.label"
									@change="
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
										input.type === 'list' &&
										input.allowManualEntry
									"
									v-model="values[input.key]"
									:item-text="input.itemText || 'text'"
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
										@click="
											inputProps[input.key].onChange()
										"
										:color="input.color"
										:outlined="input.outlined"
									>
										<v-icon
											class="mr-2"
											v-if="input.icon"
											>{{ input.icon }}</v-icon
										>{{ input.label }}</v-btn
									>
								</v-container>
							</v-col>
						</v-row>
					</v-form>
				</v-container>
			</v-card-text>
			<v-card-text v-else-if="options.qrScan" class="pa-4">
				<!-- QR-Code  -->
				<qr-reader
					v-if="dialog"
					@result="onDetect"
					:rules="[validQR]"
				></qr-reader>
			</v-card-text>
			<v-card-actions class="sticky-actions pt-0">
				<v-spacer></v-spacer>
				<v-btn
					v-if="!options.qrScan"
					@click="agree"
					text
					:color="options.color"
					>{{ options.confirmText }}</v-btn
				>
				<v-btn
					v-if="options.cancelText && !options.noCancel"
					@keydown.esc="cancel"
					@click="cancel"
					text
					>{{ options.cancelText }}</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { tryParseDSKFromQRCodeString } from '@zwave-js/core/safe'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'
import { wrapFunc, noop } from '../lib/utils'

export default {
	components: {
		PrismEditor: () =>
			import('vue-prism-editor').then((m) => m.PrismEditor),
		QrReader: () => import('./custom/QrReader.vue'),
		ListInput: () => import('./custom/ListInput.vue'),
	},
	data: () => ({
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
			zIndex: 200,
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
						// without this code block is bugged, don't simply assign
						this.$set(
							this.values,
							input.key,
							values[input.key] ?? input.default,
						)
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
			await this.$nextTick()
			this.resolve(qrString)
			this.reset()
		},
		highlighter(code) {
			return highlight(code, languages.js) // returns html
		},
		open(title, message, options) {
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
		agree() {
			if (this.options.inputs) {
				if (this.$refs.form.validate()) {
					this.dialog = false
					this.resolve(this.values)
					this.reset()
				}
			} else {
				this.dialog = false
				this.resolve(true)
				this.reset()
			}
		},
		cancel() {
			this.dialog = false
			this.resolve(this.options.inputs ? {} : false)
			this.reset()
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
.v-card::v-deep .sticky-title {
	position: sticky;
	top: 0;
	z-index: 3;
	background-color: inherit;
	border-bottom: 1px solid var(--v-secondary-base);
}

.v-card::v-deep .sticky-actions {
	position: sticky;
	z-index: 3;
	bottom: 0;
	background-color: inherit;
}
</style>
