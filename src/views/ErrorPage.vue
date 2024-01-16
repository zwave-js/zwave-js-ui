<template>
	<v-container fluid fill-height>
		<v-row align="center" justify="center">
			<v-col cols="12" sm="8" md="4">
				<v-card class="elevation-12">
					<v-toolbar dark color="primary">
						<v-btn icon @click="$router.go(-2)">
							<v-icon>arrow_back</v-icon>
						</v-btn>
						<v-toolbar-title>{{
							query.code + ' - ' + query.message
						}}</v-toolbar-title>
						<v-spacer></v-spacer>
						<v-btn icon @click="$router.push('/')">
							<v-icon>home</v-icon>
						</v-btn>
					</v-toolbar>
					<v-card-text>
						<v-container fill-height text-xs-center>
							<v-row justify="center">
								<v-col>
									<strong class="headline font-weight-bold">
										Error while requesting resource at
										<code>{{ query.path }}</code>
									</strong>
								</v-col>
							</v-row>
						</v-container>
					</v-card-text>
				</v-card>
			</v-col>
		</v-row>
		<v-footer absolute class="pa-3">
			<v-col class="d-flex pa-0 justify-center py-3 text-caption">
				&copy;{{ new Date().getFullYear() }} —
				<strong class="ml-1 mr-2"
					><a
						target="_blank"
						href="https://github.com/sponsors/robertsLando"
						>Daniel Lando</a
					></strong
				>
				All Rights Reserved.
			</v-col>
		</v-footer>
	</v-container>
</template>

<script>
export default {
	data() {
		return {
			query: { code: 404, message: 'Not Found', path: '/error' },
		}
	},
	methods: {},
	beforeMount() {
		this.query =
			Object.keys(this.$route.query).length > 0
				? this.$route.query
				: this.query
	},
}
</script>
