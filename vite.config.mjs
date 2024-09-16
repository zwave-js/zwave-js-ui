import path from 'path'
import vue2 from '@vitejs/plugin-vue2'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import * as pkgJson from './package.json'

const distFolder = path.resolve(__dirname, 'dist')

const proxyScheme = process.env.SERVER_SSL ? 'https' : 'http'
const proxyHostname = process.env.SERVER_HOST
	? process.env.SERVER_HOST
	: 'localhost'
const proxyPort = process.env.SERVER_PORT ? process.env.SERVER_PORT : '8091'
const ingressToken = process.env.INGRESS_TOKEN

const proxyURL = process.env.SERVER_URL
	? process.env.SERVER_URL
	: `${proxyScheme}://${proxyHostname}:${proxyPort}`

const headers = ingressToken
	? {
			headers: { cookie: `ingress_session=${ingressToken}` },
		}
	: {}

// const proxyWebSocketScheme = process.env.SERVER_SSL ? 'wss' : 'ws'
// const proxyWebSocketURL = `${proxyWebSocketScheme}://${proxyHostname}:${proxyPort}`

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	// Load env file based on `mode` in the current working directory.
	const env = loadEnv(mode, process.cwd())

	process.env.VITE_TITLE = 'Z-Wave JS UI'
	process.env.VITE_VERSION = pkgJson.version
	process.env.VITE_API_ENDPOINT = proxyURL
	return {
		base: './',
		plugins: [
			vue2(),
			VitePWA({
				registerType: 'autoUpdate',
				strategies: 'injectManifest',
				injectRegister: 'auto',
				// https://vite-pwa-org.netlify.app/guide/inject-manifest.html#plugin-configuration-2
				srcDir: 'src',
				filename: 'sw.js',
				devOptions: {
					enabled: true,
					type: 'module',
					/* other options */
				},
				workbox: {
					globIgnores: ['**/api/**'],
				},
				manifest: {
					name: process.env.VITE_TITLE,
					description: process.env.VITE_TITLE,
					short_name: process.env.VITE_TITLE,
					theme_color: '#ffffff',
					background_color: '#2196F3',
					icons: [
						{
							src: 'pwa-64x64.png',
							sizes: '64x64',
							type: 'image/png',
						},
						{
							src: 'pwa-192x192.png',
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: 'pwa-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any',
						},
						{
							src: 'maskable-icon-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable',
						},
					],
				},
			}),
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
			preserveSymlinks: true,
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
					...headers,
				},
				'/health': {
					target: proxyURL,
					secure: false,
					changeOrigin: true,
					...headers,
				},
				'/api': {
					target: proxyURL,
					secure: false,
					changeOrigin: true,
					...headers,
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
