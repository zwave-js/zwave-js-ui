import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { storeDir } from '../config/app.ts'
import { ensureDir } from './utils.ts'
import { module } from './logger.ts'

const logger = module('PluginManager')

// npm scoped and unscoped package name pattern
const NPM_PACKAGE_NAME_RE =
	/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

const INSTALL_TIMEOUT = 120_000

class PluginManager {
	private pluginsDir: string
	private packageJsonPath: string
	private installing = new Set<string>()

	constructor() {
		this.pluginsDir = path.join(storeDir, '.plugins')
		this.packageJsonPath = path.join(this.pluginsDir, 'package.json')
	}

	async init(): Promise<void> {
		await ensureDir(this.pluginsDir)

		try {
			await readFile(this.packageJsonPath, 'utf-8')
		} catch {
			await writeFile(
				this.packageJsonPath,
				JSON.stringify(
					{ name: 'zwavejsui-plugins', private: true },
					null,
					2,
				),
			)
		}
	}

	isPathPlugin(plugin: string): boolean {
		return (
			plugin.startsWith('/') ||
			plugin.startsWith('.') ||
			plugin.startsWith('~')
		)
	}

	validatePackageName(name: string): boolean {
		return NPM_PACKAGE_NAME_RE.test(name)
	}

	async getInstalledPlugins(): Promise<Record<string, string>> {
		try {
			const pkg = JSON.parse(
				await readFile(this.packageJsonPath, 'utf-8'),
			)
			return pkg.dependencies ?? {}
		} catch {
			return {}
		}
	}

	async install(packageName: string): Promise<void> {
		if (this.isPathPlugin(packageName)) {
			return
		}

		if (!this.validatePackageName(packageName)) {
			throw new Error(`Invalid npm package name: ${packageName}`)
		}

		if (this.installing.has(packageName)) {
			logger.warn(
				`Plugin ${packageName} is already being installed, skipping`,
			)
			return
		}

		// Skip if already installed
		const installed = await this.getInstalledPlugins()
		if (installed[packageName]) {
			logger.info(`Plugin ${packageName} already installed, skipping`)
			return
		}

		this.installing.add(packageName)

		try {
			logger.info(`Installing plugin ${packageName}...`)
			await this.npmExec(['install', '--save', packageName])
			logger.info(`Plugin ${packageName} installed successfully`)
		} finally {
			this.installing.delete(packageName)
		}
	}

	async update(packageName?: string): Promise<void> {
		const args = ['update']
		if (packageName) {
			if (!this.validatePackageName(packageName)) {
				throw new Error(`Invalid npm package name: ${packageName}`)
			}
			args.push(packageName)
		}

		logger.info(
			`Updating plugin${packageName ? ` ${packageName}` : 's'}...`,
		)
		await this.npmExec(args)
		logger.info('Plugin update completed')
	}

	async uninstall(packageName: string): Promise<void> {
		if (!this.validatePackageName(packageName)) {
			throw new Error(`Invalid npm package name: ${packageName}`)
		}

		logger.info(`Uninstalling plugin ${packageName}...`)
		await this.npmExec(['uninstall', packageName])
		logger.info(`Plugin ${packageName} uninstalled successfully`)
	}

	resolvePlugin(plugin: string): string {
		if (this.isPathPlugin(plugin)) {
			return plugin
		}

		return path.join(this.pluginsDir, 'node_modules', plugin)
	}

	private npmExec(args: string[]): Promise<string> {
		return new Promise((resolve, reject) => {
			execFile(
				'npm',
				args,
				{ cwd: this.pluginsDir, timeout: INSTALL_TIMEOUT },
				(error, stdout, stderr) => {
					if (error) {
						logger.error(
							`npm ${args[0]} failed: ${stderr || error.message}`,
						)
						reject(
							new Error(
								`npm ${args[0]} failed: ${stderr || error.message}`,
							),
						)
					} else {
						resolve(stdout)
					}
				},
			)
		})
	}
}

export default new PluginManager()
