<template>
	<v-dialog
		v-model="show"
		:max-width="options.width"
		:style="{ zIndex: options.zIndex }"
		@keydown.esc="cancel"
		:persistent="options.persistent"
	>
		<v-card>
			<v-toolbar :color="options.color" dark dense flat>
				<v-toolbar-title class="white--text">{{
					title
				}}</v-toolbar-title>
			</v-toolbar>
			<v-card-text
				v-show="!!message"
				v-html="message"
				class="pa-4"
			></v-card-text>
			<v-card-text v-if="options.inputs" class="pa-4">
				<v-container grid-list-md>
					<v-form v-model="valid" ref="form" lazy-validation>
						<v-row>
							<v-col
								v-for="(input, index) in options.inputs"
								:key="index"
								cols="12"
							>
								<v-text-field
									v-if="input.type === 'text'"
									v-model.trim="values[input.key]"
									:label="input.label"
									:hint="input.hint"
									:rules="input.rules || []"
									:required="input.required"
									:min="input.min"
									:persistent-hint="!!input.hint"
									:max="input.max"
								></v-text-field>
								<v-text-field
									v-if="input.type === 'number'"
									v-model.number="values[input.key]"
									:label="input.label"
									:hint="input.hint"
									:rules="input.rules || []"
									type="number"
									:persistent-hint="!!input.hint"
									:required="input.required"
									:min="input.min"
									:max="input.max"
								></v-text-field>
								<v-switch
									v-if="input.type === 'boolean'"
									v-model="values[input.key]"
									:rules="input.rules || []"
									:label="input.label"
									:hint="input.hint"
									:persistent-hint="!!input.hint"
									:required="input.required"
								></v-switch>
								<v-checkbox
									v-if="input.type === 'checkbox'"
									v-model="values[input.key]"
									:rules="input.rules || []"
									:label="input.label"
									:hint="input.hint"
									:persistent-hint="!!input.hint"
									:required="input.required"
								></v-checkbox>
								<v-select
									v-if="
										input.type === 'list' &&
										!input.allowManualEntry
									"
									v-model="values[input.key]"
									:item-text="input.itemText || 'text'"
									:item-value="input.itemValue || 'value'"
									:items="input.items"
									:rules="input.rules || []"
									:label="input.label"
									:persistent-hint="!!input.hint"
									:multiple="!!input.multiple"
									:hint="input.hint"
									:required="input.required"
								></v-select>
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
									:rules="input.rules || []"
									:label="input.label"
									:multiple="!!input.multiple"
									:persistent-hint="!!input.hint"
									:hint="input.hint"
									:return-object="false"
									:required="input.required"
								>
								</v-combobox>
								<v-container v-if="input.type === 'code'">
									<p v-html="input.hint"></p>
									<prism-editor
										class="js-editor"
										:line-numbers="true"
										v-model="values[input.key]"
										language="js"
										:highlight="highlighter"
									></prism-editor>
								</v-container>
							</v-col>
						</v-row>
					</v-form>
				</v-container>
			</v-card-text>
			<v-card-text v-else-if="options.qrScan" class="pa-4">
				<v-tabs v-model="scanTab" grow icons-and-text>
					<v-tab>
						Scan
						<v-icon>photo_camera</v-icon>
					</v-tab>

					<v-tab>
						Import
						<v-icon>image</v-icon>
					</v-tab>
					<v-tab>
						Text
						<v-icon>border_color</v-icon>
					</v-tab>
				</v-tabs>

				<v-tabs-items grow v-model="scanTab">
					<!-- QR-Code  -->
					<v-tab-item>
						<v-card flat>
							<v-card-text>
								<qrcode-stream
									@detect="onDetect"
									@init="onInit"
									:track="paintBoundingBox"
								>
									<center v-if="loadingQr">
										<p class="caption">Loading camera</p>
										<v-progress-circular
											indeterminate
										></v-progress-circular>
									</center>
								</qrcode-stream>
							</v-card-text>
						</v-card>
					</v-tab-item>

					<!-- Image import -->
					<v-tab-item>
						<v-card flat>
							<v-card-text>
								<qrcode-capture
									@detect="onDetect"
									:multiple="false"
									ref="qrcodeCapture"
									v-show="false"
								></qrcode-capture>

								<qrcode-drop-zone
									class="mt-2"
									@detect="onDetect"
								>
									<v-col
										@click="$refs.qrcodeCapture.$el.click()"
										class="dropzone text-center"
									>
										<v-icon size="60px"
											>cloud_upload</v-icon
										>
										<p
											class="
												caption
												font-weight-bold
												text-uppercase
											"
										>
											Drop the image here
										</p>
									</v-col>
								</qrcode-drop-zone>
							</v-card-text>
						</v-card>
					</v-tab-item>

					<!-- Text  -->
					<v-tab-item>
						<v-form
							ref="qrForm"
							v-model="qrForm"
							@submit.prevent="onDetect(qrString)"
						>
							<v-card flat>
								<v-card-text>
									<v-row>
										<v-text-field
											label="QR Code text"
											hint="Manually insert the QR Code string"
											v-model="qrString"
											:rules="[validQR]"
										>
										</v-text-field>
									</v-row>
								</v-card-text>
								<v-card-actions>
									<v-btn
										type="submit"
										color="primary"
										:disabled="!qrForm"
										@click="onDetect(qrString)"
										>Confirm</v-btn
									>
								</v-card-actions>
							</v-card>
						</v-form>
					</v-tab-item>
				</v-tabs-items>
				<v-alert dense v-if="qrCodeError" type="error">{{
					qrCodeError
				}}</v-alert>
			</v-card-text>
			<v-card-actions class="pt-0">
				<v-spacer></v-spacer>
				<v-btn
					v-if="!options.qrScan"
					@click="agree"
					text
					:color="options.color"
					>{{ options.confirmText }}</v-btn
				>
				<v-btn v-if="options.cancelText" @click="cancel" text>{{
					options.cancelText
				}}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<style scoped>
