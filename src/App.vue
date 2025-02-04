<template>
	<v-app>
		<div
			v-if="$route.meta.requiresAuth && auth !== undefined && !hideTopbar"
		>
			<v-navigation-drawer
				v-if="!navTabs || $vuetify.breakpoint.smAndDown"
				clipped-left
				:mini-variant="mini"
				v-model="drawer"
				app
			>
				<v-list nav class="py-0">
					<v-list-item :class="mini && 'px-0'">
						<v-list-item-avatar>
							<img
								style="padding: 3px; border-radius: 0"
								src="/logo.svg"
							/>
						</v-list-item-avatar>
						<v-list-item-content>
							<v-list-item-title>{{
								'Z-Wave JS UI'
							}}</v-list-item-title>
						</v-list-item-content>
					</v-list-item>
				</v-list>
				<v-divider style="margin-top: 8px"></v-divider>
				<v-list nav>
					<v-list-item
						v-for="item in pages"
						:key="item.title"
						:to="item.path === '#' ? '' : item.path"
						:color="item.path === $route.path ? 'primary' : ''"
					>
						<v-list-item-action>
							<v-badge
								color="red"
								:value="item.badge"
								:content="item.badge"
								dot
							>
								<v-icon>{{ item.icon }}</v-icon>
							</v-badge>
						</v-list-item-action>
						<v-list-item-content>
							<v-list-item-title
								class="subtitle-2 font-weight-bold"
								>{{ item.title }}</v-list-item-title
							>
						</v-list-item-content>
					</v-list-item>
				</v-list>
			</v-navigation-drawer>

			<v-app-bar app>
				<template v-if="!navTabs || $vuetify.breakpoint.smAndDown">
					<v-app-bar-nav-icon @click.stop="toggleDrawer" />
					<v-toolbar-title v-if="$vuetify.breakpoint.smAndUp">
						{{ title }}
					</v-toolbar-title>
				</template>
				<template v-else>
					<v-tabs>
						<v-tab
							v-for="item in pages"
							:key="item.title"
							:to="item.path === '#' ? '' : item.path"
							class="smaller-min-width-tabs"
						>
							<v-icon
								:left="item.path === $router.currentRoute.path"
								:small="item.path === $router.currentRoute.path"
							>
								{{ item.icon }}
							</v-icon>
							<span
								v-if="item.path === $router.currentRoute.path"
								class="subtitle-2"
							>
								{{ item.title }}
							</span>
						</v-tab>
					</v-tabs>
				</template>

				<v-spacer></v-spacer>

				<v-tooltip
					v-if="zwave.enabled && appInfo.controllerStatus"
					bottom
				>
					<template v-slot:activator="{ on }">
						<div
							v-on="on"
							:style="{
								background: appInfo.controllerStatus.error
									? 'rgb(244, 67, 54)'
									: '',
							}"
							class="controller-status text-truncate"
						>
							{{ appInfo.controllerStatus.status }}
						</div>
					</template>
					<div>
						{{ appInfo.controllerStatus.status }}
						<br />
						{{
							appInfo.controllerStatus.error
								? 'Error: ' + appInfo.controllerStatus.error
								: ''
						}}
					</div>
				</v-tooltip>

				<v-tooltip
					v-if="zwave.enabled && appInfo.controllerStatus"
					bottom
				>
					<template v-slot:activator="{ on }">
						<v-icon
							class="ml-3"
							dark
							medium
							style="cursor: default"
							:color="inclusionState.color"
							v-on="on"
							>{{ inclusionState.icon }}</v-icon
						>
					</template>
					<span>{{ inclusionState.message }}</span>
				</v-tooltip>

				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-icon
							class="mr-3 ml-3"
							dark
							medium
							style="cursor: default"
							:color="statusColor || 'orange'"
							v-on="on"
							>swap_horizontal_circle</v-icon
						>
					</template>
					<span>{{ status }}</span>
				</v-tooltip>

				<v-tooltip z-index="9999" bottom open-on-click>
					<template v-slot:activator="{ on }">
						<v-icon
							dark
							medium
							class="mr-3"
							style="cursor: default"
							color="primary"
							v-on="on"
							@click="copyVersion"
							>info</v-icon
						>
					</template>
					<div class="info-box">
						<div>
							<small>Z-Wave JS UI</small>
							<strong>{{ appInfo.appVersion }}</strong>
						</div>
						<div>
							<small>Z-Wave JS</small>
							<strong>{{ appInfo.zwaveVersion }}</strong>
						</div>
						<div>
							<small>Home ID</small>
							<strong>{{ appInfo.homeid }}</strong>
						</div>
						<div>
							<small>Home Hex</small>
							<strong>{{ appInfo.homeHex }}</strong>
						</div>
					</div>
				</v-tooltip>

				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-badge
							v-on="on"
							class="mr-3"
							:content="updateAvailable"
							:value="updateAvailable"
							color="red"
							overlap
						>
							<v-btn small icon @click="showUpdateDialog">
								<v-icon dark medium color="primary"
									>history</v-icon
								>
							</v-btn>
						</v-badge>
					</template>
				</v-tooltip>

				<span v-if="auth">
					<v-menu v-if="$vuetify.breakpoint.xsOnly" bottom left>
						<template v-slot:activator="{ on }">
							<v-btn small v-on="on" icon>
								<v-icon>more_vert</v-icon>
							</v-btn>
						</template>

						<v-list>
							<v-list-item
								v-for="(item, i) in menu"
								:key="i"
								@click="item.func"
							>
								<v-list-item-action>
									<v-icon>{{ item.icon }}</v-icon>
								</v-list-item-action>
								<v-list-item-title>{{
									item.tooltip
								}}</v-list-item-title>
							</v-list-item>
						</v-list>
					</v-menu>

					<span v-else class="text-no-wrap">
						<v-menu
							v-for="item in menu"
							:key="item.text"
							bottom
							left
						>
							<template v-slot:activator="{ on }">
								<v-btn
									small
									class="mr-2"
									v-on="on"
									icon
									@click="item.func"
								>
									<v-tooltip bottom>
										<template v-slot:activator="{ on }">
											<v-icon
												dark
												color="primary"
												v-on="on"
												>{{ item.icon }}</v-icon
											>
										</template>
										<span>{{ item.tooltip }}</span>
									</v-tooltip>
								</v-btn>
							</template>

							<v-list v-if="item.menu">
								<v-list-item
									v-for="(menu, i) in item.menu"
									:key="i"
									@click="menu.func"
								>
									<v-list-item-title>{{
										menu.title
									}}</v-list-item-title>
								</v-list-item>
							</v-list>
						</v-menu>
					</span>
				</span>
			</v-app-bar>
		</div>
		<main style="height: 100%">
			<v-main style="height: 100%">
				<template v-if="auth !== undefined">
					<router-view
						v-if="inited || !skeletons"
						@import="importFile"
						@export="exportConfiguration"
						@showConfirm="confirm"
						:socket="socket"
					/>
					<!-- put some skeleton loaders while fetching settings -->
					<v-container v-else>
						<v-skeleton-loader
							v-for="(s, i) in skeletons"
							:key="`skeleton-${i}`"
							:type="s"
							:loading="true"
						></v-skeleton-loader>
					</v-container>
				</template>
				<!-- Show loading splash screen while checking for auth -->
				<v-row
					style="height: 100%"
					align="center"
					justify="center"
					v-else
				>
					<v-col align="center">
						<div class="text-h2 ma-5">
							{{ error ? error : 'Loading...' }}
						</div>
						<v-progress-circular
							v-if="!error"
							size="200"
							indeterminate
						></v-progress-circular>
						<v-btn text @click="checkAuth" v-else
							>Retry <v-icon right dark>refresh</v-icon></v-btn
						>
					</v-col>
				</v-row>
				<v-footer
					v-if="$route.path !== '/store'"
					fixed
					class="text-center"
				>
					<v-col
						class="d-flex pa-0 justify-center text-caption"
						:style="{
							fontSize: $vuetify.breakpoint.xsOnly
								? '0.7rem !important'
								: '',
						}"
					>
						Made with &#10084;&#65039; by
						<strong class="ml-1 mr-2">Daniel Lando</strong>-
						Enjoying it?&nbsp;
						<a
							target="_blank"
							href="https://github.com/sponsors/robertsLando"
							>Support me &#128591;</a
						>
					</v-col>
				</v-footer>
			</v-main>
		</main>

		<PasswordDialog
			@updatePassword="updatePassword()"
			@close="closePasswordDialog()"
			:show="dialog_password"
			:password="password"
		/>

		<Confirm ref="confirm"></Confirm>
		<!-- Used for node added only -->
		<Confirm ref="confirm2"></Confirm>

		<LoaderDialog
			v-model="dialogLoader"
			:progress="loaderProgress"
			:title="loaderTitle"
			:text="loaderText"
			:indeterminate="loaderIndeterminate"
		></LoaderDialog>

		<v-snackbars
			:objects.sync="messages"
			:timeout="5000"
			top
			right
			style="margin-top: 10px"
		>
			<template v-slot="{ message }">
				<p
					style="margin-bottom: 2px"
					class="font-weight-bold"
					v-if="message && message.title"
				>
					{{ message.title }}
				</p>
				<p
					style="margin-bottom: 0; white-space: pre-wrap"
					v-text="
						typeof message === 'object' ? message.text : message
					"
				></p>
			</template>
			<template v-slot:action="{ close }">
				<v-btn text @click="close">Close</v-btn>
			</template>
		</v-snackbars>

		<DialogNodesManager
			@open="nodesManagerDialog = true"
			@close="nodesManagerDialog = false"
			:socket="socket"
			ref="nodesManager"
		/>
	</v-app>
