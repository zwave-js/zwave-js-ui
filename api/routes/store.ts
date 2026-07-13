import type { Request, RequestHandler, Response } from 'express'
import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import multer, { diskStorage } from 'multer'
import extract from 'extract-zip'
import archiver from 'archiver'
import path from 'node:path'
import {
	readFile,
	realpath,
	readdir,
	rm,
	rename,
	writeFile,
	lstat,
	mkdir,
	mkdtemp,
	cp,
} from 'node:fs/promises'
import jsonStore from '../lib/jsonStore.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { storeDir, tmpDir } from '../config/app.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

const logger = loggers.module('App')

interface StoreFileEntry {
	children?: StoreFileEntry[]
	name: string
	path: string
	ext?: string
	size?: string
	isRoot?: boolean
}

// Sort children folders first and files after
function sortStore(store: StoreFileEntry[]) {
	return store.sort((a, b) => {
		if (a.children && !b.children) {
			return -1
		}
		if (!a.children && b.children) {
			return 1
		}
		return 0
	})
}

async function parseDir(dir: string): Promise<StoreFileEntry[]> {
	const toReturn = []
	const files = await readdir(dir)
	for (const file of files) {
		try {
			const entry: StoreFileEntry = {
				name: path.basename(file),
				path: utils.joinPath(dir, file),
			}
			const stats = await lstat(entry.path)
			if (stats.isDirectory()) {
				if (entry.path === process.env.ZWAVEJS_EXTERNAL_CONFIG) {
					// hide config-db
					continue
				}
				entry.children = []
				sortStore(entry.children)
			} else {
				entry.ext = file.split('.').pop()
			}

			entry.size = utils.humanSize(stats.size)
			toReturn.push(entry)
		} catch (error) {
			logger.error(`Error while parsing ${file} in ${dir}`, error)
		}
	}

	sortStore(toReturn)

	return toReturn
}

// Throws if the resolved path escapes storeDir
async function getSafePath(req: Request | string, resolveReal = true) {
	const reqPath = typeof req === 'string' ? req : req.query.path
	return utils.resolveSafeStorePath(reqPath, storeDir, resolveReal)
}

function multerPromise(
	m: RequestHandler,
	req: Request,
	res: Response,
): Promise<void> {
	return new Promise((resolve, reject) => {
		m(req, res, (err: any) => {
			if (err) {
				reject(err as Error)
			} else {
				resolve()
			}
		})
	})
}

const Storage = diskStorage({
	async destination(reqD, file, callback) {
		await utils.ensureDir(tmpDir)
		callback(null, tmpDir)
	},
	filename(reqF, file, callback) {
		callback(null, file.originalname)
	},
})

const multerUpload = multer({
	storage: Storage,
}).array('upload', 1)

export interface StoreRoutesDeps {
	apisLimiter: RateLimitRequestHandler
	storeLimiter: RateLimitRequestHandler
}

