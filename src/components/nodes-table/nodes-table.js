import { ManagedItems } from '@/modules/ManagedItems'
import { Settings } from '@/modules/Settings'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'

export default {
  props: {
    nodeActions: Array,
    nodes: Array,
    socket: Object
  },
  components: {
    ColumnFilter,
    ExpandedNode
  },
  data: function () {
    return {
      settings: new Settings(localStorage),
      managedNodes: new ManagedItems(
        this.nodes || [],
        {
          id: { type: 'number', label: 'ID', groupable: false },
          manufacturer: { type: 'string', label: 'Manufacturer' },
          productDescription: { type: 'string', label: 'Product' },
          productLabel: { type: 'string', label: 'Product code' },
          name: { type: 'string', label: 'Name' },
          loc: { type: 'string', label: 'Location' },
          isSecure: { type: 'boolean', label: 'Secure' },
          isBeaming: { type: 'boolean', label: 'Beaming' },
          failed: { type: 'boolean', label: 'Failed' },
          status: { type: 'string', label: 'Status' },
          interviewStage: { type: 'string', label: 'Interview stage' },
          lastActive: { type: 'date', label: 'Last Active', groupable: false }
        },
        localStorage,
        'nodes_'
      ),
      showHidden: undefined,
      itemsPerPage: undefined,
      columns: undefined,
      groupBy: undefined,
      expanded: [],
      filters: {},
      sorting: {},
      selected: [],
      headersMenu: false
    }
  },
  methods: {
    filterSelected () {
      this.managedNodes.filterSelected()
    },
    initColumns () {
      return this.headers.reduce((values, col) => {
        values = values || []
        values.push(col.value)
        return values
      }, [])
    },
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
    toggleExpanded (item) {
      this.expanded = this.expanded.includes(item)
        ? this.expanded.filter(i => i !== item)
        : [...this.expanded, item]
    }
  },
  created () {
    this.showHidden = this.settings.load('nodes_showHidden', false)
  },
  watch: {
    showHidden (val) {
      this.settings.store('nodes_showHidden', val)
    },
    relevantNodes (val) {
      this.managedNodes.setItems(val)
    }
  },
  computed: {
    headers () {
      return this.managedNodes.getAllTableHeaders()
    },
    relevantNodes () {
      return this.nodes.filter(node => (this.showHidden ? true : !node.failed))
    }
  }
}
