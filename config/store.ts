// config/store.js

export interface StoreFile {
  file: string; 
  default: any
}

export interface User {
  username: string,
  passwordHash: string,
  token?: string
}

const store: { [key: string]: StoreFile } = {
  settings : { file: 'settings.json', default: {} },
  scenes : { file: 'scenes.json', default: [] },
  nodes : { file: 'nodes.json', default: [] },
  users : { file: 'users.json', default: [] }
}

export default store
