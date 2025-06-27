<template>
	<v-container class="full-height pa-0" fluid>
		<v-row no-gutters>
			<v-col
				class="sticky-top fill-remaining-space overflow-y-auto"
				cols="6"
				md="5"
				lg="4"
				xl="3"
			>
				<v-treeview
					v-if="!loadingStore"
					:active.sync="active"
					v-model="selectedFiles"
					:items="items"
					activatable
					selectable
					item-key="path"
					:open.sync="openFolders"
					return-object
					style="max-height: calc(100vh - 64px); overflow-y: auto"
				>
					<template v-slot:prepend="{ item, open }">
						<v-icon color="warning" v-if="item.children">
							{{ open ? 'folder_open' : 'folder' }}
						</v-icon>
						<v-icon color="primary" v-else> text_snippet </v-icon>
					</template>
					<template v-slot:label="{ item }">
						<span class="subtitle-2">{{ item.name }}</span>
						<div class="caption grey--text">
							{{ item.size !== 'n/a' ? item.size : '' }}
						</div>
					</template>
					<template v-slot:append="{ item }">
						<v-row justify-end class="ma-1">
							<v-menu v-if="item.children" offset-y>
								<template v-slot:activator="{ on }">
									<v-icon v-on="on">more_vert</v-icon>
								</template>
								<v-list class="py-0" dense>
									<v-list-item
										dense
										@click.stop="writeFile(item.path, true)"
									>
										<v-list-item-icon>
											<v-icon color="warning"
												>create_new_folder</v-icon
											>
										</v-list-item-icon>
										<v-list-item-title
											>Create New
											Folder</v-list-item-title
										>
									</v-list-item>
									<v-list-item
										dense
										@click.stop="
											writeFile(item.path, false)
										"
									>
										<v-list-item-icon>
											<v-icon color="primary"
												>post_add</v-icon
											>
										</v-list-item-icon>
										<v-list-item-title
											>Add File</v-list-item-title
										>
									</v-list-item>
									<v-list-item
										dense
										v-if="!item.isRoot"
										@click.stop="deleteFile(item)"
									>
										<v-list-item-icon>
											<v-icon color="error"
												>delete</v-icon
											>
										</v-list-item-icon>
										<v-list-item-title
											>Delete</v-list-item-title
										>
									</v-list-item>
									<v-list-item
										dense
										@click.stop="uploadFile(item)"
									>
										<v-list-item-icon>
											<v-icon color="warning"
												>upload</v-icon
											>
										</v-list-item-icon>
										<v-list-item-title
											>Upload File</v-list-item-title
										>
									</v-list-item>
								</v-list>
							</v-menu>
							<!-- only show delete -->
							<v-icon
								v-else
								color="error"
								@click.stop="deleteFile(item)"
								>delete</v-icon
							>
						</v-row>
					</template>
				</v-treeview>
				<div v-else>
					<v-progress-circular
						indeterminate
						color="primary"
						style="align-self: center"
					></v-progress-circular>
				</div>
				<v-speed-dial bottom fab right absolute v-model="fab">
					<template v-slot:activator>
						<v-btn color="primary" dark fab hover v-model="fab">
							<v-icon v-if="fab">close</v-icon>
							<v-icon v-else>settings</v-icon>
						</v-btn>
					</template>
					<v-tooltip left>
						<template v-slot:activator="{ on, attrs }">
							<v-btn
								fab
								dark
								small
								color="success"
								@click="restoreZip()"
								v-bind="attrs"
								v-on="on"
							>
								<v-icon>restore</v-icon>
							</v-btn>
						</template>
						<span>Restore</span>
					</v-tooltip>

					<v-tooltip left>
						<template v-slot:activator="{ on, attrs }">
							<v-btn
								fab
								dark
								small
								color="warining"
								@click="uploadFile()"
								v-bind="attrs"
								v-on="on"
							>
								<v-icon>upload</v-icon>
							</v-btn>
						</template>
						<span>Upload File</span>
					</v-tooltip>

					<v-tooltip left>
						<template v-slot:activator="{ on, attrs }">
							<v-btn
								fab
								dark
								small
								color="purple"
								@click="backupStore"
								v-bind="attrs"
								v-on="on"
							>
								<v-icon>backup</v-icon>
							</v-btn>
						</template>
						<span>Backup</span>
					</v-tooltip>

					<v-tooltip left>
						<template v-slot:activator="{ on, attrs }">
							<v-btn
								fab
								dark
								small
								color="warning"
								@click="refreshTree"
								v-bind="attrs"
								v-on="on"
							>
								<v-icon>refresh</v-icon>
							</v-btn>
						</template>
						<span>Refresh</span>
					</v-tooltip>

					<v-tooltip left>
						<template v-slot:activator="{ on, attrs }">
							<v-btn
								v-if="selectedFiles.length > 0"
								fab
								dark
								small
								color="primary"
								@click="downloadSelectedZip"
								v-bind="attrs"
								v-on="on"
							>
								<v-icon>file_download</v-icon>
							</v-btn>
						</template>
						<span>Download selected</span>
					</v-tooltip>

					<v-tooltip left>
						<template v-slot:activator="{ on, attrs }">
							<v-btn
								v-if="selectedFiles.length > 0"
								fab
								dark
								small
								color="error"
								@click="deleteSelected"
								v-bind="attrs"
								v-on="on"
							>
								<v-icon>delete</v-icon>
							</v-btn>
						</template>
						<span>Delete selected</span>
					</v-tooltip>
				</v-speed-dial>
			</v-col>

			<v-divider class="mx-0" vertical></v-divider>

			<v-col class="text-center overflow-y-auto d-flex justify-center">
				<div
					v-if="!selected || !selected.ext"
					class="title grey--text text--lighten-1 font-weight-light align-self-center"
				>
					<v-icon color="grey lighten-4" x-large>
						text_snippet
					</v-icon>
					<br />
					Please select a file
				</div>
				<div
					v-else-if="loadingFile"
					class="title grey--text text--lighten-1 font-weight-light align-self-center"
				>
					<v-progress-circular
						indeterminate
						color="primary"
					></v-progress-circular>
				</div>
				<div
					class="fill-remaining-space flex-grow-1"
					v-else
					:key="selected.path"
				>
					<div class="file-content pa-4 pb-8">
						<prism-editor
							@keydown.ctrl.s.prevent="writeFile"
							v-if="!notSupported"
							class="custom-font"
							lineNumbers
							v-model="fileContent"
							:highlight="highlighter"
						></prism-editor>
					</div>
					<div class="sticky-bottom pa-0" v-if="!notSupported">
						<v-toolbar>
							<v-spacer></v-spacer>
							<v-btn color="purple" text @click="writeFile">
								SAVE
								<v-icon right dark>save</v-icon>
							</v-btn>
							<v-btn color="success" text @click="downloadFile">
								DOWNLOAD
								<v-icon right dark>file_download</v-icon>
							</v-btn>
						</v-toolbar>
					</div>
				</div>
			</v-col>
		</v-row>
	</v-container>
