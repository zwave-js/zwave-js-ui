<template>
  <v-menu :value="show" :close-on-content-click="false" :offset-y="true">
    <template v-slot:activator="{ on, attrs }">
      <v-icon
        small
        v-on:click="showOptions()"
        v-bind="attrs"
        v-on="on"
        title="Filter options..."
      >
        {{ hasFilter ? 'filter_list_alt' : 'filter_list' }}
      </v-icon>
    </template>
    <v-card>
      <v-icon small v-on:click="hideOptions()" right>close</v-icon>
      <v-card-text>
        <v-row v-if="value && value.type == 'string'">
          <v-col>
            <v-text-field
              ref="search"
              label="Contains"
              v-model="value.search"
              clearable
              @change="hideOptions()"
              @show="$refs.search.$el.focus()"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row v-if="value && value.type == 'number'">
          <v-col>
            <v-text-field
              type="number"
              label="Min"
              v-model="value.min"
              clearable
            ></v-text-field>
          </v-col>
          <v-col>
            <v-text-field
              type="number"
              label="Max"
              v-model="value.max"
              clearable
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row v-if="value && value.type == 'date'">
          <v-col>
            <v-text-field
              type="datetime-local"
              label="From"
              v-model="value.min"
              clearable
            ></v-text-field>
            <v-text-field
              type="datetime-local"
              label="Until"
              v-model="value.max"
              clearable
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row
          v-if="value && (value.type == 'string' || value.type == 'number')"
        >
          <v-col>
            <v-select
              v-model="value.selections"
              :items="items"
              label="Selection"
              clearable
              chips
              deletableChips
              dense
              multiple
            ></v-select>
          </v-col>
        </v-row>
        <v-row v-if="value && value.type == 'boolean'">
          <v-col>
            <v-checkbox
              :indeterminate="value.bool == undefined || value.bool == null"
              v-model="value.bool"
              label="Boolean value"
            ></v-checkbox>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="clearFilter()">Clear</v-btn>
        <v-btn color="primary" @click="hideOptions()">Ok</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script>
export default {
  props: {
    value: {
      type: Object
    },
    items: {
      type: Array
    }
  },
  data () {
    return {
      show: false
    }
  },
  computed: {
    hasFilter () {
      return (
        this.value !== undefined &&
        this.value !== null &&
        ((this.value.search !== undefined &&
          this.value.search !== null &&
          this.value.search !== '') ||
          (this.value.selections !== undefined &&
            this.value.selections !== null &&
            this.value.selections.length > 0) ||
          (this.value.min !== undefined && this.value.min !== null) ||
          (this.value.max !== undefined && this.value.max !== null) ||
          (this.value.bool !== undefined && this.value.bool !== null))
      )
    }
  },
  methods: {
    showOptions () {
      this.show = true
    },
    hideOptions () {
      this.show = false
    },
    clearFilter () {
      this.value.search = null
      this.value.selections = []
      this.value.min = null
      this.value.max = null
      this.value.bool = null
    }
  }
}
</script>
