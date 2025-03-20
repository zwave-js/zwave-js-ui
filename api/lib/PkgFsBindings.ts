import { FileHandle, FSStats, type FileSystem } from '@zwave-js/shared/bindings'
import { fs as nodeFs } from '@zwave-js/core/bindings/fs/node'
import path from 'node:path'

// Ensures that the Z-Wave JS driver is looking for the right files in the right place
// when running inside a `pkg` bundle. In this case, it will resolve its embedded
// configuration dir to the path "/config", but the files reside in "node_modules/@zwave-js/config/config" instead.

const CONFIG_PATH = '/config'
const CONFIG_PATH_IN_PKG = path.join(
	__dirname,
	`node_modules/@zwave-js/config/config`,
)

export class PkgFsBindings implements FileSystem {
	readFile(path: string): Promise<Uint8Array> {
		if (path.startsWith(CONFIG_PATH)) {
			path = path.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.readFile(path)
	}
	writeFile(path: string, data: Uint8Array): Promise<void> {
		if (path.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.writeFile(path, data)
	}
	copyFile(source: string, dest: string): Promise<void> {
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
		path: string,
		flags: {
			read: boolean
			write: boolean
			create: boolean
			truncate: boolean
		},
	): Promise<FileHandle> {
		if (path.startsWith(CONFIG_PATH) && flags.write) {
			// The pkg assets are readonly
			throw new Error(`${path} is not writable`)
		}
		if (path.startsWith(CONFIG_PATH)) {
			path = path.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.open(path, flags)
	}
	readDir(path: string): Promise<string[]> {
		if (path.startsWith(CONFIG_PATH)) {
			path = path.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.readDir(path)
	}
	stat(path: string): Promise<FSStats> {
		if (path.startsWith(CONFIG_PATH)) {
			path = path.replace(CONFIG_PATH, CONFIG_PATH_IN_PKG)
		}
		return nodeFs.stat(path)
	}
	ensureDir(path: string): Promise<void> {
		if (path.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.ensureDir(path)
	}
	deleteDir(path: string): Promise<void> {
		if (path.startsWith(CONFIG_PATH)) {
			// The pkg assets are readonly
			return
		}
		return nodeFs.deleteDir(path)
	}
	makeTempDir(prefix: string): Promise<string> {
		return nodeFs.makeTempDir(prefix)
	}
}
