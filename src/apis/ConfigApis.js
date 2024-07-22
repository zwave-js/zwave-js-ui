import axios from 'axios'
import loadProgressBar from '../lib/axios-progress-bar'
import Router from '../router'
import logger from '../lib/logger'

const log = logger.get('ConfigApis')

axios.defaults.baseURL = `./api`

function responseHandler(response) {
	log.debug('Response', response)
	if (response.data && response.data.code === 3) {
		localStorage.removeItem('logged')
		Router.push('/')
		throw Error(response.message || 'Authentication failed')
	}

	return response
}

const request = {
	async get(...args) {
		log.debug('Request', ...args)
		const response = await axios.get(...args)
		return responseHandler(response)
	},
	async put(...args) {
		log.debug('Request', ...args)
		const response = await axios.put(...args)
		return responseHandler(response)
	},
	async post(...args) {
		log.debug('Request', ...args)
		const response = await axios.post(...args)
		return responseHandler(response)
	},
	async delete(...args) {
		log.debug('Request', ...args)
		const response = await axios.delete(...args)
		return responseHandler(response)
	},
}

loadProgressBar()

export default {
	// ---- LOGIN/LOGOUT ------
	async login(data) {
		const response = await request.post('/authenticate', data)
		return response.data
	},
	logout() {
		return request.get('/logout')
	},
	async isAuthEnabled() {
		// use fetch instead of axios here in order to catch
		// redirects and fix external auth:
		// https://github.com/zwave-js/zwave-js-ui/issues/3427
		// const response = await request.get('/auth-enabled')
		// return response.data

		const response = await fetch(axios.defaults.baseURL + '/auth-enabled', {
			credentials: 'include',
			redirect: 'manual',
			headers: {
				Accept: 'application/json',
			},
		})
		if (response.type === 'opaqueredirect' || response.status === 401) {
			throw new axios.AxiosError(
				'Caught redirect for auth-enabled, rethrowing',
				response.status,
				response.config,
				response.request,
				response,
			)
		}
		return await response.json()
	},
	// ---- USER ------
	async updatePassword(data) {
		const response = await request.put('/password', data)
		return response.data
	},
	// ---- CONFIG -----
	async getConfig() {
		const response = await request.get('/settings')
		return response.data
	},
	async updateConfig(data) {
		const response = await request.post('/settings', data)
		return response.data
	},
	async updateStats(enableStatistics) {
		const response = await request.post('/statistics', { enableStatistics })
		return response.data
	},
	async exportConfig() {
		const response = await request.get('/exportConfig')
		return response.data
	},
	async importConfig(data) {
		const response = await request.post('/importConfig', data)
		return response.data
	},
	async getStore() {
		const response = await request.get('/store')
		return response.data
	},
	async getSnippets() {
		const response = await request.get('/snippet')
		return response.data
	},
	async getFile(path) {
		const response = await request.get('/store', { params: { path } })
		return response.data
	},
	async writeFile(content, query) {
		const response = await request.put(
			'/store',
			{
				content,
			},
			{ params: query },
		)
		return response.data
	},
	async storeUpload(formData) {
		let response = await axios({
			method: 'post',
			url: '/store/upload',
			data: formData,
			headers: { 'Content-Type': 'multipart/form-data' },
		})
		response = responseHandler(response)
		return response.data
	},
	async deleteFile(path) {
		const response = await request.delete('/store', { params: { path } })
		return response.data
	},
	downloadZip(files) {
		return request.post('/store-multi', { files }, { responseType: 'blob' })
	},
	backupStore() {
		return request.get('/store/backup', { responseType: 'blob' })
	},
	async deleteMultiple(files) {
		const response = await request.put('/store-multi', { files })
		return response.data
	},
	async updateVersions(disableChangelog = false) {
		const response = await request.post('/versions', { disableChangelog })
		return response.data
	},
}