</template>
<style scoped>
/* optional class for removing the outline */
.prism-editor-wrapper :deep(.prism-editor__textarea:focus) {
	outline: none !important;
}

.prism-editor-wrapper :deep(.prism-editor__editor) {
	white-space: pre !important;
}

.prism-editor-wrapper :deep(.prism-editor__container) {
	overflow-x: scroll !important;
}

prism-editor-wrapper :deep(.prism-editor__textarea) {
	width: 999999px !important;
}

.custom-font {
	font-family: 'Fira Code', monospace;
}

.full-height {
	height: 100%;
}

.file-content {
	font-size: 0.875rem;
	width: 100%;
	min-height: calc(100% - 64px);
}

.fill-remaining-space {
	height: calc(100vh - 64px);
	max-width: 100%;
}

.sticky-top {
	position: sticky;
	align-self: flex-start;
	top: 64px; /** Top app bar height */
}

.sticky-bottom {
	position: sticky;
	align-self: flex-start;
	bottom: 0;
}
</style>

<script>
import ConfigApis from '@/apis/ConfigApis'

// import Prism Editor
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'
import { mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import logger from '../lib/logger.js'
import InstancesMixin from '../mixins/InstancesMixin.js'

const log = logger.get('Store')

export default {
	name: 'Store',
	mixins: [InstancesMixin],
	components: {
		PrismEditor: () =>
			import('vue-prism-editor').then((m) => m.PrismEditor),
	},
	watch: {
		selected() {
			this.fetchFile()
		},
	},
	computed: {
		selected() {
			if (!this.active.length) return undefined

			return this.active[0]
		},
		storePath() {
			return this.items[0]?.path
		},
	},
	data() {
		return {
			fab: false,
			selectedFiles: [],
			allowedExt: ['json', 'jsonl', 'txt', 'log', 'js', 'ts'],
			active: [],
			items: [],
			openFolders: [],
			fileContent: '',
			notSupported: false,
			loadingStore: true,
			loadingFile: false,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async deleteFile(item) {
			if (
				await this.app.confirm(
					'Attention',
					`Are you sure you want to delete the file <code>${item.name}</code>?`,
					'alert',
				)
			) {
				try {
					const data = await ConfigApis.deleteFile(item.path)
					if (data.success) {
						this.showSnackbar(
							'File deleted successfully',
							'success',
						)
						await this.refreshTree(true)
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.showSnackbar(error.message, 'error')
				}
			}
		},
		async deleteSelected() {
			const files = this.selectedFiles.map((f) => f.path)
			if (
				await this.app.confirm(
					'Attention',
					`Are you sure you want to delete ${files.length} files?`,
					'alert',
				)
			) {
				try {
					const data = await ConfigApis.deleteMultiple(files)
					if (data.success) {
						this.showSnackbar(
							'Files deleted successfully',
							'success',
						)
						await this.refreshTree(true)
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.showSnackbar(error.message, 'error')
				}
			}
		},
		async downloadSelectedZip() {
			const files = this.selectedFiles.map((f) => f.path)

			try {
				const response = await ConfigApis.downloadZip(files)

				await this.downloadZip(response, 'zwave-js-ui-store.zip')
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			}
		},
		async downloadZip(response, defaultName) {
			const regExp = /filename="([^"]+){1}"/g
			const fileName =
				regExp.exec(response.headers['content-disposition'])[1] ||
				defaultName
			if (window.navigator && window.navigator.msSaveOrOpenBlob) {
				// IE variant
				window.navigator.msSaveOrOpenBlob(
					new Blob([response.data], {
						type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					}),
					fileName,
				)
			} else {
				const url = window.URL.createObjectURL(
					new Blob([response.data], {
						type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					}),
				)
				const link = document.createElement('a')
				link.href = url
				link.setAttribute('download', fileName)
				document.body.appendChild(link)
				link.click()
			}
		},
		async downloadFile() {
			if (this.selected) {
				// get the file name without the extension
				const fileName = this.selected.name
					.split('.')
					.slice(0, -1)
					.join('.')
				this.app.exportConfiguration(
					this.fileContent,
					fileName,
					this.selected.ext,
				)
			}
		},
		async backupStore() {
			const result = await this.app.confirm(
				'Backup store',
				'Are you sure you want to backup the store? This backup will contain all useful files and settings.',
				'info',
				{
					width: 500,
					cancelText: 'No',
					confirmText: 'Yes',
				},
			)

			if (result) {
				try {
					const response = await ConfigApis.backupStore()

					await this.downloadZip(
						response,
						`store-backup_${Date.now()}.zip`,
					)

					this.refreshTree()
				} catch (error) {
					this.showSnackbar(error.message, 'error')
				}
			}
		},
		async restoreZip() {
			const restore = await this.app.confirm('Restore zip', '', 'info', {
				confirmText: 'Restore',
				inputs: [
					{
						type: 'file',
						label: 'Zip file',
						required: true,
						key: 'file',
						accept: 'application/zip',
					},
				],
			})

			if (restore.file) {
				try {
					const formData = new FormData()
					formData.append('upload', restore.file)
					formData.append('restore', 'true')
					const res = await ConfigApis.storeUpload(formData)
					if (!res.success)
						throw new Error(res.message || 'Restore failed')
					await this.refreshTree()
					this.showSnackbar('Restore successful', 'success')
				} catch (err) {
					this.showSnackbar(err.message || err, 'error')
				}
			}
		},
		async uploadFile(folder) {
			const folderPath = folder
				? folder.path.replace(this.storePath, '')
				: ''
			const upload = await this.app.confirm(
				`Upload file`,
				`Destination folder: <code>${folderPath || 'root'}</code>`,
				'info',
				{
					confirmText: 'Upload',
					width: 500,
					inputs: [
						{
							type: 'file',
							label: 'File',
							required: true,
							key: 'file',
						},
					],
				},
			)

			if (upload.file) {
				try {
					const formData = new FormData()
					formData.append('upload', upload.file)

					if (folderPath) {
						formData.append('folder', folderPath)
					}

					const res = await ConfigApis.storeUpload(formData)
					if (!res.success)
						throw new Error(res.message || 'Upload failed')
					await this.refreshTree()
					this.showSnackbar('Upload successful', 'success')
				} catch (err) {
					this.showSnackbar(err.message || err, 'error')
				}
			}
		},
		async writeFile(path, isDirectory = false) {
			const isNew = path && typeof path === 'string'
			const content = this.fileContent || ''

			// create a new file
			if (isNew) {
				const text = isDirectory ? 'Directory' : 'File'
				const { name } = await this.app.confirm(
					'New ' + text,
					'',
					'info',
					{
						confirmText: 'Create',
						inputs: [
							{
								type: 'text',
								label: text + ' name',
								required: true,
								key: 'name',
								hint: `Insert the ${text} name`,
							},
						],
					},
				)

				if (!name) {
					return
				}

				path = path + '/' + name
			} else if (this.selected) {
				path = this.selected.path
			} else {
				this.showSnackbar('No file selected', 'error')
				return
			}

			if (
				isNew ||
				(await this.app.confirm(
					'Attention',
					`Are you sure you want to overwrite the content of the file <code>${this.selected.name}<code>?`,
					'alert',
				))
			) {
				try {
					const data = await ConfigApis.writeFile(
						isNew ? '' : content,
						{
							path,
							isNew,
							isDirectory,
						},
					)
					if (data.success) {
						this.showSnackbar(
							`${isDirectory ? 'Directory' : 'File'} ${
								isNew ? 'created' : 'updated'
							} successfully`,
							'success',
						)
						await this.refreshTree()
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.showSnackbar(error.message, 'error')
				}
			}
		},
		highlighter(code) {
			return highlight(code, languages.js) // returns html
		},
		async fetchFile() {
			if (
				this.selected &&
				this.selected.path &&
				!this.selected.children
			) {
				this.fileContent = ''
				this.notSupported = false
				this.loadingFile = true
				try {
					if (!this.allowedExt.includes(this.selected.ext)) {
						throw Error(
							`Preview of .${this.selected.ext} files is not supported`,
						)
					}
					const data = await ConfigApis.getFile(this.selected.path)
					if (data.success) {
						this.fileContent = data.data
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.notSupported = true
					this.showSnackbar(error.message, 'error')
				}

				this.loadingFile = false
			}
		},
		async refreshTree(reset) {
			try {
				const data = await ConfigApis.getStore()
				if (data.success) {
					this.items = data.data
				} else {
					throw Error(data.message)
				}
			} catch (error) {
				this.showSnackbar(
					'Error while fetching store files: ' + error.message,
					'error',
				)
				log.error(error)
			}

			this.loadingStore = false
			this.loadingFile = false
			if (reset) {
				this.active = []
			}

			// open first level by default
			if (this.openFolders.length === 0) {
				this.openFolders.push(this.items[0])
			}
		},
	},
	async mounted() {
		await this.refreshTree()
	},
	beforeDestroy() {},
}
</script>
