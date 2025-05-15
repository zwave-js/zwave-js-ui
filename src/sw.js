import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

import { clientsClaim } from 'workbox-core'

// const self =
// 	/** @type { Window & typeof globalThis & ServiceWorkerGlobalScope } */ (
// 		globalThis
// 	)

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

clientsClaim()