</template>

<style>
.controller-status {
	color: #555;
	background: #e0e0e0;
	border-radius: 4px;
	padding: 0.3rem 0;
	font-size: 0.8rem;
	min-width: 150px;
	max-width: 500px;
	text-align: center;
}
.info-box > div {
	display: flex;
	justify-content: space-between;
}
.info-box > div > strong {
	padding-left: 1.2rem;
}
/* Fix Vuetify code style after update to 2.4.0 */
code {
	color: #c62828 !important;
	font-weight: 700 !important;
}
</style>

<script>
// https://github.com/socketio/socket.io-client/blob/master/docs/API.md
import io from 'socket.io-client'
import VSnackbars from 'v-snackbars'

import ConfigApis from '@/apis/ConfigApis'
import Confirm from '@/components/Confirm.vue'
import PasswordDialog from '@/components/dialogs/Password.vue'
import LoaderDialog from '@/components/dialogs/DialogLoader.vue'

import { Routes } from '@/router'

import { mapActions, mapState } from 'pinia'
import useBaseStore from './stores/base.js'
import { manager, instances } from './lib/instanceManager'
import logger from './lib/logger'

import {
	socketEvents,
	inboundEvents as socketActions,
} from '@server/lib/SocketEvents'
import {
	getEnumMemberName,
	SecurityBootstrapFailure,
	FirmwareUpdateStatus,
	InclusionState,
} from 'zwave-js/safe'
import DialogNodesManager from '@/components/dialogs/DialogNodesManager.vue'
import { uuid } from './lib/utils'

