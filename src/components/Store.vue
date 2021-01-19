<template>
  <v-container fluid>
    <v-card height="800" style="margin-top:30px;">
      <v-row class="pa-4" justify="space-between" style="height:100%">
        <v-col class="scroll" cols="5">
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
                {{ open ? "folder_open" : "folder" }}
              </v-icon>
              <v-icon v-else>
                text_snippet
              </v-icon>
            </template>
            <template v-slot:append="{ item }">
              <v-layout row justify-end ma-1>
                <div class="caption grey--text">{{ item.size }}</div>
                <v-icon @click="deleteFile(item)" color="red">delete</v-icon>
              </v-layout>
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

        <v-col class="text-center scroll">
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
          <v-card v-else :key="selected.path" class="scroll" flat>
            <v-card-text class="scroll" style="height: calc(100% - 50px)">
                <prism-editor
                class="custom-font"
                  lineNumbers
                  v-model="fileContent"
                  language="js"
                  :highlight="highlighter"
                ></prism-editor>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="purple darken-1" text @click="writeFile">
          SAVE
          <v-icon right dark>file_upload</v-icon>
        </v-btn>
         <v-btn color="green darken-1" text @click="downloadFile">
          DOWNLOAD
          <v-icon right dark>file_download</v-icon>
        </v-btn>
            </v-card-actions>
          </v-card>
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

.custom-font {
    font-family: 'Fira Code', monospace;
}

.scroll {
  overflow-y: scroll;
  height: 100%;
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
    async deleteFile (item) {
      if (
        await this.$listeners.showConfirm(
          'Attention',
          `Are you sure you want to delete the file ${item.name}?`,
          'alert'
        )
      ) {
        try {
          const data = await ConfigApis.deleteFile(item.path)
          if (data.success) {
            this.showSnackbar('File deleted successfully')
            this.refreshTree()
          } else {
            throw Error(data.message)
          }
        } catch (error) {
          this.showSnackbar(error.message)
        }
      }
    },
    async downloadFile () {
      if (this.selected) {
        const fileName = this.selected.name.split('.')[0]
        this.$listeners.export(
          this.fileContent,
          fileName,
          this.selected.ext
        )
      }
    },
    async writeFile () {
      if (this.selected &&
        await this.$listeners.showConfirm(
          'Attention',
          `Are you sure you want to overwrite the content of the file ${this.selected.name}?`,
          'alert'
        )
      ) {
        try {
          const data = await ConfigApis.writeFile(this.selected.path, this.fileContent)
          if (data.success) {
            this.showSnackbar('File writed successfully')
            this.refreshTree()
          } else {
            throw Error(data.message)
          }
        } catch (error) {
          this.showSnackbar(error.message)
        }
      }
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
    },
    async refreshTree () {
      try {
        const data = await ConfigApis.getStore()
        if (data.success) {
          this.items = data.data
        } else {
          throw Error(data.message)
        }
      } catch (error) {
        this.showSnackbar('Error while fetching store files: ' + error.message)
        console.log(error)
      }

      this.loadingStore = false
      this.loadingFile = false
      this.active = []
    }
  },
  async mounted () {
    await this.refreshTree()
  },
  beforeDestroy () {}
}
</script>
