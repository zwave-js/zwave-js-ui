import { Request, Response } from 'express'
import { IncomingHttpHeaders } from 'http'
import { webConfig } from '../config/webConfig'
import { joinPath } from './utils'
import { readFileSync } from 'fs'

function basePath(config: Record<string, any>, headers: IncomingHttpHeaders) {
	return (headers['x-external-path'] || config.base).replace(/\/?$/, '/')
}

const indexPath = joinPath(false, './dist/index.html')

const content = readFileSync(indexPath, 'utf8')

let lastBase = '/'
let lastPatch = content

export default function (req: Request, res: Response) {
	const base = basePath(webConfig, req.headers)

	if (base !== lastBase) {
		lastBase = base
		lastPatch = content
			.replace(/href="\//g, `href="${lastBase}`)
			.replace(/src="\//g, `src="${lastBase}`)
			.replace('<head>', `<head>\n		<base href="${lastBase}" />`)
	}

	res.send(lastPatch)
}
