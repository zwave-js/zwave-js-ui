<template>
	<v-app :dark="darkMode">
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
								:src="assetPath('/static/logo.png')"
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
							<v-icon>{{ item.icon }}</v-icon>
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

				<v-tooltip v-if="appInfo.controllerStatus" bottom>
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

				<v-tooltip bottom open-on-click>
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
				<router-view
					style="padding-bottom: 40px"
					v-if="auth !== undefined"
					@import="importFile"
					@export="exportConfiguration"
					@showConfirm="confirm"
					:socket="socket"
				/>
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
						<a href="https://github.com/sponsors/robertsLando"
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
					style="margin-bottom: 0; white-space: pre-line"
					v-text="
						typeof message === 'object' ? message.text : message
					"
				></p>
			</template>
			<template v-slot:action="{ close }">
				<v-btn text @click="close">Close</v-btn>
			</template>
		</v-snackbars>
	</v-app>
</template>

<style>
.controller-status {
	color: #555;
	background: #e0e0e0;
	border-radius: 4px;
	padding: 0.3rem 0;
	font-size: 0.8rem;
	min-width: 220px;
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
import Confirm from '@/components/Confirm'
import PasswordDialog from '@/components/dialogs/Password'
import LoaderDialog from '@/components/dialogs/DialogLoader'

import { Routes } from '@/router'

import { mapActions, mapState } from 'pinia'
import useBaseStore from './stores/base.js'
import { manager, instances } from './lib/instanceManager'

import {
	socketEvents,
	inboundEvents as socketActions,
} from '@/../server/lib/SocketEvents'

let socketQueue = []

export default {
	components: {
		PasswordDialog,
		LoaderDialog,
		VSnackbars,
		Confirm,
	},
	name: 'app',
	computed: {
		...mapState(useBaseStore, [
			'user',
			'auth',
			'appInfo',
			'nodesManagerOpen',
			'controllerNode',
		]),
		...mapState(useBaseStore, {
			darkMode: (store) => store.ui.darkMode,
			navTabs: (store) => store.ui.navTabs,
		}),
		updateAvailable() {
			return this.appInfo.newConfigVersion ? 1 : 0
		},
	},
	watch: {
		$route: function (value) {
			this.title = value.name || ''
			this.startSocket()
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

				useBaseStore().initNode({
					id: node.id,
					firmwareUpdateResult: false,
				})

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
			pages: [
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
				{ icon: 'settings', title: 'Settings', path: Routes.settings },
				{ icon: 'movie_filter', title: 'Scenes', path: Routes.scenes },
				{ icon: 'bug_report', title: 'Debug', path: Routes.debug },
				{ icon: 'folder', title: 'Store', path: Routes.store },
				{ icon: 'share', title: 'Network graph', path: Routes.mesh },
			],
			status: '',
			statusColor: '',
			drawer: false,
			mini: false,
			topbar: [],
			hideTopbar: false,
			title: '',
			messages: [],
		}
	},
	methods: {
		assetPath(path) {
			return ConfigApis.getBasePath(path)
		},
		...mapActions(useBaseStore, [
			'init',
			'initNodes',
			'setAppInfo',
			'setUser',
			'updateValue',
			'removeValue',
			'setControllerStatus',
			'setStatistics',
			'addNodeEvent',
			'initNode',
			'removeNode',
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
					response.success ? 'success' : 'error'
				)
				if (response.success) {
					this.closePasswordDialog()
					this.setUser(response.user)
				}
			} catch (error) {
				this.showSnackbar(
					'Error while updating password, check console for more info',
					'error'
				)
				console.log(error)
			}
		},
		closePasswordDialog() {
			this.dialog_password = false
		},
		showPasswordDialog() {
			this.password = {}
			this.dialog_password = true
		},
		async onNodeAdded({ node }) {
			if (!this.nodesManagerOpen) {
				await this.confirm(
					'Node added',
					`<div class="d-flex flex-column align-center col">
					<i aria-hidden="true" class="v-icon notranslate material-icons theme--light success--text" style="font-size: 60px;">check_circle</i>
					<p class="mt-3 headline text-center">
						Node ${node.id} added with security "${node.security || 'None'}"
					</p>
				</div>`,
					'info',
					{
						width: 500,
						confirmText: 'Close',
						cancelText: '',
					}
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
			options = { infoSnack: true, errorSnack: true }
		) {
			return new Promise((resolve) => {
				if (this.socket.connected) {
					if (options.infoSnack) {
						this.showSnackbar(`API ${apiName} called`, 'info')
					}
					const data = {
						api: apiName,
						args: args,
					}
					this.socket.emit(socketActions.zwave, data, (response) => {
						if (options.errorSnack && !response.success) {
							this.showSnackbar(
								`Error while calling ${apiName}: ${response.message}`,
								'error'
							)
						}
						resolve(response)
					})
				} else {
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
				}
			)

			if (result) {
				this.apiRequest(
					newVersion
						? 'installConfigUpdate'
						: 'checkForConfigUpdates',
					[]
				)

				this.showSnackbar(
					newVersion ? 'Installation started' : 'Check requested'
				)
			}
		},
		changeThemeColor: function () {
			const metaThemeColor = document.querySelector(
				'meta[name=theme-color]'
			)
			const metaThemeColor2 = document.querySelector(
				'meta[name=msapplication-TileColor]'
			)

			metaThemeColor.setAttribute(
				'content',
				this.darkMode ? '#000' : '#fff'
			)
			metaThemeColor2.setAttribute(
				'content',
				this.darkMode ? '#000' : '#fff'
			)
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
												'error'
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
								}
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
						'error'
					)
				} else {
					this.init(data)

					if (data.deprecationWarning) {
						await this.confirm(
							'Z-Wave JS UI',
							`<h3 style="white-space:pre" class="text-center">If you are seeing this message it means that you are using the old <code>zwavejs2mqtt</code> docker tag.\nStarting from 8.0.0 version it is <b>DEPRECATED</b>, please use the new <code>zwave-js-ui</code> tag.</h3>
						<p class="mt-4 text-center">
						You can find more info about this change in <a href="https://github.com/zwave-js/zwavejs2mqtt/releases/tag/v8.0.0" target="_blank">v8.0.0 CHANGELOG</a>.
						</p>`,
							'info',
							{
								width: 1000,
								noCancel: true,
								confirmText: 'Got it',
								persistent: true,
							}
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
							}
						)

						const data = await ConfigApis.updateStats(result)

						if (data.success) {
							this.showSnackbar(
								`Statistics are ${
									data.enabled ? 'enabled' : 'disabled'
								}`
							)
						} else {
							throw Error(data.message)
						}
					}
				}
			} catch (error) {
				this.showSnackbar(error.message, 'error')
				console.log(error)
			}
		},
		onInit(data) {
			this.setAppInfo(data.info)
			this.setControllerStatus({
				error: data.error,
				status: data.cntStatus,
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
				path: ConfigApis.getSocketPath(),
				query: query,
			})

			this.socket.on('connect', () => {
				this.updateStatus('Connected', 'green')
				this.socket.emit(
					socketActions.init,
					true,
					this.onInit.bind(this)
				)

				if (socketQueue.length > 0) {
					socketQueue.forEach((item) => {
						this.apiRequest(
							item.apiName,
							item.args,
							item.options
						).then(item.resolve)
					})
					socketQueue = []
				}
			})

			this.socket.on('disconnect', () => {
				this.updateStatus('Disconnected', 'red')
			})

			this.socket.on('error', () => {
				console.log('Socket error')
			})

			this.socket.on('reconnecting', () => {
				this.updateStatus('Reconnecting', 'yellow')
			})

			this.socket.on(socketEvents.init, this.onInit.bind(this))

			this.socket.on(socketEvents.info, this.setAppInfo.bind(this))

			this.socket.on(socketEvents.connected, this.setAppInfo.bind(this))
			this.socket.on(
				socketEvents.controller,
				this.setControllerStatus.bind(this)
			)

			this.socket.on(socketEvents.nodeUpdated, this.initNode.bind(this))
			this.socket.on(socketEvents.nodeRemoved, this.removeNode.bind(this))
			this.socket.on(socketEvents.nodeAdded, this.onNodeAdded.bind(this))

			this.socket.on(
				socketEvents.valueRemoved,
				this.removeValue.bind(this)
			)
			this.socket.on(
				socketEvents.valueUpdated,
				this.updateValue.bind(this)
			)

			this.socket.on(
				socketEvents.statistics,
				this.setStatistics.bind(this)
			)

			this.socket.on(socketEvents.nodeEvent, this.addNodeEvent.bind(this))

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
						data.message || 'Error while checking authorizations'
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
							localStorage.getItem('nextUrl') || Routes.main
						)
						localStorage.removeItem('nextUrl')
					}
					this.startSocket()
				}
			} catch (error) {
				setTimeout(() => (this.error = error.message), 1000)
				console.log(error)
			}
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

		const hash = window.location.hash.substr(1)

		if (hash === 'no-topbar') {
			this.hideTopbar = true
		}

		this.$vuetify.theme.dark = this.darkMode

		this.changeThemeColor()

		useBaseStore().$onAction(({ name, args }) => {
			if (name === 'showSnackbar') {
				this.showSnackbar(...args)
			} else if (name === 'initSettings') {
				// check if auth is changed in settings
				this.checkAuth()
			}
		})
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
