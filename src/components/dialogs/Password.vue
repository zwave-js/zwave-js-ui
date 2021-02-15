<template>
  <!-- DIALOG PASSWORD -->
  <v-dialog v-model="show" @click:outside="$emit('close')" max-width="500px">
    <v-card>
      <v-card-title>
        <span class="headline">Password Change</span>
      </v-card-title>
      <v-card-text>
        <v-container grid-list-md>
          <v-form v-model="valid" ref="form" lazy-validation>
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  :rules="[required]"
                  v-model="password.current"
                  label="Current Password"
                  type="password"
                  hint="Insert here the current password"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  :rules="[required]"
                  v-model="password.new"
                  label="New Password"
                  type="password"
                  hint="Insert here the new password"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  :rules="[required, passwordMatch]"
                  v-model="password.confirmNew"
                  type="password"
                  label="Confirm new password"
                  hint="Confirm the new password"
                  required
                ></v-text-field>
              </v-col>
            </v-row>
          </v-form>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="closeDialog()">Close</v-btn>
        <v-btn color="primary" :disabled="!valid" text @click="updatePassword()"
          >Save</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- END DIALOG PASSWORD -->
</template>

<script>
export default {
  name: 'Password',
  props: {
    show: Boolean,
    password: Object
  },
  watch: {
    show () {
      this.$refs.form.reset()
    }
  },
  data () {
    return {
      valid: true,
      required (v) {
        return !!v || 'This is required'
      }
    }
  },
  computed: {
    passwordMatch () {
      return (
        this.password.new === this.password.confirmNew ||
        "Password doesn't match"
      )
    }
  },
  methods: {
    updatePassword: function () {
      if (this.$refs.form.validate()) {
        this.$emit('updatePassword')
      }
    },
    closeDialog: function () {
      this.$emit('close')
    }
  }
}
</script>
