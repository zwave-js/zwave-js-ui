import 'nprogress/nprogress.css'
import NProgress from 'nprogress'
import axios from 'axios'

const calculatePercentage = (loaded, total) => Math.floor(loaded * 1.0) / total

export default function loadProgressBar(config, instance = axios) {
	let requestsCounter = 0

	const setupStartProgress = () => {
		instance.interceptors.request.use((c) => {
			requestsCounter++
			NProgress.start()
			return c
		})
	}

	const setupUpdateProgress = () => {
		const update = (e) => {
			const { loaded, total } = e

			// for some reason (maybe a race condition) seems we can get
			// events emitted even when request is already closed
			// fixes #3791
			if (requestsCounter === 0) {
				return
			}

			// sometimes `total` is undefined, in that case simply call `inc` without params
			if (loaded !== undefined && total !== undefined) {
				NProgress.set(calculatePercentage(loaded, total))
			} else {
				NProgress.inc()
			}
		}
		instance.defaults.onDownloadProgress = update
		instance.defaults.onUploadProgress = update
	}

	const setupStopProgress = () => {
		const responseFunc = (response) => {
			if (--requestsCounter === 0) {
				NProgress.done()
			}
			return response
		}

		const errorFunc = (error) => {
			if (--requestsCounter === 0) {
				NProgress.done()
			}
			return Promise.reject(error)
		}

		instance.interceptors.response.use(responseFunc, errorFunc)
	}

	NProgress.configure(config)
	setupStartProgress()
	setupUpdateProgress()
	setupStopProgress()
}
