import * as fs from 'fs'
import { joinPath } from './utils'
import { Request, Response } from 'express'
import { IncomingHttpHeaders } from 'http'
import { webConfig } from '../config/webConfig'
import { extname } from 'path'

function findFiles(folder: string, ext: string) {
	const folderPath = joinPath(false, 'dist', folder)
	const folderFiles = fs.readdirSync(folderPath)
	return folderFiles
		.filter(function (file) {
			return extname(file).toLowerCase() === `.${ext.toLowerCase()}`
		})
		.map(function (file) {
			return joinPath(folder, file)
		})
}

let cssFiles: string[] | undefined
let jsFiles: string[] | undefined

function basePath(config: Record<string, any>, headers: IncomingHttpHeaders) {
	return (headers['x-external-path'] || config.base).replace(/\/?$/, '/')
}

export function resetFiles() {
	cssFiles = undefined
	jsFiles = undefined
}

export default function (req: Request, res: Response) {
	cssFiles = cssFiles || findFiles('static/css', 'css')

	jsFiles = jsFiles || findFiles('static/js', 'js')
	res.render('index.ejs', {
		config: {
			...webConfig,
			base: basePath(webConfig, req.headers),
		},
		cssFiles,
		jsFiles,
	})
}
