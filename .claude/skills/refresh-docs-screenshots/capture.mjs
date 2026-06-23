#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SKILL_DIR, '../../..')
const OUT_DIR = path.join(REPO_ROOT, 'docs/_images')
const MANIFEST_PATH = path.join(SKILL_DIR, 'manifest.json')
// Backend serves the built bundle on 8091; routes are hash-prefixed (vue-router hash mode).
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:8091'

const args = parseArgs(process.argv.slice(2))
if (args.help) {
	console.log(USAGE)
	process.exit(0)
}

const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
const defaults = manifest.defaults || {}
const allEntries = manifest.entries || []

if (args.list) {
	for (const e of allEntries) console.log(stripPng(e.filename))
	process.exit(0)
}

const entries = args.only
	? allEntries.filter((e) => args.only.includes(stripPng(e.filename)))
	: allEntries

if (entries.length === 0) {
	console.error('No matching manifest entries.')
	process.exit(1)
}

const browser = await chromium.launch()
const results = []

try {
	for (const entry of entries) {
		const themes = resolveThemes(entry, args.theme)
		for (const theme of themes) {
			const filename = pickFilename(entry, theme)
			const out = path.join(OUT_DIR, filename)
			const status = await captureOne(entry, theme, out)
			results.push({ filename, theme, status, path: out })
			console.log(`${pad(status, 12)} ${filename} (${theme})`)
		}
	}
} finally {
	await browser.close()
}

const failed = results.filter((r) => r.status.startsWith('error'))
console.log(`\n${results.length - failed.length}/${results.length} captured`)
if (failed.length) process.exit(2)

async function captureOne(entry, theme, outPath) {
	const viewport = entry.viewport || defaults.viewport
	// Set prefers-color-scheme on the context so loadColorScheme()'s 'system'
	// fallback (and Vuetify's media-query reader) lines up with the requested
	// theme. The localStorage write is the explicit override; the context
	// option is the safety net.
	const ctx = await browser.newContext({ viewport, colorScheme: theme })
	await ctx.addInitScript((t) => {
		try {
			localStorage.setItem('colorScheme', t)
			// Activates the test hooks gated in the app source (see
			// src/components/custom/ZwaveGraph.vue → window.__zwGraph) so we can
			// drive vis-network programmatically.
			localStorage.setItem('exposeZwaveGraph', '1')
		} catch {}
	}, theme)
	const page = await ctx.newPage()
	try {
		// vue-router runs in hash mode — `/control-panel` lives at `/#/control-panel`.
		const url = `${BASE_URL}/#${entry.route}`
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
		if (defaults.settleAfterRoute) {
			await page.waitForTimeout(defaults.settleAfterRoute)
		}
		for (const a of entry.preActions || []) {
			await runAction(page, a)
		}
		if (args.dryRun) return 'dry-run'
		await fs.mkdir(path.dirname(outPath), { recursive: true })
		const before = await safeStat(outPath)
		await takeScreenshot(page, entry, outPath)
		return before == null ? 'new' : 'updated'
	} catch (e) {
		const msg = (e.message || String(e)).split('\n')[0]
		return `error: ${msg.slice(0, 80)}`
	} finally {
		await ctx.close()
	}
}

// Default: viewport screenshot. `entry.clip` accepts:
//  - "<css>"                                    → locator.screenshot (element box)
//  - { x, y, width, height }                    → page.screenshot with rect
//  - { selector, padding }                      → expand element box by `padding`
//                                                 (in CSS px) on every side. Use
//                                                 this when the element has visible
//                                                 overflow children (e.g. a v-badge
//                                                 floating outside its wrapper).
async function takeScreenshot(page, entry, outPath) {
	await dismissToasts(page)
	const clip = entry.clip
	if (typeof clip === 'string') {
		await page.locator(clip).first().screenshot({ path: outPath })
	} else if (clip && typeof clip === 'object' && clip.selector) {
		const box = await page.locator(clip.selector).first().boundingBox()
		if (!box) throw new Error(`clip selector matched no box: ${clip.selector}`)
		const pad = clip.padding ?? 0
		await page.screenshot({
			path: outPath,
			clip: {
				x: Math.max(0, box.x - pad),
				y: Math.max(0, box.y - pad),
				width: box.width + pad * 2,
				height: box.height + pad * 2,
			},
		})
	} else if (clip && typeof clip === 'object') {
		await page.screenshot({ path: outPath, clip })
	} else {
		await page.screenshot({ path: outPath })
	}
}

// Clear any transient snackbar/toast before capturing. Stray "API … called"
// info toasts and one-off error toasts (e.g. getNodeNeighbors against a UI-only
// fake node) otherwise leak into shots. Fires the App.vue `zwave:dismiss-snackbars`
// hook (→ dismissAllSnackbars), then waits for sonner's exit animation to remove
// the toast nodes. The timeout+catch is a safety net — a missing hook (old build)
// must not abort the capture.
async function dismissToasts(page) {
	await page.evaluate(() => {
		document.dispatchEvent(new CustomEvent('zwave:dismiss-snackbars'))
	})
	await page
		.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), null, {
			timeout: 2000,
		})
		.catch(() => {})
}

async function runAction(page, a) {
	if (a.wait) {
		await page.locator(a.wait).first().waitFor({ state: 'visible', timeout: 10000 })
	} else if (a.click) {
		const opts = { timeout: 10000 }
		if (a.position) opts.position = a.position // { x, y } relative to element top-left
		await page.locator(a.click).first().click(opts)
	} else if (a.settle != null) {
		await page.waitForTimeout(a.settle)
	} else if (a.scrollTo) {
		await page.locator(a.scrollTo).first().scrollIntoViewIfNeeded({ timeout: 10000 })
	} else if (a.exec) {
		await page.evaluate(`(async () => { ${a.exec} })()`)
	} else if (a.clearAppState) {
		// Clear all localStorage except colorScheme, then re-navigate to the same hash route.
		await page.evaluate(() => {
			const keep = localStorage.getItem('colorScheme')
			localStorage.clear()
			if (keep != null) localStorage.setItem('colorScheme', keep)
		})
		await page.goto(page.url(), { waitUntil: 'domcontentloaded' })
	}
}

function resolveThemes(entry, override) {
	const base = entry.themes || defaults.themes || ['dark']
	if (!override || override === 'both') return base
	return base.includes(override) ? [override] : []
}

function pickFilename(entry, theme) {
	if (theme === 'light' && entry.lightFilename) return entry.lightFilename
	return entry.filename
}

function stripPng(s) {
	return s.replace(/\.png$/, '')
}

async function safeStat(p) {
	try { return (await fs.stat(p)).size } catch { return null }
}

function pad(s, n) {
	return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function parseArgs(argv) {
	const out = { only: null, theme: null, dryRun: false, list: false, help: false }
	for (const a of argv) {
		if (a === '--dry-run') out.dryRun = true
		else if (a === '--list') out.list = true
		else if (a === '--help' || a === '-h') out.help = true
		else if (a.startsWith('--only=')) out.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean)
		else if (a.startsWith('--theme=')) out.theme = a.slice(8)
		else {
			console.error(`Unknown arg: ${a}`)
			console.error(USAGE)
			process.exit(1)
		}
	}
	return out
}

const USAGE = `Usage: node capture.mjs [options]
  --only=name1,name2     Only capture these entries (filename minus .png)
  --theme=dark|light|both  Override per-entry themes
  --dry-run              Run preActions but skip writing PNGs
  --list                 Print entry names and exit
  -h, --help             Show this help

Env:
  SCREENSHOT_BASE_URL    Override base URL (default http://127.0.0.1:8091)
`
