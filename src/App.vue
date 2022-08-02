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
								:src="`${baseURI}/static/logo.png`"
							/>
						</v-list-item-avatar>
						<v-list-item-content>
							<v-list-item-title>{{
								'ZWaveJS2MQTT'
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
							<small>Zwavejs2Mqtt</small>
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
					@apiRequest="apiRequest"
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
					class="text-center text-caption"
				>
					<v-col class="d-flex pa-0 justify-center text-caption">
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

		<v-snackbar
			:timeout="3000"
			:bottom="true"
			:multi-line="false"
			:vertical="false"
			v-model="snackbar"
		>
			{{ snackbarText }}
			<v-btn text @click="snackbar = false">Close</v-btn>
		</v-snackbar>
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
import ConfigApis from '@/apis/ConfigApis'
import Confirm from '@/components/Confirm'
import PasswordDialog from '@/components/dialogs/Password'
import { Routes } from '@/router'

import { mapActions, mapMutations, mapGetters } from 'vuex'

import {
	socketEvents,
	inboundEvents as socketActions,
} from '@/../server/lib/SocketEvents'

export default {
	components: {
		PasswordDialog,
		Confirm,
	},
	name: 'app',
	computed: {
		...mapGetters(['user', 'auth', 'appInfo', 'navTabs', 'darkMode']),
		updateAvailable() {
			return this.appInfo.newConfigVersion ? 1 : 0
		},
	},
	watch: {
		$route: function (value) {
			this.title = value.name || ''
			this.startSocket()
		},
	},
	data() {
		return {
			socket: null,
			error: false,
			dialog_password: false,
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
			snackbar: false,
			snackbarText: '',
			baseURI: ConfigApis.getBasePath(),
		}
	},
	methods: {
		...mapActions([
			'initNodes',
			'setAppInfo',
			'updateValue',
			'removeValue',
		]),
		...mapMutations([
			'setControllerStatus',
			'setStatistics',
			'addNodeEvent',
			'initNode',
			'removeNode',
		]),
		copyVersion() {
			const el = document.createElement('textarea')
			el.value = `zwavejs2mqtt: ${this.appInfo.appVersion}\nzwave-js: ${this.appInfo.zwaveVersion}\nhome id: ${this.appInfo.homeid}\nhome hex: ${this.appInfo.homeHex}`
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
				this.showSnackbar(response.message)
				if (response.success) {
					this.closePasswordDialog()
					this.$store.dispatch('setUser', response.user)
				}
			} catch (error) {
				this.showSnackbar(
					'Error while updating password, check console for more info'
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
		showSnackbar: function (text) {
			this.snackbarText = text
			this.snackbar = true
		},
		apiRequest(apiName, args) {
			if (this.socket.connected) {
				const data = {
					api: apiName,
					args: args,
				}
				this.socket.emit(socketActions.zwave, data)
			} else {
				this.showSnackbar('Socket disconnected')
			}
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
												'Error while parsing input file, check console for more info'
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
						'Error while retrieving configuration, check console'
					)
					console.log(data)
				} else {
					this.$store.dispatch('init', data)

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
				this.showSnackbar(error.message)
				console.log(error)
			}
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
				this.socket.emit(socketActions.init, true)
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

			this.socket.on(socketEvents.init, (data) => {
				// convert node values in array
				this.initNodes(data.nodes)
				this.setControllerStatus({
					error: data.error,
					status: data.cntStatus,
				})
				this.setAppInfo(data.info)
			})

			this.socket.on(socketEvents.info, (data) => {
				this.setAppInfo(data)
			})

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
					this.showSnackbar('Logged out')
				} catch (error) {
					this.showSnackbar('Logout failed')
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

					this.$store.dispatch('setAuth', newAuth)

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

		this.$store.subscribe((mutation) => {
			if (mutation.type === 'showSnackbar') {
				this.showSnackbar(mutation.payload)
			} else if (mutation.type === 'initSettings') {
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
.v-tabs >>> .smaller-min-width-tabs {
	min-width: 60px;
}
</style>
