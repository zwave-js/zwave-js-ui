var appRoot = require('app-root-path'),
path = require('path');

module.exports = {
  getPath: function(write){
    if(write && process.pkg) return process.cwd();
    else return appRoot.toString();
  },
  joinPath: function(...paths){
    return path.join(...paths);
  }
}
