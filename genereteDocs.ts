import { MethodDeclaration, Project, SourceFile } from 'ts-morph'
import { allowedApis } from './api/lib/ZwaveClient'
import { readFile, writeFile } from 'fs/promises'

import * as prettier from 'prettier'
import { join } from 'path'

// Make the linter happy
export async function formatWithPrettier(
	filename: string,
	sourceText: string,
): Promise<string> {
	const prettierOptions = {
		...require(join(__dirname, '.prettierrc.js')),
		// To infer the correct parser
		filepath: filename,
	}
	return await prettier.format(sourceText, prettierOptions)
}

// Inpired by https://github.com/zwave-js/node-zwave-js/blob/master/packages/maintenance/src/generateTypedDocs.ts#L334
async function main() {
	const program = new Project({ tsConfigFilePath: 'tsconfig.json' })

	const fileName = './api/lib/ZwaveClient.ts'
	const docsFile = './docs/guide/mqtt.md'

	const sourceFile = program.getSourceFileOrThrow(fileName)

	const text = await formatWithPrettier(docsFile, mqttApis(sourceFile))

	const content = await readFile(docsFile, 'utf8')

	const startPlaceholder = '<!-- AUTO GENERATED START -->'
	const endPlaceholder = '<!-- AUTO GENERATED END -->'
	const start = content.indexOf(startPlaceholder) + startPlaceholder.length
	const end = content.indexOf(endPlaceholder)
	const newContent =
		content.substring(0, start) + '\n' + text + content.substring(end)
	await writeFile(docsFile, newContent)
}

function printMethodDeclaration(method: MethodDeclaration): string {
	method = method.toggleModifier('public', false)
	method.getDecorators().forEach((d) => d.remove())
	const start = method.getStart()
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const end = method.getBody().getStart()
	let ret = method
		.getText()
		.substring(0, end - start)
		.trim()
	if (!method.getReturnTypeNode()) {
		ret += ': ' + method.getSignature().getReturnType().getText(method)
	}
	ret += ';'
	return fixPrinterErrors(ret)
}

function fixPrinterErrors(text: string): string {
	return (
		text
			// The text includes one too many tabs at the start of each line
			.replace(/^\t(\t*)/gm, '$1')
			// TS 4.2+ has some weird printing bug for aliases: https://github.com/microsoft/TypeScript/issues/43031
			.replace(/(\w+) \| \("unknown" & { __brand: \1; }\)/g, 'Maybe<$1>')
	)
}

function printOverload(method: MethodDeclaration): string {
	method = method.toggleModifier('public', false)
	return fixPrinterErrors(method.getText())
}

function mqttApis(file: SourceFile) {
	const ZwaveClientClass = file
		.getClasses()
		.find((c) => c.getName() === 'ZwaveClient')

	if (!ZwaveClientClass) throw new Error('ZwaveClient class not found')

	const methods = ZwaveClientClass.getInstanceMethods().filter((c) =>
		allowedApis.includes(c.getName() as any),
	)

	let text = ''

	for (const method of methods) {
		const signatures = method.getOverloads()

		text += `#### \`${method.getName()}\`
\`\`\`ts
${
	signatures.length > 0
		? signatures.map(printOverload).join('\n\n')
		: printMethodDeclaration(method)
}
\`\`\`
`

		const doc = method.getStructure().docs?.[0]
		if (typeof doc === 'string') {
			text += doc + '\n\n'
		} else if (doc != undefined) {
			if (typeof doc.description === 'string') {
				let description = doc.description.trim()
				if (!description.endsWith('.')) {
					description += '.'
				}
				text += description + '\n\n'
			}
		}

		const params = method.getParameters()

		text += `<details>
<summary>Mqtt usage</summary>

Topic: \`zwave/_CLIENTS/ZWAVE_GATEWAY-<mqtt_name>/api/${method.getName()}/set\`

Payload:

\`\`\`json
{
	"args": [${
		params.length > 0
			? '\n\t\t' + params.map((p) => p.getName()).join(',\n\t\t') + '\n\t'
			: ''
	}]
}
\`\`\`

</details>\n\n`
	}

	return text
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
