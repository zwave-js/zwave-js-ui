import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

self.addEventListener('fetch', (event) => {
	event.respondWith(
		(async () => {
			// Get the request
			const request = event.request.clone()

			// Check if the request has the X-External-Path header
			const externalPath = '/zwave' //request.headers.get('X-External-Path')

			if (externalPath) {
				// Modify the request URL to include the external path
				const modifiedURL = new URL(request.url)
				modifiedURL.pathname = externalPath + modifiedURL.pathname

				// Create a new request with the modified URL
				const modifiedRequest = new Request(modifiedURL, {
					method: request.method,
					headers: request.headers,
					mode: request.mode,
					credentials: request.credentials,
					redirect: request.redirect,
					referrer: request.referrer,
					referrerPolicy: request.referrerPolicy,
					integrity: request.integrity,
				})

				// Fetch the modified request
				const response = await fetch(modifiedRequest)

				// Return the response
				return response
			}

			// If no X-External-Path header is present, proceed with the original request
			return fetch(request)
		})()
	)
})
