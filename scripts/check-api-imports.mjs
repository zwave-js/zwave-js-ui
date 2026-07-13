import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const apiRoot = path.join(repoRoot, 'api')
const fix = process.argv.includes('--fix')
const json = process.argv.includes('--json')

const sourceExtensions = new Set([
	'.cjs',
	'.cts',
	'.js',
	'.jsx',
	'.mjs',
	'.mts',
	'.ts',
	'.tsx',
	'.vue',
])

function trackedSourceFiles() {
	return execFileSync('git', ['ls-files', '-z'], {
		cwd: repoRoot,
		encoding: 'utf8',
	})
		.split('\0')
		.filter(Boolean)
		.filter((file) => sourceExtensions.has(path.extname(file)))
}

function sourceBlocks(file, source) {
	if (!file.endsWith('.vue')) return [{ offset: 0, source }]

	return [
		...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
	].map((match) => ({
		offset: match.index + match[0].indexOf(match[1]),
		source: match[1],
	}))
}

function isStringLiteral(node) {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function isModuleLoaderCall(node) {
	if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return true
	if (ts.isIdentifier(node.expression))
		return node.expression.text === 'require'
	if (!ts.isPropertyAccessExpression(node.expression)) return false

	const owner = node.expression.expression
	const method = node.expression.name.text
	if (ts.isIdentifier(owner) && owner.text === 'require') {
		return method === 'resolve'
	}
	return (
		ts.isIdentifier(owner) &&
		(owner.text === 'vi' || owner.text === 'jest') &&
		['doMock', 'importActual', 'mock', 'unmock'].includes(method)
	)
}

function collectSpecifiers(file, source) {
	const results = []

	for (const block of sourceBlocks(file, source)) {
		const sourceFile = ts.createSourceFile(
			file,
			block.source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		)

		function add(node, kind) {
			const start = block.offset + node.getStart(sourceFile) + 1
			const end = block.offset + node.getEnd() - 1
			const position = sourceFile.getLineAndCharacterOfPosition(
				node.getStart(sourceFile),
			)
			results.push({
				end,
				kind,
				line: position.line + 1,
				specifier: node.text,
				start,
			})
		}

		function visit(node) {
			if (
				(ts.isImportDeclaration(node) ||
					ts.isExportDeclaration(node)) &&
				node.moduleSpecifier &&
				isStringLiteral(node.moduleSpecifier)
			) {
				add(
					node.moduleSpecifier,
					ts.isImportDeclaration(node)
						? 'static-import'
						: 'export-from',
				)
			} else if (
				ts.isImportTypeNode(node) &&
				ts.isLiteralTypeNode(node.argument) &&
				isStringLiteral(node.argument.literal)
			) {
				add(node.argument.literal, 'import-type')
			} else if (
				ts.isCallExpression(node) &&
				isModuleLoaderCall(node) &&
				node.arguments.length > 0 &&
				isStringLiteral(node.arguments[0])
			) {
				let kind = 'test-loader'
				if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
					kind = 'dynamic-import'
				} else if (ts.isIdentifier(node.expression)) {
					kind = 'require'
				} else if (
					ts.isPropertyAccessExpression(node.expression) &&
					ts.isIdentifier(node.expression.expression) &&
					node.expression.expression.text === 'require'
				) {
					kind = 'require-resolve'
				}
				add(node.arguments[0], kind)
			}
			ts.forEachChild(node, visit)
		}

		visit(sourceFile)
	}

	return results
}

function resolvedApiPath(file, specifier) {
	if (specifier.startsWith('#api/')) {
		const relativePath = specifier.slice('#api/'.length)
		return path.join(apiRoot, relativePath)
	}
	if (specifier.startsWith('@api/')) {
		return path.join(apiRoot, specifier.slice('@api/'.length))
	}
	if (!file.startsWith('src/') && specifier.startsWith('@server/')) {
		return path.join(apiRoot, specifier.slice('@server/'.length))
	}
	if (!specifier.startsWith('.')) return undefined

	const resolved = path.resolve(repoRoot, path.dirname(file), specifier)
	const relativePath = path.relative(apiRoot, resolved)
	if (relativePath === '' || relativePath.startsWith(`..${path.sep}`)) {
		return undefined
	}
	return resolved
}

function canonicalSpecifier(resolvedPath) {
	const relativePath = path
		.relative(apiRoot, resolvedPath)
		.replaceAll(path.sep, '/')
		.replace(/\.(?:[cm]?[jt]sx?)$/, '')
	return `#api/${relativePath}`
}

const inventory = []
const editsByFile = new Map()

for (const file of trackedSourceFiles()) {
	const source = readFileSync(path.join(repoRoot, file), 'utf8')
	for (const entry of collectSpecifiers(file, source)) {
		const resolvedPath = resolvedApiPath(file, entry.specifier)
		if (!resolvedPath) continue

		const canonical = canonicalSpecifier(resolvedPath)
		const mechanism = entry.specifier.startsWith('#api/')
			? 'canonical'
			: entry.specifier.startsWith('.')
				? 'relative'
				: 'retired-alias'
		const inventoryEntry = {
			file,
			kind: entry.kind,
			line: entry.line,
			mechanism,
			specifier: entry.specifier,
			target: path
				.relative(repoRoot, resolvedPath)
				.replaceAll(path.sep, '/'),
		}
		inventory.push(inventoryEntry)

		if (entry.specifier !== canonical) {
			const edits = editsByFile.get(file) ?? []
			edits.push({
				end: entry.end,
				replacement: canonical,
				start: entry.start,
			})
			editsByFile.set(file, edits)
		}
	}
}

if (fix) {
	for (const [file, edits] of editsByFile) {
		const filePath = path.join(repoRoot, file)
		let source = readFileSync(filePath, 'utf8')
		for (const edit of edits.sort((a, b) => b.start - a.start)) {
			source =
				source.slice(0, edit.start) +
				edit.replacement +
				source.slice(edit.end)
		}
		writeFileSync(filePath, source)
	}
}

const violations = inventory.filter(
	(entry) =>
		entry.specifier !==
		canonicalSpecifier(path.join(repoRoot, entry.target)),
)
const report = {
	canonical: inventory.length - violations.length,
	files: new Set(inventory.map(({ file }) => file)).size,
	total: inventory.length,
	violations: violations.length,
	entries: inventory,
}

if (json) {
	console.log(JSON.stringify(report, null, 2))
} else if (violations.length > 0 && !fix) {
	for (const entry of violations) {
		console.error(
			`${entry.file}:${entry.line}: ${entry.specifier} resolves to ${entry.target}; use ${canonicalSpecifier(path.join(repoRoot, entry.target))}`,
		)
	}
	console.error(
		`\n${violations.length} non-canonical backend import(s) found`,
	)
} else {
	console.log(
		`${inventory.length} backend import(s) use the canonical #api/* mapping`,
	)
}

if (violations.length > 0 && !fix) process.exitCode = 1
