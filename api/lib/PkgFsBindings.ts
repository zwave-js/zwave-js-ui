import type { FileHandle, FSStats } from '@zwave-js/shared/bindings'
import { type FileSystem } from '@zwave-js/shared/bindings'
import { fs as nodeFs } from '@zwave-js/core/bindings/fs/node'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(new URL('', import.meta.url))
const __dirname = path.dirname(__filename)
// Ensures that the Z-Wave JS driver is looking for the right files in the right place
// when running inside a `pkg` bundle. In this case, it will resolve its embedded
// configuration dir to a path outside the bundle, but the files reside in
// "node_modules/@zwave-js/config/config" instead.

// `@zwave-js/config` resolves that dir two levels above its own module file.
// Bundling flattens that file into our entry, so the walk escapes the bundle
// root: it lands on "/config" in a legacy pkg snapshot and on "/snapshot/config"
// in a SEA binary. Match both instead of hardcoding a single layout.
//
// Inside a pkg bundle, the current filename/directory is always "C:\...",
// so the config dir needs to be resolved relative to __filename, otherwise
// it would be relative to the current working directory, which might not be on the same drive.
const CONFIG_PATHS = [
	path.resolve(__filename, '/config'),
	path.resolve(__dirname, '../..', 'config'),
]
const CONFIG_PATH_IN_PKG = path.join(
	__dirname,
	`node_modules/@zwave-js/config/config`,
)

/**
 * Maps a path inside the driver's embedded config dir onto the assets shipped
 * with the bundle. Returns `undefined` for any path outside of it.
 */
function toPkgPath(filePath: string): string | undefined {
	// the separator boundary keeps siblings like `/config-db` out of the match
	const configPath = CONFIG_PATHS.find(
		(p) => filePath === p || filePath.startsWith(p + path.sep),
	)
	return configPath
		? filePath.replace(configPath, CONFIG_PATH_IN_PKG)
		: undefined
}

export class PkgFsBindings implements FileSystem {
	readFile(filePath: string): Promise<Uint8Array<ArrayBuffer>> {
		filePath = path.normalize(filePath)
		return nodeFs.readFile(toPkgPath(filePath) ?? filePath)
	}
	async writeFile(
		filePath: string,
		data: Uint8Array<ArrayBuffer>,
	): Promise<void> {
		filePath = path.normalize(filePath)
		if (toPkgPath(filePath)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.writeFile(filePath, data)
	}
	async copyFile(source: string, dest: string): Promise<void> {
		source = path.normalize(source)
		dest = path.normalize(dest)
		if (toPkgPath(dest)) {
			// The pkg assets are readonly
			return
		}
		const pkgSource = toPkgPath(source)
		if (pkgSource) {
			// SEA's virtual filesystem cannot copyFile out of an embedded asset,
			// so read it and write it back out instead
			return nodeFs.writeFile(dest, await nodeFs.readFile(pkgSource))
		}
		return nodeFs.copyFile(source, dest)
	}
	open(
		filePath: string,
		flags: {
			read: boolean
			write: boolean
			create: boolean
			truncate: boolean
		},
	): Promise<FileHandle> {
		filePath = path.normalize(filePath)
		const pkgPath = toPkgPath(filePath)
		if (pkgPath && flags.write) {
			// The pkg assets are readonly
			throw new Error(`${filePath} is not writable`)
		}
		return nodeFs.open(pkgPath ?? filePath, flags)
	}
	readDir(dirPath: string): Promise<string[]> {
		dirPath = path.normalize(dirPath)
		return nodeFs.readDir(toPkgPath(dirPath) ?? dirPath)
	}
	stat(filePath: string): Promise<FSStats> {
		filePath = path.normalize(filePath)
		return nodeFs.stat(toPkgPath(filePath) ?? filePath)
	}
	async ensureDir(dirPath: string): Promise<void> {
		dirPath = path.normalize(dirPath)
		if (toPkgPath(dirPath)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.ensureDir(dirPath)
	}
	async deleteDir(dirPath: string): Promise<void> {
		dirPath = path.normalize(dirPath)
		if (toPkgPath(dirPath)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.deleteDir(dirPath)
	}
	makeTempDir(prefix: string): Promise<string> {
		return nodeFs.makeTempDir(prefix)
	}
}