export function registerStoreRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter, storeLimiter }: StoreRoutesDeps,
): void {
	app.get(
		'/api/store',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				let data: StoreFileEntry[] | string
				if (req.query.path) {
					const reqPath = await getSafePath(req)
					// lgtm [js/path-injection]
					let stat = await lstat(reqPath)

					// check symlink is secure
					if (stat.isSymbolicLink()) {
						const realPath = await realpath(reqPath)
						await getSafePath(realPath)
						stat = await lstat(realPath)
					}

					if (stat.isFile()) {
						// lgtm [js/path-injection]
						data = await readFile(reqPath, 'utf8')
					} else {
						// lgtm [js/path-injection]
						data = await parseDir(reqPath)
					}
				} else {
					data = [
						{
							name: 'store',
							path: storeDir,
							isRoot: true,
							children: await parseDir(storeDir),
						},
					]
				}

				res.json({ success: true, data: data })
			} catch (error) {
				logger.error(getErrorMessage(error))
				return res.json({
					success: false,
					message: getErrorMessage(error),
				})
			}
		},
	)

	app.put(
		'/api/store',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const reqPath = await getSafePath(req)

				const isNew = req.query.isNew === 'true'
				const isDirectory = req.query.isDirectory === 'true'

				if (!isNew) {
					// lgtm [js/path-injection]
					const stat = await lstat(reqPath)

					if (!stat.isFile()) {
						throw Error('Path is not a file')
					}
				}

				if (!isDirectory) {
					// lgtm [js/path-injection]
					await writeFile(reqPath, req.body.content, 'utf8')
				} else {
					// lgtm [js/path-injection]
					await mkdir(reqPath)
				}

				res.json({ success: true })
			} catch (error) {
				logger.error(getErrorMessage(error))
				return res.json({
					success: false,
					message: getErrorMessage(error),
				})
			}
		},
	)

	app.delete(
		'/api/store',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const reqPath = await getSafePath(req)

				// lgtm [js/path-injection]
				await rm(reqPath, { recursive: true, force: true })

				res.json({ success: true })
			} catch (error) {
				logger.error(getErrorMessage(error))
				return res.json({
					success: false,
					message: getErrorMessage(error),
				})
			}
		},
	)

	app.put(
		'/api/store-multi',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const files = req.body.files || []
				for (const f of files) {
					await rm(await getSafePath(f), {
						recursive: true,
						force: true,
					})
				}
				res.json({ success: true })
			} catch (error) {
				logger.error(getErrorMessage(error))
				return res.json({
					success: false,
					message: getErrorMessage(error),
				})
			}
		},
	)

	app.post(
		'/api/store-multi',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			const files = req.body.files || []

			const archive = archiver('zip')

			archive.on('error', function (err: NodeJS.ErrnoException) {
				res.status(500).send({
					error: getErrorMessage(err),
				})
			})

			archive.on('end', function () {
				logger.debug('zip archive ready')
			})

			res.attachment('zwave-js-ui-store.zip')
			res.setHeader('Content-Type', 'application/zip')

			// Pipes directly to res to avoid staging a temp file
			archive.pipe(res)

			for (const f of files) {
				try {
					// confine the path to the store *before* touching the
					// filesystem, so unsafe paths can't be probed via lstat/realpath
					const safe = await getSafePath(f)
					const s = await lstat(safe)
					const name = safe.replace(storeDir, '')
					if (s.isFile()) {
						archive.file(safe, { name })
					} else if (s.isSymbolicLink()) {
						// getSafePath already resolved the link target and checked
						// it stays in the store; add the dereferenced target
						const targetPath = await realpath(safe)
						archive.file(targetPath, { name })
					}
				} catch (e) {
					// ignore unsafe or unreadable entries
				}
			}

			await archive.finalize()
		},
	)

	app.get(
		'/api/store/backup',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				await jsonStore.backup(res)
			} catch (error) {
				res.status(500).send({
					error: getErrorMessage(error),
				})
			}
		},
	)

	app.post(
		'/api/store/upload',
		storeLimiter,
		isAuthenticated,
		async function (req, res) {
			let file: any
			let isRestore = false
			try {
				await multerPromise(multerUpload, req, res)

				isRestore = req.body.restore === 'true'
				const folder = req.body.folder

				// Optional chaining: a non-multipart request has no req.files array at all, which falls through to the same "No file uploaded" error below
				file = (req.files as Express.Multer.File[] | undefined)?.[0]

				if (!file || !file.path) {
					throw Error('No file uploaded')
				}

				if (isRestore) {
					// Stage, reject symlinks escaping the store, then merge in
					const stageDir = await mkdtemp(
						path.join(storeDir, '.restore-'),
					)
					try {
						await extract(file.path, { dir: stageDir })
						await utils.assertNoEscapingSymlinks(stageDir, stageDir)
						await cp(stageDir, storeDir, {
							recursive: true,
							// Keep in-store links (e.g. *_current.log) as links rather than copying their targets
							verbatimSymlinks: true,
						})
					} finally {
						await rm(stageDir, { recursive: true, force: true })
					}
				} else {
					const destinationPath = await getSafePath(
						path.join(storeDir, folder, file.originalname),
					)
					await rename(file.path, destinationPath)
				}

				res.json({ success: true })
			} catch (err) {
				res.json({ success: false, message: getErrorMessage(err) })
			}

			if (file && isRestore) {
				await rm(file.path)
			}
		},
	)

	app.get(
		'/api/snippet',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const snippets = await runtime.getSnippets()
				res.json({ success: true, data: snippets })
			} catch (err) {
				res.json({ success: false, message: getErrorMessage(err) })
			}
		},
	)
}
