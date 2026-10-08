import archiver from 'archiver'
import { createReadStream, type ReadStream } from 'node:fs'
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
			if ('path' in entry) {
				const stream = createReadStream(entry.path)
				// archiver pipes sources without forwarding their errors
				stream.on('error', (error) => archive.destroy(error))
				files.push(stream)
				archive.append(stream, { name: entry.name })
			} else {
				archive.append(entry.data, { name: entry.name })
			}
		}

		// finalize() only resolves once the output has consumed the archive
		await Promise.all([streaming, archive.finalize()])
		return archive.pointer()
	} finally {
		await Promise.all(files.map(release))
	}
}

// destroy() only schedules the close: callers may remove the file right after, which fails on Windows while it is open
function release(stream: ReadStream): Promise<void> | undefined {
	if (stream.closed) return
	// resolves on close only: an open error must not skip the caller's cleanup
	const closed = new Promise<void>((resolve) =>
		stream.once('close', () => resolve()),
	)
	stream.destroy()
	return closed
}
