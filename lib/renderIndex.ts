import { Request, Response } from 'express'
import { IncomingHttpHeaders } from 'http'
import { webConfig } from '../config/webConfig'

function basePath(config: Record<string, any>, headers: IncomingHttpHeaders) {
	return (headers['x-external-path'] || config.base).replace(/\/?$/, '/')
}

export default function (req: Request, res: Response) {
	const data = {
		config: {
			...webConfig,
			base: basePath(webConfig, req.headers),
		},
	}

	res.render('index.ejs', data)
}
