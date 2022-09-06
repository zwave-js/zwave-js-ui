# Network graph

Network graph allows you to visualize your Zwave mesh network and check connectivity issues between nodes and the controller.

## Nodes Healthcheck

In order to use this feature you need to open **Network Graph** tab, apply some filters in case you have big graph to only see required nodes and then click on `Reload Graph`. At this point you can see your nodes and how them are connected to the controller.

![Load Graph](../_images/load_graph.gif)

By clicking on nodes (see previous video) a panel will open containing more detailed node information, including the last working route (if supported by your stick). At the bottom of this panel there is a button `CHECK HEALTH` that opens a dialog that allows to perform health checks on that node.

When the target node is the controller, this check will be a **Lifeline healthcheck**, for other nodes a **Route healthcheck**.

![Lifeline health](../_images/lifeline_health.mp4 ':include :type=video controls width=100% height=600px')

In the example above we have checked the health of the node against the controller node (lifeline healthcheck). Route healthcheck results contain less information, some of which depends on what the node supports:

![Route health results](../_images/route_health_result.png)

If you have problems understanding the results, just open the info dialog by pressing on the `?` button and you will see a detailed explanation of the results. This explanation is also available [here](https://zwave-js.github.io/node-zwave-js/#/api/node?id=checklifelinehealth).
