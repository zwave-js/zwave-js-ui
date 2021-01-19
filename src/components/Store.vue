<template>
  <v-container fluid>
    <v-card>
        <v-row
      class="pa-4"
      justify="space-between"
    >
      <v-col cols="5">
        <v-treeview
        v-if="!loadingStore"
        :active.sync="active"
        :open="initiallyOpen"
        :items="items"
        activatable
        item-key="path"
        open-on-click
        return-object
        >
            <template v-slot:prepend="{ item, open }">
            <v-icon v-if="!item.ext">
                {{ open ? 'folder_open' : 'folder' }}
            </v-icon>
            <v-icon v-else>
                text_snippet
            </v-icon>
            </template>
        </v-treeview>
        <div v-else>
            <v-progress-circular
        indeterminate
        color="primary"
        style="align-self: center;"
        ></v-progress-circular>
        </div>
      </v-col>

      <v-divider vertical></v-divider>

      <v-col
        class="text-center"
      >
        <v-scroll-y-transition mode="out-in">
          <div
            v-if="!selected || !selected.ext"
            class="title grey--text text--lighten-1 font-weight-light"
            style="align-self: center;"
          >
            Select a file
          </div>
          <div
            v-else-if="loadingFile"
            class="title grey--text text--lighten-1 font-weight-light"
            style="align-self: center;"
          >
           <v-progress-circular
        indeterminate
        color="primary"
        style="align-self: center;"
        ></v-progress-circular>
          </div>
          <v-card
            v-else
            :key="selected.path"
            flat
          >
            <v-card-text>
                <prism-editor
                  lineNumbers
                  v-model="fileContent"
                  language="txt"
                  :highlight="highlighter"
                ></prism-editor>
            </v-card-text>
          </v-card>
        </v-scroll-y-transition>
      </v-col>
    </v-row>
    </v-card>
  </v-container>
</template>
<style>
/* optional class for removing the outline */
.prism-editor__textarea:focus {
  outline: none;
}
</style>
<script>
import ConfigApis from '@/apis/ConfigApis'

// import Prism Editor
import { PrismEditor } from 'vue-prism-editor'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'

export default {
  name: 'Store',
  components: {
    PrismEditor
  },
  watch: {
    selected () {
      this.fetchFile()
    }
  },
  computed: {
    selected () {
      if (!this.active.length) return undefined

      return this.active[0]
    }
  },
  data () {
    return {
      initiallyOpen: ['public'],
      active: [],
      items: [],
      fileContent: '',
      loadingStore: true,
      loadingFile: false
    }
  },
  methods: {
    showSnackbar (text) {
      this.$emit('showSnackbar', text)
    },
    highlighter (code) {
      return highlight(code, languages.js) // returns html
    },
    async fetchFile () {
      if (this.selected && this.selected.path) {
        this.loadingFile = true
        try {
          const data = await ConfigApis.getFile(this.selected.path)
          if (data.success) {
            this.fileContent = data.data
          } else {
            throw Error(data.message)
          }
        } catch (error) {
          this.showSnackbar(error.message)
        }

        this.loadingFile = false
      }
    }
  },
  mounted () {
    const self = this
    ConfigApis.getStore()
      .then(data => {
        if (data.success) {
          self.items = data.data
        } else {
          self.showSnackbar(data.message)
        }
      })
      .catch(error => {
        self.showSnackbar('Error while fetching store files')
        console.log(error)
      }).finally(() => {
        self.loadingStore = false
      })
  },
  beforeDestroy () {
  }
}
</script>
