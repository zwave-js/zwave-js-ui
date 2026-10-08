import archiver from 'archiver'
import { once } from 'node:events'
import { createReadStream, type ReadStream, type WriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

export type ZipEntry = { name: string } & ({ path: string } | { data: string })

/**
 * Stream a zip of `entries` into `output` and resolve with its size in bytes.
 * Files are opened here rather than by archiver, so a failed output can't leave
 * their descriptors open and an unreadable file fails the zip instead of hanging it.
 */
export async function streamZip(
	output: NodeJS.WritableStream,
	entries: ZipEntry[],
	options?: archiver.ArchiverOptions,
): Promise<number> {
	const archive = archiver('zip', options)
	const files: ReadStream[] = []

	// piped before any source is added, so a source error always reaches the pipeline
	const streaming = pipeline(archive, output)
	// observed below; this only stops an early rejection being reported as unhandled
	streaming.catch(() => {})

	try {
		for (const entry of entries) {
			const processed = once(archive, 'entry')
			let file: ReadStream | undefined
			if ('path' in entry) {
				file = createReadStream(entry.path)
				// archiver pipes sources without forwarding their errors
				file.on('error', (error) => archive.destroy(error))
				files.push(file)
				archive.append(file, { name: entry.name })
			} else {
				archive.append(entry.data, { name: entry.name })
			}
			// the next file is opened only once this one is in the zip and closed, so a long list holds one descriptor at a time
			await Promise.race([processed, streaming])
			await closeFileStream(file)
		}

		// finalize() only resolves once the output has consumed the archive
		await Promise.all([streaming, archive.finalize()])
		return archive.pointer()
	} finally {
		await Promise.all(files.map(closeFileStream))
	}
}

/**
 * Destroy a file stream and wait until its descriptor is closed.
 * destroy() only schedules the close, and removing a file that is still open fails on Windows.
 */
export async function closeFileStream(
	stream:
		| (NodeJS.EventEmitter & { closed: boolean; destroy(): unknown })
		| undefined,
): Promise<void> {
	if (!stream || stream.closed) return
	// resolves on close only: an open error must not skip the caller's cleanup
	const closed = new Promise<void>((resolve) =>
		stream.once('close', () => resolve()),
	)
	stream.destroy()
	await closed
}
