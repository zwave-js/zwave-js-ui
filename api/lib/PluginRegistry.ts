export interface PluginRegistryEntry {
	name: string
	label: string
	description: string
}

export const pluginRegistry: PluginRegistryEntry[] = [
	{
		name: '@ongit/zwavejsui-prom-exporter',
		label: 'Prometheus Exporter (ongit)',
		description: 'Prometheus metrics exporter for Z-Wave JS UI',
	},
	{
		name: '@kvaster/zwavejs-prom',
		label: 'Prometheus Exporter (kvaster)',
		description: 'Prometheus metrics for Z-Wave JS',
	},
]
