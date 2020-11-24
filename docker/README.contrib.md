# Build from node-zwave-js git repo

In order to build a docker image from the master branch of the node-zwave-js, nake a small modification to package.json. Remove the zwave-js package from the file, like so:

```
$ git diff
diff --git a/package.json b/package.json
index 268bdda..c577a40 100644
--- a/package.json
+++ b/package.json
@@ -117,8 +117,7 @@
     "vue-prism-editor": "^1.2.2",
     "vue-router": "^3.4.3",
     "vuetify": "^2.3.10",
-    "vuex": "^3.5.1",
-    "zwave-js": "^5.5.0"
+    "vuex": "^3.5.1"
   },
   "devDependencies": {
     "@babel/core": "^7.11.5",
```

Keep the node-zwave-js repo and the zwavejs2mqtt repo in the same parent folder.

Build using this command, while being in the parent folder:

    docker build -t zwavejs2mqtt .
