<template>
  <v-container fluid fill-height>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar dark color="primary">
            <v-avatar style="border-radius:0" size="40px">
              <img src="/static/logo.png" alt="Logo" />
            </v-avatar>
            <v-toolbar-title style="margin-left:20px"
              >Zwavejs2Mqtt</v-toolbar-title
            >
            <v-spacer></v-spacer>
          </v-toolbar>
          <v-card-text>
            <v-form
              v-model="valid_login"
              id="login-form"
              @submit.prevent="login"
              ref="form"
              lazy-validation
            >
              <v-text-field
                required
                :rules="[rules.required]"
                v-model.trim="username"
                autocomplete
                prepend-icon="person"
                name="username"
                label="Username"
                type="text"
              ></v-text-field>
              <v-text-field
                required
                :rules="[rules.required]"
                v-model="password"
                prepend-icon="lock"
                name="current-password"
                label="Password"
                autocomplete
                type="password"
              ></v-text-field>
              <v-checkbox
                v-model="rememberMe"
                prepend-icon="null"
                name="rememberMe"
                hide-details
                label="Remember Me"
              ></v-checkbox>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              style="min-width:150px;margin:10px"
              rounded
              type="submit"
              form="login-form"
              >Login</v-btn
            >
          </v-card-actions>
        </v-card>
        <v-alert dismissible :type="error_type" v-model="error">{{
          error_text
        }}</v-alert>
      </v-col>
    </v-row>
    <v-footer absolute class="pa-3">
      <v-spacer></v-spacer>
      <div>
        <strong>
          Innovation System &copy; {{ new Date().getFullYear() }}
        </strong>
      </div>
      <v-spacer></v-spacer>
    </v-footer>
  </v-container>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { Routes } from '@/router'

export default {
  data () {
    return {
      username: '',
      password: '',
      rememberMe: false,
      error_text: '',
      error_type: 'error',
      error: false,
      valid_login: true,
      rules: {
        required (value) {
          return !!value || 'This field is required.'
        }
      }
    }
  },
  watch: {
    error: function (newValue) {
      if (newValue) {
        setTimeout(function () {
          this.error = false
        }, 5000)
      }
    }
  },
  mounted () {
    if (this.isLocalStorageSupported()) {
      const user = localStorage.getItem('user')
        ? JSON.parse(localStorage.getItem('user'))
        : null

      const logged = !!localStorage.getItem('logged')

      if (user && user.rememberMe) {
        this.username = user.username || this.username
        this.password = user.password || this.password
        this.rememberMe = user.rememberMe
        if (logged) this.login(true)
      } else {
        localStorage.removeItem('user')
      }
    } else {
      this.error = true
      this.error_type = 'error'
      this.error_text = 'Local storage not supported'
    }
  },
  methods: {
    isLocalStorageSupported () {
      const testKey = 'test'
      const storage = window.localStorage
      try {
        storage.setItem(testKey, '1')
        storage.removeItem(testKey)
        return true
      } catch (error) {
        return false
      }
    },
    showSnackbar (text) {
      this.$emit('showSnackbar', text)
    },
    async login (forced) {
      if (!this.isLocalStorageSupported()) {
        this.error = true
        this.error_type = 'error'
        this.error_text = 'Local storage not supported'
        return
      }

      if (forced === true || this.$refs.form.validate()) {
        try {
          let user = {
            username: this.username,
            password: this.password
          }
          const response = await ConfigApis.login(user)

          if (!response.success) {
            if (response.message) this.error = true
            this.error_type = 'error'
            this.error_text = response.message
          } else {
            user = Object.assign(user, response.user)
            user.rememberMe = this.rememberMe
            localStorage.setItem('user', JSON.stringify(user))
            localStorage.setItem('logged', 'true')
            this.$store.dispatch('setUser', user)

            if (this.$route.params.nextUrl != null) {
              this.$router.push(this.$route.params.nextUrl)
            } else {
              this.$router.push(Routes.main)
            }
          }
        } catch (error) {
          console.log(error)
          this.error = true
          this.error_type = 'error'
          this.error_text = error.message
        }
      }
    }
  }
}
</script>
