#!/usr/bin/env node

/**
 * Screenshot template for zwave-js-ui
 *
 * Usage: node screenshot-template.js <url> <output-path> [width] [height]
 *
 * Examples:
 *   node screenshot-template.js "http://localhost:8092/#/settings" /tmp/screenshots/settings.png
 *   node screenshot-template.js "http://localhost:8092/#/mesh" /tmp/screenshots/mesh.png 1920 1080
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const url = process.argv[2]
const outputPath = process.argv[3]
const viewportWidth = parseInt(process.argv[4]) || 1280
const viewportHeight = parseInt(process.argv[5]) || 720

if (!url || !outputPath) {
	console.error(
		'Usage: node screenshot-template.js <url> <output-path> [width] [height]',
	)
	process.exit(1)
}

// Check if auth is enabled by reading store/settings.json
function isAuthEnabled() {
	const cwdSettingsPath = path.resolve(process.cwd(), 'store/settings.json')
	const scriptSettingsPath = path.resolve(
		__dirname,
		'../../../store/settings.json',
	)

	for (const p of [cwdSettingsPath, scriptSettingsPath]) {
		try {
			const settings = JSON.parse(fs.readFileSync(p, 'utf8'))
			return settings?.gateway?.authEnabled === true
		} catch {
			// continue to next path
		}
	}
	return false
}

async function takeScreenshot() {
	const authEnabled = isAuthEnabled()
	const outputDir = path.dirname(outputPath)
	fs.mkdirSync(outputDir, { recursive: true })

	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext({
		viewport: { width: viewportWidth, height: viewportHeight },
	})

	// Set dark mode in localStorage before navigation
	await context.addInitScript(() => {
		localStorage.setItem('dark', 'true')
	})

	const page = await context.newPage()

	if (authEnabled) {
		// Navigate to the app root first — router will redirect to login
		await page.goto('http://localhost:8092/', {
			waitUntil: 'networkidle',
		})
		await page.waitForTimeout(1000)

		// Fill login form
		try {
			await page.fill(
				'input[type="text"], input[name="username"]',
				'admin',
				{ timeout: 5000 },
			)
			await page.fill('input[type="password"]', 'zwave', {
				timeout: 5000,
			})
			await page.click('button[type="submit"]', { timeout: 5000 })
			await page.waitForTimeout(2000)
		} catch (e) {
			console.warn(
				'Login form not found or login failed, continuing...',
				e.message,
			)
		}
	}

	// Navigate to the target URL
	await page.goto(url, { waitUntil: 'networkidle' })

	// Wait for Vuetify rendering
	await page.waitForTimeout(2000)

	await page.screenshot({ path: outputPath, fullPage: false })
	console.log(
		`Screenshot saved to ${outputPath} (${viewportWidth}x${viewportHeight})`,
	)

	await browser.close()
}

takeScreenshot().catch((err) => {
	console.error('Screenshot failed:', err)
	process.exit(1)
})
