<template>
  <v-data-table
    :headers="managedNodes.tableHeaders"
    :items="managedNodes.filteredItems"
    :footer-props="{
      itemsPerPageOptions: [10, 20, 50, 100, -1]
    }"
    :expanded.sync="expanded"
    :value="managedNodes.selected"
    :options="managedNodes.tableOptions"
    @update:options="managedNodes.tableOptions = $event"
    @input="managedNodes.selected = $event"
    @click:row="toggleExpanded($event)"
    item-key="id"
    class="elevation-1"
    show-expand
    show-select
  >
    <template v-slot:top>
      <v-row>
        <v-col cols="12" sm="3" md="2" class="ml-6">
          <v-switch label="Show hidden nodes" v-model="showHidden"></v-switch>
        </v-col>
      </v-row>
      <v-row class="ma-2" justify-start>
        <v-col cols="12">
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
                  v-for="col in managedNodes.allTableHeaders"
                  :key="col.value"
                  :value="col.value"
                  hide-details
                  :label="col.text"
                  :input-value="managedNodes.columns"
                  @change="managedNodes.columns = $event"
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
                @click.native="managedNodes.filterSelected()"
                :disabled="managedNodes.selected.length === 0"
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
                @click.native="managedNodes.reset()"
                >Reset Table</v-btn
              >
            </template>
            <span>Reset all table settings</span>
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
        </v-col>
      </v-row>
    </template>
    <template
      v-for="column in managedNodes.tableHeaders"
      v-slot:[`header.${column.value}`]="{ header }"
    >
      <span :key="column.value">
        <column-filter
          :column="column"
          :value="managedNodes.filters[column.value]"
          :items="managedNodes.propValues[column.value]"
          :group-by="managedNodes.groupBy === [column.value]"
          @change="managedNodes.setPropFilter(column.value, $event)"
          @update:group-by="managedNodes.groupBy = $event"
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
        <span>{{ managedNodes.groupByTitle }}: {{ group }}</span>
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
    <template v-slot:[`expanded-item`]="{ headers, item, isMobile }">
      <expanded-node
        :actions="nodeActions"
        :headers="headers"
        :isMobile="isMobile"
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