let socketQueue = []

const log = logger.get('App')

export default {
	components: {
		PasswordDialog,
		LoaderDialog,
		VSnackbars,
		Confirm,
		DialogNodesManager,
	},
	name: 'app',
	computed: {
		...mapState(useBaseStore, [
			'user',
			'auth',
			'appInfo',
			'controllerNode',
			'zniffer',
			'zwave',
			'znifferState',
			'inited',
		]),
		...mapState(useBaseStore, {
			darkMode: (store) => store.ui.darkMode,
			navTabs: (store) => store.ui.navTabs,
		}),
		skeletons() {
			// return the skeletons array based on actual route
			const route = this.$route.path

			switch (route) {
				case Routes.controlPanel:
					return ['actions', 'table']
				case Routes.settings:
					return ['list-item-two-line@10']
				case Routes.store:
					return ['list-item-two-line@10', 'divider']
				case Routes.mesh:
					return ['list-item-two-line, image']
				case Routes.zniffer:
				case Routes.debug:
				case Routes.scenes:
				case Routes.smartStart:
					return ['table']
				default:
					return null
			}
		},
		pages() {
			const pages = [
				{ icon: 'settings', title: 'Settings', path: Routes.settings },
				{ icon: 'bug_report', title: 'Debug', path: Routes.debug },
				{ icon: 'folder', title: 'Store', path: Routes.store },
			]

			if (this.zwave?.enabled) {
				pages.unshift(
					{
						icon: 'widgets',
						title: 'Control Panel',
						path: Routes.controlPanel,
					},
					{
						icon: 'qr_code_scanner',
						title: 'Smart Start',
						path: Routes.smartStart,
					},
				)

				pages.splice(3, 0, {
					icon: 'movie_filter',
					title: 'Scenes',
					path: Routes.scenes,
				})

				pages.push({
					icon: 'share',
					title: 'Network graph',
					path: Routes.mesh,
				})
			}

			if (this.zniffer?.enabled) {
				pages.push({
					icon: 'preview',
					title: 'Zniffer',
					path: Routes.zniffer,
					badge: this.znifferState?.started ? 1 : 0,
				})
			}

			for (const p of pages) {
				if (p.badge === undefined) {
					p.badge = 0
				}
			}

			return pages
		},
		updateAvailable() {
			return this.appInfo.newConfigVersion ? 1 : 0
		},
		inclusionState() {
			const state = this.appInfo.controllerStatus?.inclusionState

			const toReturn = {
				icon: 'help',
				color: 'grey',
				message: 'Unknown state',
			}

			switch (state) {
				case InclusionState.Idle:
					toReturn.message = 'Controller is idle'
					toReturn.icon = 'notifications_paused'
					toReturn.color = 'grey'
					break
				case InclusionState.Including:
					toReturn.message = 'Inclusion is active'
					toReturn.icon = 'all_inclusive'
					toReturn.color = 'purple'
					break
				case InclusionState.Excluding:
					toReturn.message = 'Exclusion is active'
					toReturn.icon = 'cancel'
					toReturn.color = 'red'
					break
				case InclusionState.Busy:
					toReturn.message =
						'Waiting for inclusion/exclusion to complete...'
					toReturn.icon = 'hourglass_bottom'
					toReturn.color = 'yellow'
					break
				case InclusionState.SmartStart:
					toReturn.message = 'SmartStart inclusion is active'
					toReturn.icon = 'auto_fix_normal'
					toReturn.color = 'primary'
					break
			}

			return toReturn
		},
	},
	watch: {
		$route: function (value) {
			this.title = value.name || ''
			this.startSocket()
		},
		systemDark() {
			this.updateDarkMode(this.darkMode)
		},
		darkMode(val) {
			this.updateDarkMode(val)
		},
		pages() {
			// this.verifyRoute()
		},
		controllerNode(node) {
			if (!node) return

			if (node.firmwareUpdate) {
				if (!this.dialogLoader) {
					this.loaderTitle = ''
					this.loaderText =
						'Updating controller firmware, please wait...'
					this.dialogLoader = true
				}
				this.loaderProgress = node.firmwareUpdate.progress
				this.loaderIndeterminate = this.loaderProgress === 0
			} else if (node.firmwareUpdateResult) {
				this.dialogLoader = true // always open it to show the result, in case no progress is done it would be closed
				this.loaderProgress = -1
				this.loaderTitle = ''
				const result = node.firmwareUpdateResult

				useBaseStore().updateNode(
					{
						id: node.id,
						firmwareUpdateResult: false,
					},
					true,
				)

				this.loaderText = `<span style="white-space: break-spaces;" class="${
					result.success ? 'success' : 'error'
				}--text">Controller firmware update finished ${
					result.success
						? 'successfully. It may take a few seconds for the stick to restart.'
						: 'with error'
				}.\n Status: ${result.status}</span>`
			}
		},
	},
	data() {
		return {
			socket: null,
			error: false,
			dialog_password: false,
			dialogLoader: false,
			loaderTitle: '',
			loaderText: '',
			loaderProgress: -1,
			loaderIndeterminate: false,
			password: {},
			nodesManagerDialog: false,
			menu: [
				{
					icon: 'lock',
					func: this.showPasswordDialog,
					tooltip: 'Password',
				},
				{
					icon: 'logout',
					func: this.logout,
					tooltip: 'Logout',
				},
			],
			status: '',
			statusColor: '',
			drawer: false,
			mini: false,
			topbar: [],
			hideTopbar: false,
			title: '',
			messages: [],
			systemDark: false,
			mq_system_dark: null,
		}
	},
	methods: {
		verifyRoute() {
			// ensure the actual route is available in pages otherwise redirect to the first one
			if (
				this.$route.meta.requiresAuth &&
				this.pages.findIndex((p) => p.path === this.$route.path) === -1
			) {
				const preferred = ['control-panel', 'zniffer', 'settings']

				const allowed = this.pages.filter((p) =>
					preferred.includes(p.path),
				)

				const path = allowed.length ? allowed[0].path : undefined

				if (path) {
					this.$router.replace(path)
				} else {
					this.$router.replace(this.pages[0].path)
				}
			}
		},
		showNodesManager(stepOrStepsValues) {
			// used in ControlPanel.vue
			this.$refs.nodesManager.show(stepOrStepsValues)
		},
		onGrantSecurityClasses(requested) {
			if (this.nodesManagerDialog) {
				return
			}
			this.showNodesManager('')
			this.$refs.nodesManager.onGrantSecurityCC(requested)
		},
		...mapActions(useBaseStore, [
			'init',
			'initNodes',
			'setAppInfo',
			'setZnifferState',
			'onUserLogged',
			'updateValue',
			'setValue',
			'removeValue',
			'setControllerStatus',
			'setStatistics',
			'addNodeEvent',
			'updateNode',
			'removeNode',
			'setZnifferState',
		]),
		copyVersion() {
			const el = document.createElement('textarea')
			el.value = `zwave-js-ui: ${this.appInfo.appVersion}\nzwave-js: ${this.appInfo.zwaveVersion}\nhome id: ${this.appInfo.homeid}\nhome hex: ${this.appInfo.homeHex}`
			el.setAttribute('readonly', '')
			el.style.position = 'absolute'
			el.style.left = '-9999px'
			document.body.appendChild(el)
			el.select()
			document.execCommand('copy')
			document.body.removeChild(el)
			this.showSnackbar('Copied to clipboard')
		},
		async updatePassword() {
			try {
				const response = await ConfigApis.updatePassword(this.password)
				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)
				if (response.success) {
					this.closePasswordDialog()
					this.onUserLogged(response.user)
				}
			} catch (error) {
				this.showSnackbar(
					'Error while updating password, check console for more info',
					'error',
				)
				log.error(error)
			}
		},
		closePasswordDialog() {
			this.dialog_password = false
		},
		showPasswordDialog() {
			this.password = {}
			this.dialog_password = true
		},
		async onNodeAdded({ node, result }) {
			if (!this.nodesManagerDialog) {
				await this.confirm2(
					'Node added',
					`<div class="d-flex flex-column align-center col">
					<i aria-hidden="true" class="v-icon notranslate material-icons theme--light success--text" style="font-size: 60px;">check_circle</i>
					<p class="mt-3 headline text-center">
						Node ${node.id} added with security ${node.security || 'None'}${
							result.lowSecurityReason
								? ` (${getEnumMemberName(
										SecurityBootstrapFailure,
										result.lowSecurityReason,
									)})`
								: ''
						}
					</p>
				</div>`,
					'info',
					{
						width: 500,
						confirmText: 'Close',
						cancelText: '',
					},
				)
			}
		},
		toggleDrawer() {
			if (
				['xs', 'sm', 'md'].indexOf(this.$vuetify.breakpoint.name) >= 0
			) {
				this.mini = false
				this.drawer = !this.drawer
			} else {
				this.mini = !this.mini
				this.drawer = true
			}
		},
		async confirm(title, text, level, options) {
			options = options || {}

			const levelMap = {
				warning: 'orange',
				alert: 'red',
			}

			options.color = options.color || levelMap[level] || 'primary'

			return this.$refs.confirm.open(title, text, options)
		},
		async confirm2(title, text, level, options) {
			options = options || {}

			const levelMap = {
				warning: 'orange',
				alert: 'red',
			}

			options.color = options.color || levelMap[level] || 'primary'

			return this.$refs.confirm2.open(title, text, options)
		},
		showSnackbar: function (text, color, timeout) {
			const message = {
				message: text,
				color: color || 'info',
				timeout,
			}

			this.messages.push(message)

			return message
		},
		apiRequest(
			apiName,
			args = [],
			options = { infoSnack: true, errorSnack: true },
		) {
			return new Promise((resolve) => {
				if (this.socket.connected) {
					log.debug(
						`Sending API request: ${apiName} with args:`,
						args,
					)
					if (options.infoSnack) {
						this.showSnackbar(`API ${apiName} called`, 'info')
					}
					const data = {
						api: apiName,
						args: args,
					}
					this.socket.emit(socketActions.zwave, data, (response) => {
						log.debug(`API response for ${apiName}:`, response)
						if (!response.success) {
							log.error(
								`Error while calling ${apiName}:`,
								response,
							)
							if (options.errorSnack) {
								this.showSnackbar(
									`Error while calling ${apiName}: ${response.message}`,
									'error',
								)
							}
						}
						resolve(response)
					})
				} else {
					log.debug(
						`Socket disconnected, queueing API request: ${apiName} with args:`,
						args,
					)
					socketQueue.push({
						apiName,
						args,
						options,
						resolve: resolve,
					})
					// resolve({
					// 	success: false,
					// 	message: 'Socket disconnected',
					// })
					//this.showSnackbar('Socket disconnected', 'error')
				}
			})
		},
		updateStatus: function (status, color) {
			this.status = status
			this.statusColor = color
		},
		async showUpdateDialog() {
			const newVersion = this.appInfo.newConfigVersion

			const result = await this.confirm(
				'Config updates',
				newVersion
					? `<div style="text-align:center"><p>New <b>zwave-js</b> config version available: <code>${newVersion}</code>.</p><p>Mind that some changes may require a <b>re-interview</b> of affected devices</p></div>`
					: '<div style="text-align:center"><p>No updates available yet. Press on <b>CHECK</b> to trigger a new check.</p><p>By default checks are automatically done daily at midnight</p></div>',
				'info',
				{
					width: 500,
					cancelText: 'Close',
					confirmText: newVersion ? 'Install' : 'Check',
				},
			)

			if (result) {
				this.apiRequest(
					newVersion
						? 'installConfigUpdate'
						: 'checkForConfigUpdates',
					[],
				)

				this.showSnackbar(
					newVersion ? 'Installation started' : 'Check requested',
				)
			}
		},
		importFile: function (ext) {
			const self = this
			// Check for the various File API support.
			return new Promise(function (resolve, reject) {
				if (
					window.File &&
					window.FileReader &&
					window.FileList &&
					window.Blob
				) {
					const input = document.createElement('input')
					input.type = 'file'
					input.addEventListener('change', function (event) {
						const files = event.target.files

						if (files && files.length > 0) {
							const file = files[0]
							const reader = new FileReader()

							reader.addEventListener(
								'load',
								function (fileReaderEvent) {
									let err
									let data = fileReaderEvent.target.result

									if (ext === 'json') {
										try {
											data = JSON.parse(data)
										} catch (e) {
											self.showSnackbar(
												'Error while parsing input file, check console for more info',
												'error',
											)
											console.error(e)
											err = e
										}
									}

									if (err) {
										reject(err)
									} else {
										resolve({ data, file })
									}
								},
							)

							if (ext === 'buffer') {
								reader.readAsArrayBuffer(file)
							} else {
								reader.readAsText(file)
							}
						}
					})

					input.click()
				} else {
					reject(Error('Unable to load file in this browser'))
				}
			})
		},
		exportConfiguration: function (data, fileName, ext) {
			ext = ext || 'json'
			const textMime = ['json', 'jsonl', 'txt', 'log', 'js', 'ts']
			const contentType = textMime.includes(ext)
				? 'text/plain'
				: 'application/octet-stream'
			const a = document.createElement('a')

			data =
				ext === 'json' && typeof data === 'object'
					? JSON.stringify(data, null, 2) // pretty print
					: data

			const blob = new Blob([data], {
				type: contentType,
			})

			document.body.appendChild(a)
			a.href = window.URL.createObjectURL(blob)
			a.download = fileName + '.' + (ext || 'json')
			a.target = '_self'
			a.click()
		},
		async getConfig() {
			try {
				const data = await ConfigApis.getConfig()
				if (!data.success) {
					this.showSnackbar(
						'Error while retrieving configuration, check console',
						'error',
					)
				} else {
					this.init(data)

					if (data.deprecationWarning) {
						await this.confirm(
							'Z-Wave JS UI',
							`<h3 style="white-space:pre" class="text-center">If you are seeing this message it means that you are using the old <code>zwavejs2mqtt</code> docker tag.\nStarting from 8.0.0 version it is <b>DEPRECATED</b>, please use the new <code>zwave-js-ui</code> tag.</h3>
						<p class="mt-4 text-center">
						You can find more info about this change in <a target="_blank" href="https://github.com/zwave-js/zwavejs2mqtt/releases/tag/v8.0.0">v8.0.0 CHANGELOG</a>.
						</p>`,
							'info',
							{
								width: 1000,
								noCancel: true,
								confirmText: 'Got it',
								persistent: true,
							},
						)
					}

					if (
						!data.settings ||
						!data.settings.zwave ||
						data.settings.zwave.enableStatistics === undefined
					) {
						const result = await this.confirm(
							'Usage statistics',
							`<p>Please allow the <b>Z-Wave JS</b> project to collect some anonymized data regarding the devices
              you own so that we can generate statistics that allow us to better focus our development efforts.
              <b>This information is not tracked to any identifiable user or IP address and cannot be used to identify you</b>. Specifically, we'd like to collect:</p>

              • A <b>hash</b> of your network ID salted with a 32 byte randomly generated number, which is used to prevent duplicate records (this salted hash <b>cannot be undone</b> to reveal your network ID or identify you);</br>
              • <b>Name</b> and <b>version</b> of the application you are running;</br>
              • Information about which version of <code>node-zwave-js</code> you are running;</br>
              • The <b>manufacturer ID</b>, <b>product type</b>, <b>product ID</b>, and <b>firmware version</b> of each device that is part of your Z-Wave network.</br></br>

              <p>Information is sent <b>once a day</b> or, if you restart your network, when all nodes are ready. Collecting this information is critical to the user experience provided by Z-Wave JS.
              More information about the data that is collected and how it is used, including an example of the data collected, can be found <a target="_blank" href="https://zwave-js.github.io/node-zwave-js/#/data-collection/data-collection?id=usage-statistics">here</a>`,
							'info</p>',
							{
								width: 1000,
								cancelText: 'No 😢',
								confirmText: 'Ok 😍',
								persistent: true,
							},
						)

						const data = await ConfigApis.updateStats(result)

						if (data.success) {
							this.showSnackbar(
								`Statistics are ${
									data.enabled ? 'enabled' : 'disabled'
								}`,
							)
						} else {
							throw Error(data.message)
						}
					}

					await this.checkChangelog()
				}
			} catch (error) {
				this.showSnackbar(error.message, 'error')
				log.error(error)
			}
		},
		onInit(data) {
			this.setAppInfo(data.info)
			this.setZnifferState(data.zniffer)
			this.setControllerStatus({
				error: data.error,
				status: data.cntStatus,
				inclusionState: data.inclusionState,
			})
			// convert node values in array
			this.initNodes(data.nodes)
		},
		async startSocket() {
			if (
				this.auth === undefined ||
				this.socket ||
				!this.$route.meta ||
				!this.$route.meta.requiresAuth
			) {
				return
			}

			if (this.auth && (!this.user || !this.user.token)) {
				await this.logout()
				return
			}

			const query = this.auth ? { token: this.user.token } : undefined

			this.socket = io('/', {
				path: location.pathname
					? location.pathname + 'socket.io'
					: undefined,
				query: query,
				rejectUnauthorized: false,
			})

			this.socket.on('connect', () => {
				this.updateStatus('Connected', 'green')
				log.info('Socket connected')
				this.socket.emit(
					socketActions.init,
					true,
					this.onInit.bind(this),
				)

				if (socketQueue.length > 0) {
					socketQueue.forEach((item) => {
						this.apiRequest(
							item.apiName,
							item.args,
							item.options,
						).then(item.resolve)
					})
					socketQueue = []
				}
			})

			this.socket.on('disconnect', () => {
				log.info('Socket disconnected')
				this.updateStatus('Disconnected', 'red')
			})

			this.socket.on('error', (err) => {
				log.info('Socket error', err)
			})

			this.socket.on('reconnecting', () => {
				this.updateStatus('Reconnecting', 'yellow')
			})

			if (log.enabledFor(logger.DEBUG)) {
				this.socket.onAny((eventName, ...args) => {
					if (
						![
							socketEvents.nodeEvent,
							socketEvents.debug,
							socketEvents.statistics,
						].includes(eventName)
					) {
						log.debug('Socket event', eventName, args)
					}
				})
			}

			this.socket.on(socketEvents.init, this.onInit.bind(this))

			this.socket.on(socketEvents.info, this.setAppInfo.bind(this))

			this.socket.on(socketEvents.connected, this.setAppInfo.bind(this))
			this.socket.on(
				socketEvents.controller,
				this.setControllerStatus.bind(this),
			)

			this.socket.on(socketEvents.nodeUpdated, this.updateNode.bind(this))
			this.socket.on(socketEvents.nodeRemoved, this.removeNode.bind(this))
			this.socket.on(socketEvents.nodeAdded, this.onNodeAdded.bind(this))

			this.socket.on(
				socketEvents.valueRemoved,
				this.removeValue.bind(this),
			)
			this.socket.on(
				socketEvents.valueUpdated,
				this.updateValue.bind(this),
			)

			this.socket.on(
				socketEvents.metadataUpdated,
				this.setValue.bind(this),
			)

			this.socket.on(
				socketEvents.statistics,
				this.setStatistics.bind(this),
			)

			this.socket.on(socketEvents.nodeEvent, this.addNodeEvent.bind(this))

			this.socket.on(
				socketEvents.grantSecurityClasses,
				this.onGrantSecurityClasses.bind(this),
			)

			this.socket.on(socketEvents.znifferState, (data) => {
				this.setZnifferState(data)
			})
			// don't await this, will cause a loop of calls
			this.getConfig()
		},
		async logout() {
			const user = Object.assign({}, this.user)
			localStorage.setItem('user', JSON.stringify(user))
			localStorage.removeItem('logged')

			if (this.socket) {
				this.socket.close()
				this.socket = null
			}

			if (this.auth) {
				try {
					await ConfigApis.logout()
					this.showSnackbar('Logged out', 'success')
				} catch (error) {
					this.showSnackbar('Logout failed', 'error')
				}

				if (this.$route.path !== Routes.login) {
					this.$router.push(Routes.login)
				}
			}
		},
		// get config, used to check if gateway is used with auth or not
		async checkAuth() {
			this.error = false
			try {
				const data = await ConfigApis.isAuthEnabled()
				if (!data.success) {
					throw Error(
						data.message || 'Error while checking authorizations',
					)
				} else {
					const newAuth = data.data === true
					const oldAuth = this.auth

					useBaseStore().auth = newAuth

					if (oldAuth !== undefined && oldAuth !== newAuth) {
						await this.logout()
					}

					if (!newAuth && this.$route.path === Routes.login) {
						this.$router.push(
							localStorage.getItem('nextUrl') || Routes.main,
						)
						localStorage.removeItem('nextUrl')
					}
					this.startSocket()
				}
			} catch (error) {
				// in case of a redirect (302) trigger a page reload
				// needed to fix external auth issues #3427
				const statusCode = error.response?.status
				if (
					[302, 401].includes(statusCode) ||
					error.response?.type === 'opaqueredirect'
				) {
					// reload current page, be sure this doesn't hits cache, add a random query param
					location.search = `?auth=${uuid()}`
					return
				}
				setTimeout(() => (this.error = error.message), 1000)
				log.error(error)
			}
		},
		async handleFwUpdateResponse(response) {
			const result = response.result

			const title = `Firmware update ${
				result.success ? 'success' : 'failed'
			}`

			let message = ''

			if (result.success) {
				if (
					result.status ===
					FirmwareUpdateStatus.OK_WaitingForActivation
				) {
					message =
						'<p>The firmware must be activated <b>manually</b>, likely by pushing a button on the device.</p>'
				} else if (
					result.status === FirmwareUpdateStatus.OK_RestartPending
				) {
					message = `<p>The device will now restart.${
						result.waitTime
							? ` This will take approximately <b>${result.waitTime}</b> seconds.`
							: ''
					}</p>`
				} else if (
					// status is OK_NoRestart
					result.waitTime &&
					!result.reInterview
				) {
					message = `<p>Please wait <b>${result.waitTime}</b> seconds before interacting with the device again.<p>`
				}

				if (result.reInterview) {
					if (result.waitTime) {
						message +=
							'<p>Afterwards the device will be <b>re-interviewed</b>.<p>'
					} else {
						message +=
							'<p>The device will now be <b>re-interviewed</b>.<p>'
					}

					message +=
						'<p>Wait until the interview is done before interacting with the device again.<p/>'
				}
			} else {
				switch (result.status) {
					case FirmwareUpdateStatus.Error_Timeout:
						message =
							'There was a timeout during the firmware update.'
						break
					case FirmwareUpdateStatus.Error_Checksum:
						message = 'Invalid checksum'
						break
					case FirmwareUpdateStatus.Error_TransmissionFailed:
						message = 'The transmission failed or was aborted'
						break
					case FirmwareUpdateStatus.Error_InvalidManufacturerID:
						message = 'The manufacturer ID is invalid'
						break
					case FirmwareUpdateStatus.Error_InvalidFirmwareID:
						message = 'The firmware ID is invalid'
						break
					case FirmwareUpdateStatus.Error_InvalidFirmwareTarget:
						message = 'The firmware target is invalid'
						break
					case FirmwareUpdateStatus.Error_InvalidHeaderInformation:
					case FirmwareUpdateStatus.Error_InvalidHeaderFormat:
						message = 'The firmware header is invalid'
						break
					case FirmwareUpdateStatus.Error_InsufficientMemory:
						message =
							'The device does not have enough memory to perform the firmware update'
						break
					case FirmwareUpdateStatus.Error_InvalidHardwareVersion:
						message = 'The hardware version is invalid'
						break
				}
			}

			this.confirm(title, message, 'info', {
				confirmText: 'Ok',
				noCancel: true,
				color: result.success ? 'success' : 'error',
			})
		},
		async getRelease(project, version) {
			try {
				const response = await fetch(
					`https://api.github.com/repos/zwave-js/${project}/releases/${
						version === 'latest' ? 'latest' : 'tags/' + version
					}`,
				)
				const data = await response.json()
				return data
			} catch (error) {
				log.error(error)
			}
		},
		async getChangelogs(project, prevTag, nextTag, parseChangelog) {
			const changelogs = []

			try {
				const response = await fetch(
					`https://api.github.com/repos/zwave-js/${project}/releases`,
				)
				const data = await response.json()

				let start = false
				let maxParse = 10

				for (const release of data) {
					if (release.tag_name === prevTag) {
						break
					}

					if (release.tag_name === nextTag) {
						start = true
					}

					if (!start) continue

					if (release.draft || release.prerelease) continue

					changelogs.push(parseChangelog(release, changelogs.length))

					if (--maxParse === 0) break

					// if last version is not defined just print the last
					if (!prevTag) break
				}
			} catch (error) {
				log.error(error)
			}

			return changelogs
		},
		async checkChangelog() {
			const settings = useBaseStore().gateway

			const versions = settings?.versions
			// get changelog from github latest release
			try {
				const latest = await this.getRelease('zwave-js-ui', 'latest')

				if (!latest?.tag_name) return
				const currentVersion = import.meta.env.VITE_VERSION
				const latestVersion = latest.tag_name.replace('v', '')

				if (
					latestVersion !== currentVersion &&
					settings.notifyNewVersions
				) {
					this.showSnackbar(
						`New version available: ${latest.tag_name}`,
						'info',
						15000,
					)
				}

				if (settings?.disableChangelog) return

				const { default: md } = await import('markdown-it')

				if (versions?.app !== currentVersion) {
					const appChangelogs = await this.getChangelogs(
						'zwave-js-ui',
						versions?.app ? 'v' + versions?.app : null,
						'v' + currentVersion,
						(release, i) => {
							release.body = release.body.replace(
								new RegExp(
									`#+ \\[${release.tag_name.replace(
										'v',
										'',
									)}\\]\\([^\\)]+\\)`,
									'g',
								),
								`${i === 0 ? '# UI\n---\n' : ''}## [${
									release.tag_name
								}](https://github.com/zwave-js/zwave-js-ui/releases/tag/${
									release.tag_name
								})`,
							)

							let changelog = md()
								.render(release.body)
								.replace('</h2>', '</h2></br>')

							if (i === 0) {
								changelog = changelog.replace(
									'<h2>',
									'</br><h2>',
								)
							}

							return changelog
						},
					)

					let changelog = appChangelogs.join('</br>')

					if (this.appInfo.zwaveVersion !== versions?.driver) {
						const driverChangelogs = await this.getChangelogs(
							'node-zwave-js',
							versions?.driver ? 'v' + versions?.driver : null,
							'v' + this.appInfo.zwaveVersion,
							(release, i) => {
								const changelog = md()
									.render(release.body)
									.replace(
										/#(\d+)/g,
										'<a target="_blank" href="https://github.com/zwave-js/node-zwave-js/pull/$1">#$1</a>',
									)

								return `${
									i === 0
										? '</br><h1>Driver</h1><hr><br>'
										: ''
								}<h2><a target="_blank" href="https://github.com/zwave-js/node-zwave-js/releases/tag/${
									release.tag_name
								}">${
									release.tag_name
								}</a></h2></br>${changelog}</br>`
							},
						)

						changelog += driverChangelogs.join('')
					}

					if (this.appInfo.serverVersion !== versions?.server) {
						const serverChangelogs = await this.getChangelogs(
							'zwave-js-server',
							versions?.server || null,
							this.appInfo.serverVersion,
							(release, i) => {
								let changelog = md()
									.render(release.body)
									.replace(
										"<h2>What's Changed</h2>",
										'<h3>Changes</h3>',
									)
									.replace(
										/#(\d+)/g,
										'<a target="_blank" href="https://github.com/zwave-js/zwave-js-server/pull/$1">#$1</a>',
									)

								// remove everything after "⬆️ Dependencies"
								changelog = changelog.substr(
									0,
									changelog.indexOf('⬆️ Dependencies') - 1,
								)

								return `${
									i === 0
										? '</br><h1>Server</h1><hr><br>'
										: ''
								}<h2><a target="_blank" href="https://github.com/zwave-js/zwave-js-server/releases/tag/${
									release.tag_name
								}">v${
									release.tag_name
								}</a></h2></br>${changelog}</br>`
							},
						)

						changelog += serverChangelogs.join('')
					}

					// ensure all links are opened in new tab
					changelog = changelog.replace(
						/<a href="/g,
						'<a target="_blank" href="',
					)

					// downgrades could create empty changelogs
					if (!changelog.trim()) return

					// means we never saw the changelog for this version
					const result = await this.confirm(
						`Changelog`,
						`<div style="line-height: 1.5rem">${changelog}</div>`,
						'info',
						{
							width: 1000,
							cancelText: '',
							confirmText: 'OK',
							persistent: true,
							inputs: [
								{
									type: 'checkbox',
									label: 'Disable changelogs',
									key: 'dontShowAgain',
									hint: 'Enable this to never show changelogs on next updates',
								},
							],
						},
					)

					await ConfigApis.updateVersions(result?.dontShowAgain)
				}
			} catch (error) {
				log.error(error)
			}
		},
		updateSystemDark(update) {
			this.systemDark = update.matches
		},
		updateDarkMode(value) {
			// Set to system defualt if null
			this.$vuetify.theme.dark =
				value === null ? this.systemDark : !!value
		},
	},
	beforeMount() {
		manager.register(instances.APP, this)
		this.title = this.$route.name || ''
		this.checkAuth()
	},
	mounted() {
		if (this.$vuetify.breakpoint.lg || this.$vuetify.breakpoint.xl) {
			this.toggleDrawer()
		}

		if (window.location.hash.includes('#no-topbar')) {
			this.hideTopbar = true
		}

		const settings = useBaseStore().settings

		// Event listener to capture system dark changes.
		if (this.mq_system_dark === null && window) {
			this.mq_system_dark = window.matchMedia(
				'(prefers-color-scheme: dark)',
			)
			this.mq_system_dark.addEventListener(
				'change',
				this.updateSystemDark,
			)
		}

		// pre-load System Dark
		this.updateSystemDark(this.mq_system_dark)

		// load the theme from localstorage
		// this is needed to prevent the theme switch on load
		// this will be overriden by settings value once `initSettings`
		// base store method is called
		this.updateDarkMode(settings.load('dark', null))

		useBaseStore().$onAction(({ name, args }) => {
			if (name === 'showSnackbar') {
				this.showSnackbar(...args)
			} else if (name === 'initSettings') {
				// check if auth is changed in settings
				this.checkAuth()
			}
		})
	},
	beforeUnmount() {
		if (this.mq_system_dark !== null) {
			this.mq_system_dark.removeEventListener(
				'change',
				this.updateSystemDark,
			)
		}
	},
	beforeDestroy() {
		if (this.socket) this.socket.close()
	},
}
</script>

<style scoped>
.v-tabs :deep(.smaller-min-width-tabs) {
	min-width: 60px;
}

:deep(.v-snack) {
	top: 65px;
}
</style>
