import path from 'path'
import vue2 from '@vitejs/plugin-vue2'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import * as pkgJson from './package.json'
import { readFileSync, writeFileSync } from 'fs'

const distFolder = path.resolve(__dirname, 'dist')

const proxyScheme = process.env.SERVER_SSL ? 'https' : 'http'
const proxyWebSocketScheme = process.env.SERVER_SSL ? 'wss' : 'ws'
const proxyHostname = process.env.SERVER_HOST
	? process.env.SERVER_HOST
	: 'localhost'
const proxyPort = process.env.SERVER_PORT ? process.env.SERVER_PORT : '8091'

const proxyURL = process.env.SERVER_URL
	? process.env.SERVER_URL
	: `${proxyScheme}://${proxyHostname}:${proxyPort}`

const proxyWebSocketURL = `${proxyWebSocketScheme}://${proxyHostname}:${proxyPort}`

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	// Load env file based on `mode` in the current working directory.
	const env = loadEnv(mode, process.cwd())

	process.env.VITE_TITLE = 'Z-Wave JS UI'
	process.env.VITE_VERSION = pkgJson.version
	process.env.VITE_API_ENDPOINT = proxyURL
	return {
		plugins: [
			vue2(),
			VitePWA({
				registerType: 'autoUpdate',
				manifest: {
					name: process.env.VITE_TITLE,
					description: process.env.VITE_TITLE,
					short_name: process.env.VITE_TITLE,
					theme_color: '#ffffff',
					background_color: '#2196F3',
					icons: [
						{
							src: '/pwa-64x64.png',
							sizes: '64x64',
							type: 'image/png',
						},
						{
							src: '/pwa-192x192.png',
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: '/pwa-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any',
						},
						{
							src: '/maskable-icon-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable',
						},
					],
				},
			}),
			{
				name: 'postbuild-commands',
				closeBundle: async () => {
					const indexPath = path.join(__dirname, './dist/index.html')

					const content = readFileSync(indexPath, 'utf8')
						.replace(/href="\//g, 'href="<%- config.base %>')
						.replace(/src="\//g, 'src="<%- config.base %>')
						.replace(
							'<head>',
							'<head>\n		<base href="<%= config.base %>" />'
						)

					// update the views/index.ejs file
					writeFileSync(
						path.join(__dirname, './views/index.ejs'),
						content,
						'utf8'
					)
				},
			},
		],
		resolve: {
			alias: [
				{
					find: /^@\/(.+)/,
					replacement: `${path.resolve(__dirname, 'src')}/$1`,
				},
				{
					find: /^@server\/(.+)/,
					replacement: `${path.resolve(__dirname, 'src')}/$1`,
				},
			],
		},
		define: {
			__APP_ENV__: JSON.stringify(env.APP_ENV),
		},
		server: {
			port: 8092,
			https: process.env.SERVER_SSL
				? {
						key: path.resolve(__dirname, 'certs/server.key'),
						cert: path.resolve(__dirname, 'certs/server.crt'),
				  }
				: false,
			base: distFolder,
			host: '0.0.0.0',
			proxy: {
				'/socket.io': {
					// not working, see https://github.com/vitejs/vite/issues/4124
					target: proxyURL,
					ws: true,
					secure: false, // allow self signed certificates
					changeOrigin: true,
				},
				'/health': {
					target: proxyURL,
					secure: false,
					changeOrigin: true,
				},
				'/api': {
					target: proxyURL,
					secure: false,
					changeOrigin: true,
				},
			},
		},
		build: {
			outDir: distFolder,
			sourcemap: false,
			emptyOutDir: true,
		},
	}
})
