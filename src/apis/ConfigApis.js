import axios from 'axios'
import loadProgressBar from '../lib/axios-progress-bar'
import Router from '../router'
import logger from '../lib/logger'
import { download, extractFileNameFromResponse } from '../lib/utils'

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
	async patch(...args) {
		log.debug('Request', ...args)
		const response = await axios.patch(...args)
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
	async getSerialPorts() {
		const response = await request.get('/serial-ports')
		return response.data
	},
	async updateConfig(data) {
		const response = await request.post('/settings', data)
		return response.data
	},
	async restartGateway() {
		const response = await request.post('/restart')
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
	backupStore(floorPlans = true) {
		return request.get('/store/backup', {
			responseType: 'blob',
			params: floorPlans ? {} : { floorPlans: false },
		})
	},
	async deleteMultiple(files) {
		const response = await request.put('/store-multi', { files })
		return response.data
	},
	async updateVersions(disableChangelog = false) {
		const response = await request.post('/versions', { disableChangelog })
		return response.data
	},
	// ---- DEBUG CAPTURE -----
	async getDebugStatus() {
		const response = await request.get('/debug/status')
		return response.data
	},
	async startDebugCapture(restartDriver = false) {
		const response = await request.post('/debug/start', { restartDriver })
		return response.data
	},
	async stopDebugCapture(nodeIds = []) {
		const response = await axios({
			method: 'post',
			url: '/debug/stop',
			data: { nodeIds },
			responseType: 'blob',
		})

		// try parsing response as json to check for errors
		try {
			const text = await response.data.text()
			const data = JSON.parse(text)
			// if we get here, the response was json and thus an error
			log.error('Error during debug capture:', data)
			throw new Error(
				data.message || 'An error occurred during debug capture',
			)
		} catch (error) {
			// only ignore json parse errors, rethrow everything else
			if (!(error instanceof SyntaxError)) {
				throw error
			}
		}

		// Trigger download
		const url = window.URL.createObjectURL(new Blob([response.data]))

		// Get filename from Content-Disposition header
		const fileName = extractFileNameFromResponse(
			response,
			`debug-capture_${new Date().toISOString()}.zip`,
		)

		download(url, fileName)

		return { success: true }
	},
	async cancelDebugCapture() {
		const response = await request.post('/debug/cancel')
		return response.data
	},
	// ---- CONFIGURATION TEMPLATES -----
	async getConfigurationTemplates() {
		const response = await request.get('/configuration-templates')
		return response.data
	},
	async createConfigurationTemplate(data) {
		const response = await request.post('/configuration-templates', data)
		return response.data
	},
	async updateConfigurationTemplate(id, data) {
		const response = await request.put(
			`/configuration-templates/${id}`,
			data,
		)
		return response.data
	},
	async deleteConfigurationTemplate(id) {
		const response = await request.delete(`/configuration-templates/${id}`)
		return response.data
	},
	async applyConfigurationTemplate(id, nodeId) {
		const response = await request.post(
			`/configuration-templates/${id}/apply`,
			{ nodeId },
		)
		return response.data
	},
	async exportConfigurationTemplates() {
		const response = await request.get('/configuration-templates/export')
		return response.data
	},
	async importConfigurationTemplates(data) {
		const response = await request.post('/configuration-templates/import', {
			data,
		})
		return response.data
	},
	async getDeviceConfigurationParams(deviceId) {
		const response = await request.get(
			`/configuration-templates/device-params/${deviceId}`,
		)
		return response.data
	},
	// ---- FLOORPLANS ------
	async getFloorPlans() {
		const response = await request.get('/floorplans')
		return response.data
	},
	async addFloorPlanMap(data) {
		const response = await request.post('/floorplans/maps', data)
		return response.data
	},
	async updateFloorPlanSettings(data) {
		const response = await request.patch('/floorplans/settings', data)
		return response.data
	},
	async updateFloorPlanMap(id, changes) {
		const response = await request.patch(`/floorplans/maps/${id}`, changes)
		return response.data
	},
	async deleteFloorPlanMap(id) {
		const response = await request.delete(`/floorplans/maps/${id}`)
		return response.data
	},
	/** `size` is the browser-decoded { width, height }, used if the server can't read it */
	async setFloorPlanImage(id, file, variant = 'light', size = null) {
		const form = new FormData()
		form.append('upload', file)
		form.append('variant', variant)
		if (size) {
			form.append('imgWidthPx', size.width)
			form.append('imgHeightPx', size.height)
		}
		const response = await request.put(`/floorplans/maps/${id}/image`, form)
		return response.data
	},
	/** variant 'dark' removes only the dark version, 'all' the background */
	async removeFloorPlanImage(id, variant = 'all') {
		const response = await request.delete(`/floorplans/maps/${id}/image`, {
			params: variant === 'dark' ? { variant } : {},
		})
		return response.data
	},
	async setFloorPlanPlacement(id, placement) {
		const response = await request.put(
			`/floorplans/maps/${id}/placements`,
			placement,
		)
		return response.data
	},
	/** several placements in one write */
	async setFloorPlanPlacements(id, placements) {
		const response = await request.put(
			`/floorplans/maps/${id}/placements`,
			{ placements },
		)
		return response.data
	},
	/** the export file of the given maps (all when empty) */
	async exportFloorPlans(mapIds = []) {
		const response = await request.get('/floorplans/export', {
			params: mapIds.length ? { maps: mapIds.join(',') } : {},
		})
		return response.data
	},
	/** upload an export file: proposed node matches and a token for commit */
	async previewFloorPlanImport(file) {
		const form = new FormData()
		form.append('upload', file)
		const response = await request.post('/floorplans/import/preview', form)
		return response.data
	},
	async commitFloorPlanImport(token, matches) {
		const response = await request.post('/floorplans/import/commit', {
			token,
			matches,
		})
		return response.data
	},
	async linkFloorPlanPlaceholder(id, placeholderId, deviceKey) {
		const response = await request.put(
			`/floorplans/maps/${id}/placeholders/${placeholderId}`,
			{ deviceKey },
		)
		return response.data
	},
	async removeFloorPlanPlaceholder(id, placeholderId) {
		const response = await request.delete(
			`/floorplans/maps/${id}/placeholders/${placeholderId}`,
		)
		return response.data
	},
	async removeFloorPlanPlacement(id, deviceKey) {
		const response = await request.delete(
			`/floorplans/maps/${id}/placements/${encodeURIComponent(deviceKey)}`,
		)
		return response.data
	},
	/** URL of a background image file, for <img> and map overlays */
	floorPlanImageUrl(file) {
		return `${axios.defaults.baseURL}/floorplans/images/${encodeURIComponent(file)}`
	},
}
