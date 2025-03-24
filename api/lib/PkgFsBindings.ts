import { FileHandle, FSStats, type FileSystem } from '@zwave-js/shared/bindings'
import { fs as nodeFs } from '@zwave-js/core/bindings/fs/node'
import path from 'node:path'

// Ensures that the Z-Wave JS driver is looking for the right files in the right place
// when running inside a `pkg` bundle. In this case, it will resolve its embedded
// configuration dir to the path "/config", but the files reside in "node_modules/@zwave-js/config/config" instead.

const CONFIG_PATH = path.resolve('/config')
console.log('CONFIG_PATH', CONFIG_PATH)
const CONFIG_PATH_IN_PKG = path.join(
	__dirname,
	`node_modules/@zwave-js/config/config`,
)

export class PkgFsBindings implements FileSystem {
	readFile(filePath: string): Promise<Uint8Array> {
		filePath = path.normalize(filePath)
		if (filePath.startsWith(CONFIG_PATH)) {
			filePath = filePath.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.readFile(filePath)
	}
	writeFile(filePath: string, data: Uint8Array): Promise<void> {
		filePath = path.normalize(filePath)
		if (filePath.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.writeFile(filePath, data)
	}
	copyFile(source: string, dest: string): Promise<void> {
		source = path.normalize(source)
		dest = path.normalize(dest)
		if (dest.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		if (source.startsWith(CONFIG_PATH)) {
			source = source.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
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
		if (filePath.startsWith(CONFIG_PATH) && flags.write) {
			// The pkg assets are readonly
			throw new Error(`${filePath} is not writable`)
		}
		if (filePath.startsWith(CONFIG_PATH)) {
			filePath = filePath.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.open(filePath, flags)
	}
	readDir(dirPath: string): Promise<string[]> {
		dirPath = path.normalize(dirPath)
		if (dirPath.startsWith(CONFIG_PATH)) {
			dirPath = dirPath.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.readDir(dirPath)
	}
	stat(filePath: string): Promise<FSStats> {
		filePath = path.normalize(filePath)
		if (filePath.startsWith(CONFIG_PATH)) {
			filePath = filePath.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.stat(filePath)
	}
	ensureDir(dirPath: string): Promise<void> {
		dirPath = path.normalize(dirPath)
		if (dirPath.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.ensureDir(dirPath)
	}
	deleteDir(dirPath: string): Promise<void> {
		dirPath = path.normalize(dirPath)
		if (dirPath.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.deleteDir(dirPath)
	}
	makeTempDir(prefix: string): Promise<string> {
		return nodeFs.makeTempDir(prefix)
	}
}
