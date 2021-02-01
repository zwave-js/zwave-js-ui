<template>
  <v-data-table
    :headers="activeHeaders"
    :items="tableNodes"
    :mobile-breakpoint="0"
    :footer-props="{
      itemsPerPageOptions: [10, 20, 50, 100, -1]
    }"
    :sort-desc.sync="sorting.desc"
    :sort-by.sync="sorting.by"
    :group-by="groupBy"
    :expanded.sync="expanded"
    :value="selected"
    @update:group-by="groupBy = $event"
    @group="groupBy = $event"
    @input="selected = $event"
    @click:row="toggleExpanded($event)"
    :items-per-page.sync="itemsPerPage"
    item-key="id"
    class="elevation-1"
    show-expand
    show-select
  >
    <template v-slot:top>
      <v-layout row wrap>
        <v-flex xs12 sm3 md2 ml-6>
          <v-switch label="Show hidden nodes" v-model="showHidden"></v-switch>
        </v-flex>
      </v-layout>
      <v-layout row ma-2 justify-start>
        <v-flex xs12>
          <v-menu v-model="headersMenu" :close-on-content-click="false">
            <template v-slot:activator="{ on }">
              <v-btn v-on="on">
                <v-icon>menu</v-icon>
                Columns
              </v-btn>
            </template>
            <v-card>
              <v-card-text>
                <v-checkbox
                  v-for="col in headers"
                  :key="col.value"
                  :value="col.value"
                  hide-details
                  :label="col.text"
                  v-model="columns"
                ></v-checkbox>
              </v-card-text>
            </v-card>
          </v-menu>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                color="blue darken-1"
                text
                v-on="on"
                @click.native="filterSelected()"
                :disabled="selected.length === 0"
                >Filter Selected</v-btn
              >
            </template>
            <span>Show only selected nodes</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                color="blue darken-1"
                text
                v-on="on"
                @click.native="resetFilters()"
                >Reset Filters</v-btn
              >
            </template>
            <span>Reset all column filters</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn text color="green" v-on="on" @click="$emit('importNodes')">
                IMPORT
              </v-btn>
            </template>
            <span>Import nodes.json Configuration</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                text
                color="purple"
                v-on="on"
                @click="$emit('exportNodes')"
              >
                EXPORT
              </v-btn>
            </template>
            <span>Export nodes.json Configuration</span>
          </v-tooltip>
        </v-flex>
      </v-layout>
    </template>
    <template
      v-for="column in activeHeaders"
      v-slot:[`header.${column.value}`]="{ header }"
    >
      <span :key="column.value">
        <column-filter
          :column="column"
          :value="filters[`${column.value}`] || {}"
          :items="values[`${column.value}`] || {}"
          @change="changeFilter(column.value, $event)"
          @update:group-by="groupBy = $event"
        ></column-filter>
        {{ header.text }}
      </span>
    </template>
    <template
      v-slot:[`group.header`]="{ group, headers, toggle, remove, isOpen }"
    >
      <td :colspan="headers.length">
        <v-btn @click="toggle" x-small icon :ref="group">
          <v-icon>{{ isOpen ? 'remove' : 'add' }}</v-icon>
        </v-btn>
        <span>{{ groupByTitle(groupBy, group) }}</span>
        <v-btn x-small icon @click="remove"><v-icon>close</v-icon></v-btn>
      </td>
    </template>
    <template v-slot:[`item.manufacturer`]="{ item }">
      {{ item.ready ? item.manufacturer : '' }}
    </template>
    <template v-slot:[`item.productDescription`]="{ item }">
      {{ item.ready ? item.productDescription : '' }}
    </template>
    <template v-slot:[`item.productLabel`]="{ item }">
      {{ item.ready ? item.productLabel : '' }}
    </template>
    <template v-slot:[`item.name`]="{ item }">
      {{ item.name || '' }}
    </template>
    <template v-slot:[`item.loc`]="{ item }">
      {{ item.loc || '' }}
    </template>
    <template v-slot:[`item.isSecure`]="{ item }">
      {{ item.isSecure ? 'Yes' : 'No' }}
    </template>
    <template v-slot:[`item.isBeaming`]="{ item }">
      {{ item.isBeaming ? 'Yes' : 'No' }}
    </template>
    <template v-slot:[`item.failed`]="{ item }">
      {{ item.failed ? 'Yes' : 'No' }}
    </template>
    <template v-slot:[`item.lastActive`]="{ item }">
      {{
        item.lastActive ? new Date(item.lastActive).toLocaleString() : 'Never'
      }}
    </template>
    <template v-slot:[`expanded-item`]="{ headers, item }">
      <expanded-node
        :actions="nodeActions"
        :headers="headers"
        :node="item"
        :nodes="nodes"
        :socket="socket"
        v-on="$listeners"
      />
    </template>
  </v-data-table>
</template>
<script src="./nodes-table.js"></script>
<style scoped src="./nodes-table.css"></style>
