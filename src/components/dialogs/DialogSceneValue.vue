<template>
  <v-dialog v-model="value" max-width="500px" persistent>
    <v-card>
      <v-card-title>
        <span class="headline">{{ title }}</span>
      </v-card-title>

      <v-card-text>
        <v-container grid-list-md>
          <v-form v-model="valid" ref="form" lazy-validation>
            <v-layout wrap>
              <v-flex xs12>
                <v-select
                  v-model="editedValue.node"
                  label="Node"
                  required
                  return-object
                  item-text="_name"
                  :rules="[required]"
                  item-value="node_id"
                  :items="nodes.filter(n => !!n)"
                ></v-select>
              </v-flex>
              <v-flex v-if="editedValue.node" xs12>
                <v-select
                  v-model="editedValue.value"
                  label="Value"
                  required
                  return-object
                  item-text="label"
                  :rules="validValue"
                  item-value="value_id"
                  :items="editedValue.node.values"
                ></v-select>
              </v-flex>
              <v-flex v-if="editedValue.value" xs12>
                <ValueID disable_send v-model="editedValue.value"></ValueID>
              </v-flex>
              <v-flex xs12>
                <v-text-field
                  v-model.number="editedValue.timeout"
                  label="Timeout"
                  hint="Seconds to wait before send this value. Set to 0 to send immediatly"
                  suffix="s"
                  :rules="[positive]"
                  required
                  type="number"
                ></v-text-field>
              </v-flex>
            </v-layout>
          </v-form>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" flat @click="$emit('close')">Cancel</v-btn>
        <v-btn color="blue darken-1" flat @click="$refs.form.validate() && $emit('save')">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import ValueID from '@/components/ValueId'

export default {
  components: {
    ValueID
  },
  props: {
    value: Boolean,
    title: String,
    editedValue: Object,
    nodes: Array
  },
  watch: {
    value (val) { // eslint-disable-line no-unused-vars
      this.$refs.form.resetValidation()
    }
  },
  data () {
    return {
      valid: true,
      required: v => !!v || 'This field is required',
      positive: v => v >= 0 || 'Value must be positive',
      validValue: [
        v => !!v || 'This field is required',
        v => (v && !v.read_only) || 'This value is Read Only',
        v =>
          (v && ['button', 'raw', 'schedule'].indexOf(v.type) < 0) ||
          'Type not allowed'
      ]
    }
  }
}
</script>
