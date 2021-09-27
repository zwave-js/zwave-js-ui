<template>
	<v-container fluid>
		<v-card height="800" style="margin-top: 30px; overflow: hidden">
			<v-row class="pa-4 full-height" justify="space-between">
				<v-col class="scroll" cols="5">
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
							<span>{{ item.name }} </span>
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
				</v-col>

				<v-divider vertical></v-divider>

				<v-col class="text-center no-scroll full-height">
					<div
						v-if="!selected || !selected.ext"
						class="
							title
							grey--text
							text--lighten-1
							font-weight-light
						"
						style="align-self: center"
					>
						Select a file
					</div>
					<div
						v-else-if="loadingFile"
						class="
							title
							grey--text
							text--lighten-1
							font-weight-light
						"
						style="align-self: center"
					>
						<v-progress-circular
							indeterminate
							color="primary"
							style="align-self: center"
						></v-progress-circular>
					</div>
					<v-card
						class="no-scroll full-height"
						v-else
						:key="selected.path"
						flat
					>
						<v-card-text
							class="no-scroll"
							style="height: calc(100% - 50px)"
						>
							<prism-editor
								v-if="!notSupported"
								class="custom-font"
								lineNumbers
								v-model="fileContent"
								:highlight="highlighter"
							></prism-editor>
						</v-card-text>
						<v-card-actions v-if="!notSupported">
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
						</v-card-actions>
					</v-card>
				</v-col>
			</v-row>
		</v-card>
		<v-speed-dial
			v-if="selectedFiles.length > 0"
			bottom
			fab
			right
			fixed
			v-model="fab"
		>
			<template v-slot:activator>
				<v-btn color="blue darken-2" dark fab hover v-model="fab">
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
	</v-container>
</template>
<style>
/* optional class for removing the outline */
.prism-editor-wrapper .prism-editor__textarea:focus {
	outline: none !important;
}

.custom-font {
	font-family: 'Fira Code', monospace;
}

.scroll {
	overflow-y: scroll;
	height: 100%;
}

.no-scroll {
	overflow: hidden;
}

.full-height {
	height: 100%;
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
