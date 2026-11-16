// The /api/floorplans routes, mounted by app.ts

import type { Request, RequestHandler, Response, Router } from 'express'
import express from 'express'
import rateLimit from 'express-rate-limit'
import multer, { memoryStorage } from 'multer'
import { promisify } from 'node:util'
import floorPlans, {
	InputError,
	MAX_IMAGE_BYTES,
	MAX_IMAGE_MB,
	STRETCH_TOLERANCE,
} from '../lib/FloorPlans.ts'
import { module } from '../lib/logger.ts'
import { isTrustedRequest } from '../lib/trustedListener.ts'

const logger = module('FloorPlans')

// Own budget, not the shared /api one: editing sends a request per drag and
// per pan or zoom, and the map loads every picture through these routes
const limiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 5000,
	skip: (req: Request) => isTrustedRequest(req),
	handler: function (req, res) {
		res.json({ success: false, message: 'Max requests limit reached' })
	},
})

// background images are kept in memory: they are sniffed and size checked
// before anything is written to the store
const receiveImage = promisify(
	multer({
		storage: memoryStorage(),
		limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
	}).single('upload'),
) as (req: Request, res: Response) => Promise<void>

export default function floorPlansRouter(
	isAuthenticated: RequestHandler,
): Router {
	const router = express.Router()
	router.use(limiter, isAuthenticated)

	/** Run a floorplans handler and reply with the usual `{ success, data }` shape */
	function floorPlansRoute(
		handler: (req: Request, res: Response) => Promise<unknown>,
	) {
		return async function (req: Request, res: Response) {
			try {
				res.json({ success: true, data: await handler(req, res) })
			} catch (error) {
				const where = `Floorplans ${req.method} ${req.path}:`
				// refused input is the caller's problem; a storage fault keeps its
				// stack (winston adds the error's message after `where`)
				if (error instanceof InputError) {
					logger.warn(`${where} ${error.message}`)
				} else logger.error(where, error)
				res.json({ success: false, message: error.message })
			}
		}
	}

	// the floorplans as `data` (the shape of maps.json), and next to it the
	// limits the UI checks before uploading
	router.get('/', async function (req, res) {
		try {
			res.json({
				success: true,
				data: await floorPlans.load(),
				limits: {
					maxImageBytes: MAX_IMAGE_BYTES,
					maxImageMb: MAX_IMAGE_MB,
					stretchTolerance: STRETCH_TOLERANCE,
				},
			})
		} catch (error) {
			logger.error('Floorplans GET /api/floorplans:', error)
			res.json({ success: false, message: error.message })
		}
	})

	router.patch(
		'/settings',
		floorPlansRoute((req) => floorPlans.updateSettings(req.body ?? {})),
	)

	router.post(
		'/maps',
		floorPlansRoute((req) => floorPlans.addMap(req.body ?? {})),
	)

	router.patch(
		'/maps/:id',
		floorPlansRoute((req) => floorPlans.updateMap(req.params.id, req.body)),
	)

	router.delete(
		'/maps/:id',
		floorPlansRoute((req) => floorPlans.deleteMap(req.params.id)),
	)

	// multipart: `upload` file, `dark=true` for the dark theme picture, `fit`
	// (see FloorPlans.setMapImage), and the browser-decoded
	// `imgWidthPx`/`imgHeightPx`, used if the header can't be read
	router.put(
		'/maps/:id/image',
		floorPlansRoute(async (req, res) => {
			try {
				await receiveImage(req, res)
			} catch (error) {
				if (error.code === 'LIMIT_FILE_SIZE') {
					throw new InputError(
						`Image is larger than ${MAX_IMAGE_MB} MB`,
					)
				}
				if (error.name === 'MulterError') {
					throw new InputError(error.message)
				}
				throw error
			}
			if (!req.file) throw new InputError('No file uploaded')
			return floorPlans.setMapImage(req.params.id, {
				bytes: req.file.buffer,
				imgWidthPx: Number(req.body.imgWidthPx),
				imgHeightPx: Number(req.body.imgHeightPx),
				dark: req.body.dark === 'true',
				fit: req.body.fit || undefined,
			})
		}),
	)

	// ?dark=true removes the dark theme picture, otherwise the light one
	router.delete(
		'/maps/:id/image',
		floorPlansRoute((req) =>
			floorPlans.removeMapImage(req.params.id, {
				dark: req.query.dark === 'true',
			}),
		),
	)

	// body: { placements: [{ deviceKey, x, y }, ...] }, placed in one write
	router.put(
		'/maps/:id/placements',
		floorPlansRoute((req) =>
			floorPlans.setPlacements(req.params.id, req.body?.placements),
		),
	)

	router.delete(
		'/maps/:id/placements/:deviceKey',
		floorPlansRoute((req) =>
			floorPlans.removePlacement(req.params.id, req.params.deviceKey),
		),
	)

	// Background image file. Served by file name: the dot keeps the history
	// fallback from rewriting browser image requests (Accept: */*), and a
	// replaced image always gets a new name, so it can be cached. Only files a
	// map references are served.

	router.get('/images/:file', async function (req, res) {
		const notFound = () =>
			res.status(404).json({ success: false, message: 'No such image' })
		try {
			const { maps } = await floorPlans.load()
			const file = req.params.file
			const owned = maps.some(
				(m) =>
					m.background?.image === file ||
					m.background?.darkImage === file,
			)
			if (!owned) return notFound()
			res.set({
				'Cache-Control': 'private, max-age=31536000, immutable',
				'X-Content-Type-Options': 'nosniff',
			})
			// referenced but missing on disk only if someone deleted it: the
			// UI doesn't ask for it again until the page is reloaded
			res.sendFile(file, { root: floorPlans.imagesDir }, (err) => {
				if (err && !res.headersSent) {
					logger.warn(`Floorplan image ${file}: ${err.message}`)
					notFound()
				}
			})
		} catch (error) {
			logger.error(`Floorplan image ${req.params.file}:`, error)
			res.status(500).json({ success: false, message: error.message })
		}
	})

	return router
}
