<template>
	<v-icon :size="size" :color="color">{{ icon }}</v-icon>
</template>

<script>
export default {
	props: {
		active: {
			type: Boolean,
			default: false,
		},
		duration: {
			type: Number,
			default: 1000,
		},
		size: {
			type: Number,
			default: 20,
		},
		icon: {
			type: String,
			default: 'mdi-alert',
		},
		activeColor: {
			type: String,
			default: 'success',
		},
		inactiveColor: {
			type: String,
			default: 'grey',
		},
	},
	data: () => ({
		color: null,
		blinkInterval: null,
	}),
	watch: {
		active(val) {
			if (val) {
				this.color = this.activeColor
				this.blinkInterval = setInterval(() => {
					this.color =
						this.color === this.activeColor
							? this.inactiveColor
							: this.activeColor
				}, this.duration)
			} else {
				clearInterval(this.blinkInterval)
				this.color = this.inactiveColor
			}
		},
	},
	mounted() {
		this.color = this.inactiveColor
	},
	beforeDestroy() {
		clearInterval(this.blinkInterval)
	},
}
</script>
