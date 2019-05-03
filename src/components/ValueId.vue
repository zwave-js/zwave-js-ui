<template>
  <div v-if="value.read_only">
    <v-text-field
      :label="value.label +' ('+value.value_id+')'"
      disabled
      :suffix="value.units"
      :hint="value.help || ''"
      v-model="value.value"
    ></v-text-field>
  </div>

  <div v-else>
    <v-text-field
      v-if="['int', 'byte', 'short', 'decimal', 'string'].indexOf(value.type) >= 0"
      :label="value.label +' ('+value.value_id+')'"
      :type="value.type == 'string' ? 'text' : 'number'"
      :append-outer-icon="!disable_send ? 'send' : null"
      :suffix="value.units"
      :min="value.min != value.max ? value.min : null"
      :step="value.type == 'decimal' ? 0.1 : 1"
      :max="value.min != value.max ? value.max : null"
      :hint="value.help || ''"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
    ></v-text-field>

    <v-select
      v-if="value.type == 'list'"
      :items="value.values"
      :label="value.label +' ('+value.value_id+')'"
      :hint="value.help || ''"
      :append-outer-icon="!disable_send ? 'send' : null"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
    ></v-select>

    <v-switch
      v-if="value.type == 'bool'"
      :label="value.label +' ('+value.value_id+')'"
      :hint="value.help || ''"
      persistent-hint
      v-model="value.newValue"
      @change="updateValue(value)"
    ></v-switch>

    <v-tooltip right>
      <v-btn
        v-if="value.type == 'button'"
        slot="activator"
        color="primary"
        dark
        @click="updateValue(value)"
        class="mb-2"
      >{{value.label}}</v-btn>
      <span>{{' ('+value.value_id+')' + (value.help || '')}}</span>
    </v-tooltip>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: Object
    },
    disable_send: {
      type: Boolean
    }
  },
  methods: {
    updateValue(v) {
      this.$emit("updateValue", v);
    }
  }
};
</script>
