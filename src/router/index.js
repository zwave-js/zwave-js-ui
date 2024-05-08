import Vue from 'vue'
import Router from 'vue-router'

// DON'T use lazy loading here, it would break application running behind a proxy
const ControlPanel = () => import('@/views/ControlPanel.vue')
const Settings = () => import('@/views/Settings.vue')
const Mesh = () => import('@/views/Mesh.vue')
const Store = () => import('@/views/Store.vue')
const Scenes = () => import('@/views/Scenes.vue')
const Debug = () => import('@/views/Debug.vue')
const Login = () => import('@/views/Login.vue')
const ErrorPage = () => import('@/views/ErrorPage.vue')
const SmartStart = () => import('@/views/SmartStart.vue')
const ControllerChart = () => import('@/views/ControllerChart.vue')
const Zniffer = () => import('@/views/Zniffer.vue')

import ConfigApis from '../apis/ConfigApis'
import useBaseStore from '../stores/base'

Vue.use(Router)

export const Routes = {
	login: '/',
	error: '/error',
	controlPanel: '/control-panel',
	settings: '/settings',
	scenes: '/scenes',
	debug: '/debug',
	store: '/store',
	mesh: '/mesh',
	smartStart: '/smart-start',
	controllerChart: '/controller-chart',
	zniffer: '/zniffer',
}

Routes.main = Routes.controlPanel

const router = new Router({
	mode: 'hash',
	routes: [
		{
			path: Routes.login,
			name: 'Login',
			component: Login,
		},
		{
			path: Routes.error,
			name: 'Error',
			component: ErrorPage,
		},
		{
			path: Routes.controlPanel,
			name: 'Control Panel',
			component: ControlPanel,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.zniffer,
			name: 'Zniffer',
			component: Zniffer,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.smartStart,
			name: 'Smart Start',
			component: SmartStart,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.settings,
			name: 'Settings',
			component: Settings,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.scenes,
			name: 'Scenes',
			component: Scenes,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.debug,
			name: 'Debug',
			component: Debug,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.store,
			name: 'Store',
			component: Store,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.mesh,
			name: 'Network Graph',
			component: Mesh,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: Routes.controllerChart,
			name: 'Controller Chart',
			component: ControllerChart,
			props: true,
			meta: {
				requiresAuth: true,
			},
		},
	],
})

router.beforeEach(async (to, from, next) => {
	// no metching routes found
	if (to.matched.length === 0) {
		router.push({
			path: Routes.error,
			query: { code: 404, message: 'Not Found', path: to.path },
		})
		return
	}

	const store = useBaseStore()

	if (store.auth === undefined && to.path !== Routes.login) {
		localStorage.setItem('nextUrl', to.path)
	}

	if (store.auth === false) {
		if (to.path === Routes.login) {
			next({
				path: Routes.main,
			})
		} else {
			next()
		}
		return
	}

	// permissions required by the requested route
	const route = {
		auth: to.matched.some((record) => record.meta.requiresAuth),
	}

	let user = store.user
	let logged = !!localStorage.getItem('logged')

	if (!user || Object.keys(user).length === 0) {
		// check if there is a valid user in localstorage
		try {
			user = JSON.parse(localStorage.getItem('user'))
			if (user && logged) {
				// used found in local storage, login
				const response = await ConfigApis.login(user)
				if (!response.success) {
					logged = false
					localStorage.removeItem('logged')
				} else {
					store.onUserLogged(response.user)
				}
			} else user = {}
		} catch (error) {
			user = {}
		}
	}

	// permission of the user
	user.notLogged = Object.keys(user).length === 0 || !logged

	if (route.auth) {
		if (user.notLogged) {
			// user not logged redirect to login page
			next({
				path: Routes.login,
				params: { nextUrl: to.fullPath },
			})
		} else {
			// user logged, let it go
			next()
		}
	} else if (user.notLogged) {
		// doesn't require auth and user is not logged
		next()
	} else {
		// user is logged
		next({
			path: Routes.main,
			params: { nextUrl: to.fullPath },
		})
	}
})

export default router
