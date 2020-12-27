import { NodeCollection } from '@/modules/NodeCollection'
import { Settings } from '@/modules/Settings'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'

export default {
  props: {
    nodes: Array,
    showHidden: Boolean
  },
  components: {
    ColumnFilter
  },
  data: () => ({
    settings: new Settings(localStorage),
    nodeTableItems: undefined,
    selectedNode: undefined,
    filters: {},
    sorting: {},
    headers: [
      { text: 'ID', type: 'number', value: 'id' },
      { text: 'Manufacturer', type: 'string', value: 'manufacturer' },
      { text: 'Product', type: 'string', value: 'productDescription' },
      { text: 'Product code', type: 'string', value: 'productLabel' },
      { text: 'Name', type: 'string', value: 'name' },
      { text: 'Location', type: 'string', value: 'loc' },
      { text: 'Secure', type: 'boolean', value: 'isSecure' },
      { text: 'Beaming', type: 'boolean', value: 'isBeaming' },
      { text: 'Failed', type: 'boolean', value: 'failed' },
      { text: 'Status', type: 'string', value: 'status' },
      { text: 'Interview stage', type: 'string', value: 'interviewStage' },
      { text: 'Last Active', type: 'date', value: 'lastActive' }
    ]
  }),
  methods: {
    initFilters () {
      return this.headers.reduce((values, h) => {
        values[h.value] = {}
        return values
      }, {})
    },
    initSorting () {
      return {
        by: ['id'],
        desc: [false]
      }
    },
    loadSetting (key, defaultVal) {
      return this.settings.load(key, defaultVal)
    },
    storeSetting (key, val) {
      this.settings.store(key, val)
    },
    changeFilter (colName, $event) {
      this.filters = this.filters ? this.filters : {}
      this.filters[colName] = $event
      this.storeSetting('nodes_filters', this.filters)
    },
    resetFilter () {
      this.filters = this.initFilters()
      this.storeSetting('nodes_filters', this.filters)
    },
    nodeSelected (node) {
      this.selectedNode = node
      this.$emit('node-selected', { node })
    }
  },
  created () {
    this.filters = this.loadSetting('nodes_filters', this.initFilters())
    this.sorting = this.loadSetting('nodes_sorting', this.initSorting())
    this.nodeTableItems = this.loadSetting('nodes_itemsPerPage', 10)
  },
  watch: {
    nodeTableItems (val) {
      this.storeSetting('nodes_itemsPerPage', val)
    },
    sorting: {
      handler (val) {
        this.storeSetting('nodes_sorting', val)
      },
      deep: true
    }
  },
  computed: {
    nodeCollection () {
      return new NodeCollection(this.nodes)
    },
    relevantNodes () {
      return this.nodeCollection.filter('failed', failed => {
        return this.showHidden ? true : !failed
      })
    },
    filteredNodes () {
      return ColumnFilterHelper.filterByFilterSpec(
        this.relevantNodes,
        this.headers,
        this.filters
      )
    },
    values () {
      return this.headers.reduce((values, h) => {
        values[h.value] = this.relevantNodes.values(h.value)
        return values
      }, {})
    },
    tableNodes () {
      return this.filteredNodes.nodes
    }
  }
}
