<template>
	<div>
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
						<v-select
							:items="videoDevices"
							v-model="selectedCamera"
							label="Camera"
							hide-details
							item-text="label"
							item-value="id"
						></v-select>

						<v-checkbox
							v-model="smallQr"
							label="Small QR-Code"
							persistent-hint
							hint="If the QR-Code is small and cannot be recognized, enable this option"
						></v-checkbox>

						<div>
							<center class="mt-5" v-if="loadingQr">
								<p class="caption">Loading camera</p>
								<v-progress-circular
									indeterminate
								></v-progress-circular>
							</center>
							<center class="mt-5" v-else-if="retryQrLoad">
								<v-btn @click.stop="retryQr" color="primary"
									>Retry</v-btn
								>
							</center>
							<video
								class="mx-auto"
								ref="reader"
								:style="{
									opacity: loadingQr || retryQrLoad ? 0 : 1,
									width: '100%',
									minHeight: '400px',
								}"
							></video>
						</div>
					</v-card-text>
				</v-card>
			</v-tab-item>

			<!-- Image import -->
			<v-tab-item>
				<v-card flat>
					<v-card-text>
						<v-file-input
							small-chips
							truncate-length="15"
							label="Import QR-Code"
							:multiple="false"
							show-size
							accept="image/*"
							counter
							@change="onQrImport"
						></v-file-input>

						<v-col
							@drop.prevent="onDrop($event)"
							@dragover.prevent="dragover = true"
							@dragenter.prevent="dragover = true"
							@dragleave.prevent="dragover = false"
							:class="{ 'grey lighten-2': dragover }"
							class="mt-2 dropzone text-center"
						>
							<v-icon size="60px">cloud_upload</v-icon>
							<p class="caption font-weight-bold text-uppercase">
								Drop the image here
							</p>
						</v-col>
					</v-card-text>
				</v-card>
			</v-tab-item>

			<!-- Text  -->
			<v-tab-item>
				<v-form
					ref="qrForm"
					v-model="qrForm"
					@submit.prevent="onScanSuccess(qrString)"
				>
					<v-card flat>
						<v-card-text>
							<v-row>
								<v-text-field
									label="QR Code text"
									hint="Manually insert the QR Code string"
									v-model.trim="qrString"
									:rules="rules"
								>
								</v-text-field>
							</v-row>
						</v-card-text>
						<v-card-actions>
							<v-btn
								type="submit"
								color="primary"
								:disabled="!qrForm"
								@click="onScanSuccess(qrString)"
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
	</div>
</template>
<script>
// The BarcodeDetector Web API is not yet supported in all browsers,
// and "qr-scanner" defaults to a suboptimal implementation if it is not available.
// The following import makes a better implementation available that is based on a
// WebAssembly port of ZXing:
import { setZXingModuleOverrides } from 'barcode-detector'
import { wait } from '../../lib/utils.js'
import logger from '../../lib/logger'

const log = logger.get('QrReader')

import QrScanner from 'qr-scanner'

setZXingModuleOverrides({
	locateFile: (path, prefix) => {
		if (path.endsWith('.wasm')) {
			// This file has been copied from node_modules/zxing-wasm/dist/reader/ to public/
			// Don't forget to update the file when updating the node_module
			return 'zxing_reader.wasm'
		}
		return prefix + path
	},
})

export default {
	props: {
		qrbox: {
			type: Number,
			default: 200,
		},
		fps: {
			type: Number,
			default: 10,
		},
		rules: {
			type: Array,
			default: () => [],
		},
	},
	data() {
		return {
			scanTab: null,
			qrReader: null,
			qrCodeError: null,
			qrString: null,
			qrForm: false,
			loadingQr: false,
			retryQrLoad: false,
			selectedCamera: null,
			videoDevices: [],
			smallQr: false,
			dragover: false,
		}
	},
	mounted() {
		this.initialize()
	},
	beforeDestroy() {
		this.destroyReader()
	},
	watch: {
		qrCodeError(val) {
			if (val) {
				setTimeout(() => {
					this.qrCodeError = false
				}, 5000)
			}
		},
		selectedCamera(val) {
			if (this.qrReader) {
				this.qrReader.setCamera(val)
			}
		},
		smallQr() {
			if (this.qrReader) {
				this.retryQr()
			}
		},
	},
	methods: {
		async retryQr() {
			await this.destroyReader()
			this.retryQrLoad = false
			this.qrCodeError = false
			this.loadingQr = true
			// without this video element is not reloaded
			await wait(500)
			await this.initialize()
		},
		async destroyReader() {
			if (this.qrReader) {
				await this.qrReader.destroy()
				this.qrReader = null
			}
		},
		async initialize() {
			this.loadingQr = true

			try {
				await this.getDevices()

				if (this.videoDevices.length === 0) {
					throw new Error('No available camera found')
				}

				this.selectedCamera =
					this.selectedCamera || this.videoDevices[0].id

				this.qrReader = new QrScanner(
					this.$refs.reader,
					this.onScanSuccess.bind(this),
					{
						// onDecodeError: (error) => {
						// 	log.error(error)
						// 	//this.qrCodeError = error
						// },
						highlightScanRegion: true,
						highlightCodeOutline: true,
						preferredCamera: this.selectedCamera,
						// https://github.com/nimiq/qr-scanner/issues/9#issuecomment-1252008780
						calculateScanRegion: this.smallQr
							? (v) => {
									return this.smallQrCodeRegion(v)
								}
							: null,
					},
				)

				await this.qrReader.start()
			} catch (error) {
				log.error(error)

				this.retryQrLoad = true
				this.qrCodeError =
					'Cannot initialize QR-Code scanner: ' + error.message
			}

			this.loadingQr = false
		},
		smallQrCodeRegion(v) {
			const smallestDimension = Math.min(v.videoWidth, v.videoHeight)

			// Make scan region smaller to match better small qr codes
			const scanRegionSize = Math.round((1 / 5) * smallestDimension)

			let region = {
				x: Math.round((v.videoWidth - scanRegionSize) / 2),
				y: Math.round((v.videoHeight - scanRegionSize) / 2),
				width: scanRegionSize,
				height: scanRegionSize,
			}
			return region
		},
		async getDevices() {
			try {
				const devices = await QrScanner.listCameras(true)
				this.videoDevices = devices
			} catch (error) {
				log.error(error)
				this.qrCodeError = 'Cannot fetch available video devices'
			}
		},
		onScanSuccess(result) {
			log.log(
				'QR-Code scanned: ',
				typeof result === 'string' ? result : result.data,
			)
			this.$emit(
				'result',
				typeof result === 'string' ? result : result.data,
			)
		},
		onDrop(e) {
			this.dragover = false
			this.onQrImport(e.dataTransfer.files[0])
		},
		async onQrImport(qrImage) {
			if (qrImage) {
				try {
					// https://github.com/nimiq/qr-scanner#single-image-scanning
					const result = await QrScanner.scanImage(qrImage, {
						alsoTryWithoutScanRegion: true,
					})
					this.onScanSuccess(result)
				} catch (error) {
					log.error(error)
					this.qrCodeError = 'Cannot read QR-Code'
				}
			}
		},
	},
}
</script>

<style scoped>
.dropzone {
	border: 4px dashed #ccc;
	border-radius: 20px;
	cursor: pointer;
}
</style>
