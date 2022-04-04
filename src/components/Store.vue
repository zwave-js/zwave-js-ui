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
					open-all
					selectable
					item-key="path"
					open-on-click
					return-object
				>
					<template v-slot:prepend="{ item, open }">
						<v-icon color="#FFC107" v-if="!item.ext">
							{{ open ? 'folder_open' : 'folder' }}
						</v-icon>
						<v-icon color="blue" v-else> text_snippet </v-icon>
					</template>
					<template v-slot:label="{ item }">
						<span class="subtitle-2">{{ item.name }}</span>
						<div class="caption grey--text">
							{{ item.size !== 'n/a' ? item.size : '' }}
						</div>
					</template>
					<template v-slot:append="{ item }">
						<v-row justify-end class="ma-1">
							<v-icon
								v-if="item.children"
								@click.stop="writeFile(item.path, true)"
								color="yellow"
								>create_new_folder</v-icon
							>
							<v-icon
								v-if="item.children"
								@click.stop="writeFile(item.path, false)"
								color="primary"
								>post_add</v-icon
							>
							<v-icon
								v-if="!item.isRoot"
								@click.stop="deleteFile(item)"
								color="red"
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
				<v-speed-dial
					v-if="selectedFiles.length > 0"
					bottom
					fab
					right
					absolute
					v-model="fab"
				>
					<template v-slot:activator>
						<v-btn
							color="blue darken-2"
							dark
							fab
							hover
							v-model="fab"
						>
							<v-icon v-if="fab">close</v-icon>
							<v-icon v-else>settings</v-icon>
						</v-btn>
					</template>
					<v-btn fab dark small color="green" @click="downloadZip">
						<v-icon>file_download</v-icon>
					</v-btn>
					<v-btn fab dark small color="red" @click="deleteSelected">
						<v-icon>delete</v-icon>
					</v-btn>
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
							<v-btn
								color="purple darken-1"
								text
								@click="writeFile"
							>
								SAVE
								<v-icon right dark>save</v-icon>
							</v-btn>
							<v-btn
								color="green darken-1"
								text
								@click="downloadFile"
							>
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
.prism-editor-wrapper >>> .prism-editor__textarea:focus {
	outline: none !important;
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
import { PrismEditor } from 'vue-prism-editor'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'
import { mapMutations } from 'vuex'

export default {
	name: 'Store',
	components: {
		PrismEditor,
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
	},
	data() {
		return {
			fab: false,
			selectedFiles: [],
			allowedExt: ['json', 'jsonl', 'txt', 'log', 'js', 'ts'],
			active: [],
			items: [],
			fileContent: '',
			notSupported: false,
			loadingStore: true,
			loadingFile: false,
		}
	},
	methods: {
		...mapMutations(['showSnackbar']),
		async deleteFile(item) {
			if (
				await this.$listeners.showConfirm(
					'Attention',
					`Are you sure you want to delete the file ${item.name}?`,
					'alert'
				)
			) {
				try {
					const data = await ConfigApis.deleteFile(item.path)
					if (data.success) {
						this.showSnackbar('File deleted successfully')
						await this.refreshTree(true)
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.showSnackbar(error.message)
				}
			}
		},
		async deleteSelected() {
			const files = this.selectedFiles.map((f) => f.path)
			if (
				await this.$listeners.showConfirm(
					'Attention',
					`Are you sure you want to delete ${files.length} files?`,
					'alert'
				)
			) {
				try {
					const data = await ConfigApis.deleteMultiple(files)
					if (data.success) {
						this.showSnackbar('Files deleted successfully')
						await this.refreshTree(true)
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.showSnackbar(error.message)
				}
			}
		},
		async downloadZip() {
			const files = this.selectedFiles.map((f) => f.path)
			try {
				const response = await ConfigApis.downloadZip(files)
				const regExp = /filename="([^"]+){1}"/g
				const fileName =
					regExp.exec(response.headers['content-disposition'])[1] ||
					'zwavejs2mqtt-store.zip'
				if (window.navigator && window.navigator.msSaveOrOpenBlob) {
					// IE variant
					window.navigator.msSaveOrOpenBlob(
						new Blob([response.data], {
							type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						}),
						fileName
					)
				} else {
					const url = window.URL.createObjectURL(
						new Blob([response.data], {
							type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						})
					)
					const link = document.createElement('a')
					link.href = url
					link.setAttribute('download', fileName)
					document.body.appendChild(link)
					link.click()
				}
			} catch (error) {
				this.showSnackbar(error.message)
			}
		},
		async downloadFile() {
			if (this.selected) {
				// get the file name without the extension
				const fileName = this.selected.name
					.split('.')
					.slice(0, -1)
					.join('.')
				this.$listeners.export(
					this.fileContent,
					fileName,
					this.selected.ext
				)
			}
		},
		async writeFile(path, isDirectory = false) {
			const isNew = path && typeof path === 'string'
			const content = this.fileContent || ''

			// create a new file
			if (isNew) {
				const text = isDirectory ? 'Directory' : 'File'
				const { name } = await this.$listeners.showConfirm(
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
					}
				)

				if (!name) {
					return
				}

				path = path + '/' + name
			} else if (this.selected) {
				path = this.selected.path
			} else {
				this.showSnackbar('No file selected')
				return
			}

			if (
				isNew ||
				(await this.$listeners.showConfirm(
					'Attention',
					`Are you sure you want to overwrite the content of the file ${this.selected.name}?`,
					'alert'
				))
			) {
				try {
					const data = await ConfigApis.writeFile(content, {
						path,
						isNew,
						isDirectory,
					})
					if (data.success) {
						this.showSnackbar(
							`${isDirectory ? 'Directory' : 'File'} ${
								isNew ? 'created' : 'updated'
							} successfully`
						)
						await this.refreshTree()
					} else {
						throw Error(data.message)
					}
				} catch (error) {
					this.showSnackbar(error.message)
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
							`Preview of .${this.selected.ext} files is not supported`
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
					this.showSnackbar(error.message)
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
					'Error while fetching store files: ' + error.message
				)
				console.log(error)
			}

			this.loadingStore = false
			this.loadingFile = false
			if (reset) {
				this.active = []
			}
		},
	},
	async mounted() {
		await this.refreshTree()
	},
	beforeDestroy() {},
}
</script>