.js-editor {
	font-family: Fira Code, Consolas, 'Andale Mono WT', 'Andale Mono',
		'Lucida Console', 'Lucida Sans Typewriter', 'DejaVu Sans Mono',
		'Bitstream Vera Sans Mono', 'Liberation Mono', 'Nimbus Mono L', Monaco,
		'Courier New', Courier, monospace;
}

.dropzone {
	border: 4px dashed #ccc;
	border-radius: 20px;
	cursor: pointer;
}
</style>
<script>
/**
 * Vuetify Confirm Dialog component
 *
 * Insert component where you want to use it:
 * <confirm ref="confirm"></confirm>
 *
 * Call it:
 * this.$refs.confirm.open('Delete', 'Are you sure?', { color: 'red' }).then((confirm) => {})
 * Or use await:
 * if (await this.$refs.confirm.open('Delete', 'Are you sure?', { color: 'red' })) {
 *   // yes
 * }
 * else {
 *   // cancel
 * }
 *
 * Alternatively you can place it in main App component and access it globally via this.$root.$confirm
 * <template>
 *   <v-app>
 *     ...
 *     <confirm ref="confirm"></confirm>
 *   </v-app>
 * </template>
 *
 * mounted() {
 *   this.$root.$confirm = this.$refs.confirm.open
 * }
 */

// import Prism Editor
import { PrismEditor } from 'vue-prism-editor'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'
import { mapMutations } from 'vuex'

import { QrcodeStream, QrcodeDropZone, QrcodeCapture } from 'vue-qrcode-reader'

export default {
	components: {
		PrismEditor,
		QrcodeStream,
		QrcodeDropZone,
		QrcodeCapture,
	},
	data: () => ({
		scanTab: 0,
		dialog: false,
		resolve: null,
		reject: null,
		valid: true,
		message: null,
		values: {},
		title: null,
		options: null,
		qrForm: true,
		loadingQr: false,
		qrString: '',
		defaultOptions: {
			color: 'primary',
			width: 290,
			zIndex: 200,
			confirmText: 'Yes',
			cancelText: 'Cancel',
			persistent: false,
			qrScan: false,
		},
		qrCodeError: false,
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
	},
	methods: {
		...mapMutations(['showSnackbar']),
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
			return (
				(value &&
					value.startsWith('90') &&
					value.length > 52 &&
					/^\d+$/.test(value)) ||
				'Not valid. Must be 52 digits long and starts with "90"'
			)
		},
		async onDetect(promise) {
			try {
				// const {
				// 	imageData, // raw image data of image/frame
				// 	content, // decoded String or null
				// 	location, // QR code coordinates or null
				// } = await promise

				let content

				if (typeof promise === 'string') {
					// manually inserted string
					if (this.qrForm) {
						// qr form is valid
						content = promise
					} else {
						return
					}
				} else {
					content = (await promise).content
				}

				if (!content) {
					this.qrCodeError = 'No QR code detected'
					return
				} else {
					this.dialog = false
					await this.$nextTick()
					this.resolve(content)
					this.reset()
				}
			} catch (error) {
				this.qrCodeError = error.message
			}
		},
		async onInit(promise) {
			this.loadingQr = true
			try {
				// const { capabilities } = await promise
				await promise
				// successfully initialized
			} catch (error) {
				console.error(error)
				if (error.name === 'NotAllowedError') {
					this.qrCodeError =
						'ERROR: you need to grant camera access permission'
				} else if (error.name === 'NotFoundError') {
					this.qrCodeError = 'ERROR: no camera on this device'
				} else if (error.name === 'NotSupportedError') {
					this.qrCodeError =
						'ERROR: secure context required (HTTPS, localhost)'
				} else if (error.name === 'NotReadableError') {
					this.qrCodeError = 'ERROR: is the camera already in use?'
				} else if (error.name === 'OverconstrainedError') {
					this.qrCodeError =
						'ERROR: installed cameras are not suitable'
				} else if (error.name === 'StreamApiNotSupportedError') {
					this.qrCodeError =
						'ERROR: Stream API is not supported in this browser'
				} else if (error.name === 'InsecureContextError') {
					this.qrCodeError =
						'ERROR: Camera access is only permitted in secure context. Use HTTPS or localhost rather than HTTP.'
				} else {
					this.qrCodeError = `ERROR: Camera error (${error.name})`
				}
			} finally {
				this.loadingQr = false
			}
		},
		highlighter(code) {
			return highlight(code, languages.js) // returns html
		},
		open(title, message, options) {
			this.dialog = true
			this.title = title
			this.message = message

			Object.assign(this.options, options)

			if (options.inputs) {
				for (const input of options.inputs) {
					if (input.default !== undefined) {
						// without this code block is bugged, don't simply assign
						this.$set(this.values, input.key, input.default)
					}
				}
			}

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
			this.qrString = ''
			this.qrForm = true
			this.qrCodeError = false
		},
	},
	created() {
		this.reset()
	},
}
</script>
