import draggable from 'vuedraggable'
import { ManagedItems } from '@/modules/ManagedItems.js'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'
import { mapGetters } from 'vuex'

export default {
  props: {
    nodeActions: Array,
    socket: Object
  },
  components: {
    draggable,
    ColumnFilter,
    ExpandedNode
  },
  watch: {},
  computed: {
    ...mapGetters(['nodes'])
  },
  data: function () {
    return {
      managedNodes: null,
      nodesProps: {
        id: { type: 'number', label: 'ID', groupable: false },
        manufacturer: { type: 'string', label: 'Manufacturer' },
        productDescription: { type: 'string', label: 'Product' },
        productLabel: { type: 'string', label: 'Product code' },
        name: { type: 'string', label: 'Name' },
        loc: { type: 'string', label: 'Location' },
        isSecure: { type: 'boolean', label: 'Secure' },
        supportsBeaming: { type: 'boolean', label: 'Beaming' },
        failed: { type: 'boolean', label: 'Failed' },
        status: { type: 'string', label: 'Status' },
        interviewStage: { type: 'string', label: 'Interview' },
        lastActive: { type: 'date', label: 'Last Active', groupable: false }
      },
      expanded: [],
      headersMenu: false
    }
  },
  methods: {
    toggleExpanded (item) {
      this.expanded = this.expanded.includes(item)
        ? this.expanded.filter(i => i !== item)
        : [...this.expanded, item]
    }
  },
  mounted () {
    this.managedNodes = new ManagedItems(
      this.nodes,
      this.nodesProps,
      localStorage,
      'nodes_'
    )
  }
}
