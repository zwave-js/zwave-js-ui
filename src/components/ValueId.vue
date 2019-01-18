<template>

  <div v-if="value.read_only">
    <v-text-field
    :label="value.label"
    disabled
    :suffix="value.units"
    v-model="value.value"
    ></v-text-field>
  </div>

  <div v-else>
      <v-text-field
      v-if="['byte', 'short', 'decimal', 'string'].indexOf(value.type) >= 0"
      :label="value.label"
      :type="value.type == 'string' ? 'text' : 'number'"
      append-outer-icon="send"
      :suffix="value.units"
      :min="value.min"
      :max="value.max"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
      ></v-text-field>

      <v-select
      v-if="value.type == 'list'"
      :items="value.values"
      :label="value.label"
      append-outer-icon="send"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
      ></v-select>

      <v-switch
      v-if="value.type == 'bool'"
      :label="value.label"
      v-model="value.newValue"
      @change="updateValue(value)"
      ></v-switch>

      <v-btn
      v-if="value.type == 'button'"
      color="primary"
      dark
      @click="updateValue(value)"
      class="mb-2"
      >{{value.label}}</v-btn>

      <v-tooltip v-if="value.help" bottom>
        <v-icon
        style="cursor:default;"
        slot="activator"
        >help</v-icon>
        <span>{{value.help}}</span>
      </v-tooltip>

  </div>
</template>

<script>
  export default {
    props: {
      value: {
        type: Object
      }
    },
    methods: {
      updateValue(v){
        this.$emit('updateValue', v)
      },
    }
  }
</script>
