<template>
  <v-dialog v-model="value" max-width="430px" persistent>
    <v-card>
      <v-card-title>
        <span class="headline">Add/Remove Device</span>
      </v-card-title>

      <v-card-text style="padding-bottom:0">
        <v-container fluid style="margin-top:-2rem">
          <v-radio-group v-model="mode" mandatory>
            <v-radio value="Inclusion">
              <template v-slot:label>
                <div class="option">
                  <v-icon color="green accent-4" small>add_circle</v-icon> <strong>Inclusion</strong>
                  <small>Add using non-secure mode (best for most devices)</small>
                </div>
              </template>
            </v-radio>
            <v-radio value="Secure inclusion">
              <template v-slot:label>
                <div class="option">
                  <v-icon color="amber accent-4" small>enhanced_encryption</v-icon> <strong>Secure Inclusion</strong>
                  <small>Add with security (best for locks/doors)</small>
                </div>
              </template>
            </v-radio>
            <v-radio value="Exclusion">
              <template v-slot:label>
                <div class="option">
                  <v-icon color="red accent-4" small>remove_circle</v-icon> <strong>Exclusion</strong>
                  <small>Remove device attached to existing network</small>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
        </v-container>

        <v-alert v-if="working" dense text type="warning">{{working}}</v-alert>
        <v-alert v-if="succeeded" dense text type="info">{{succeeded}}</v-alert>
        <v-alert v-if="failed" dense text type="error">{{failed}}</v-alert>

      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn v-if="!working" color="red darken-1" text @click="$emit('close')">Close</v-btn>
        <v-btn color="blue darken-1" text @click="$emit('action', { mode })">{{ working ? 'Stop' : 'Start' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>

export default {
  components: {
  },
  props: {
    value: Boolean, // show or hide
    working: String,
    failed: String,
    succeeded: String
  },
  watch: {
  },
  computed: {
  },
  data () {
    return {
      mode: 'Inclusion' // most common action should be default
    }
  },
  methods: {
  }
}
</script>

<style scoped>
.option {margin-top:1rem}
.option>small {color:#888;display:block;margin:-0.2rem 0 0 1.4rem}
</style>
