import * as fs from 'fs'
import * as path from 'path'
import { Request, Response } from "express";
import { IncomingHttpHeaders } from 'http';


import * as webConfig from '../config/webConfig'

function findFiles (folder: string, ext: string) {
  const folderPath = path.join(__dirname, '..', 'dist', folder)
  const folderFiles = fs.readdirSync(folderPath)
  return folderFiles
    .filter(function (file) {
      return path.extname(file).toLowerCase() === `.${ext.toLowerCase()}`
    })
    .map(function (file) {
      return path.join(folder, file)
    })
}

let cssFiles: string[]
let jsFiles: string[]

function basePath (config: Record<string, any>, headers: IncomingHttpHeaders) {
  return (headers['x-external-path'] || config.base).replace(/\/?$/, '/')
}

export default function (req: Request, res: Response) {
  cssFiles = cssFiles || findFiles(path.join('static', 'css'), 'css')
  jsFiles = jsFiles || findFiles(path.join('static', 'js'), 'js')
  res.render('index.ejs', {
    config: {
      ...webConfig,
      base: basePath(webConfig, req.headers)
    },
    cssFiles,
    jsFiles
  })
}
