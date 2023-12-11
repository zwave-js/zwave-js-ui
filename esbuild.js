const esbuild = require('esbuild')
const { cp } = require('fs/promises')
const pkgJson = require('./package.json')
const { exists, removeSync } = require('fs-extra')

const outputDir = 'build'

// from https://github.com/evanw/esbuild/issues/1051#issuecomment-806325487
const nativeNodeModulesPlugin = {
	name: 'native-node-modules',
	setup(build) {
		// If a ".node" file is imported within a module in the "file" namespace, resolve
		// it to an absolute path and put it into the "node-file" virtual namespace.
		build.onResolve({ filter: /\.node$/, namespace: 'file' }, (args) => ({
			path: require.resolve(args.path, { paths: [args.resolveDir] }),
			namespace: 'node-file',
		}))

		// Files in the "node-file" virtual namespace call "require()" on the
		// path from esbuild of the ".node" file in the output directory.
		build.onLoad({ filter: /.*/, namespace: 'node-file' }, (args) => ({
			contents: `
          import path from ${JSON.stringify(args.path)}
          try { module.exports = require(path) }
          catch {}
        `,
		}))

		// If a ".node" file is imported within a module in the "node-file" namespace, put
		// it in the "file" namespace where esbuild's default loading behavior will handle
		// it. It is already an absolute path since we resolved it to one above.
		build.onResolve(
			{ filter: /\.node$/, namespace: 'node-file' },
			(args) => ({
				path: args.path,
				namespace: 'file',
			}),
		)

		// Tell esbuild's default loading behavior to use the "file" loader for
		// these ".node" files.
		let opts = build.initialOptions
		opts.loader = opts.loader || {}
		opts.loader['.node'] = 'file'
	},
}

// clean build folder
removeSync(outputDir)

esbuild
	.build({
		entryPoints: ['api/bin/www.ts'],
		plugins: [nativeNodeModulesPlugin],
		bundle: true,

		platform: 'node',
		target: 'node18',
		outfile: `${outputDir}/src/bin/index.js`,
		external: ['serialport', '@zwave-js/config'],
	})
	.then(async () => {
		// copy assets to build folder
		for (let asset of pkgJson.pkg.assets) {
			console.log(`copying ${asset} to ${outputDir} folder`)
			// resolve glob assets
			asset = asset.replace('/**/*', '').replace('/**', '')

			if (await exists(asset)) {
				await cp(asset, `${outputDir}/${asset}`, { recursive: true })
			} else {
				console.log(`asset ${asset} does not exist`)
			}
		}
	})
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
