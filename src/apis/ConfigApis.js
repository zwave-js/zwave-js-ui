import axios from 'axios'
import { loadProgressBar } from 'axios-progress-bar'
import Router from '../router'

function getBasePath(path) {
	return document.baseURI.replace(/\/$/, '') + (path || '')
}

axios.defaults.socketUrl = getBasePath()
axios.defaults.baseURL = `${axios.defaults.socketUrl}/api`

function responseHandler(response) {
	if (response.data && response.data.code === 3) {
		localStorage.removeItem('logged')
		Router.push('/')
		throw Error(response.message || 'Authentication failed')
	}

	return response
}

const request = {
	async get(...args) {
		const response = await axios.get(...args)
		return responseHandler(response)
	},
	async put(...args) {
		const response = await axios.put(...args)
		return responseHandler(response)
	},
	async post(...args) {
		const response = await axios.post(...args)
		return responseHandler(response)
	},
	async delete(...args) {
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
		const response = await request.get('/auth-enabled')
		return response.data
	},
	// ---- USER ------
	async updatePassword(data) {
		const response = await request.put('/password', data)
		return response.data
	},
	// ---- CONFIG -----
	getBasePath,
	getSocketPath() {
		const innerPath = document.baseURI.split('/').splice(3).join('/')
		const socketPath = `/${innerPath}/socket.io`.replace('//', '/')
		return socketPath === '/socket.io' ? undefined : socketPath
	},
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
			{ params: query }
		)
		return response.data
	},
	async restoreZip(formData) {
		let response = await axios({
			method: 'post',
			url: '/store/restore',
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
}
