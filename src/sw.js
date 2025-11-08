import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// const self =
// 	/** @type { Window & typeof globalThis & ServiceWorkerGlobalScope } */ (
// 		globalThis
// 	)

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting()
	}
})

// Note: We don't call clientsClaim() automatically here.
// The service worker will take control only after skipWaiting() is called
// when the user confirms the update, and the page reloads.
