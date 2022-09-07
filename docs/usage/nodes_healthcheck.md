# Nodes Healthcheck

In order to use this feature you need to open **Network Graph** tab, here you can visualize your Z-Wave mesh network and check connectivity issues between nodes and the controller.

If you have a large network, you might want to apply some filters to only see the relevant nodes. Then click on `Reload Graph`. At this point you can see your nodes and their connections.

> [!NOTE] In some networks, the neighbor information used to draw this graph can be wrong and nodes may appear to be not connected, even if they are. Refer to the route information (see below) to know how commands are actually routed.

![Load Graph](../_images/load_graph.gif)

By clicking on nodes (see previous video) a panel will open containing more detailed node information, including the last working route (if supported by your stick). At the bottom of this panel there is a button `CHECK HEALTH` that opens a dialog that allows to perform health checks on that node.

When the target node is the controller, this check will be a **Lifeline healthcheck**, for other nodes a **Route healthcheck**.

![Lifeline health](../_images/lifeline_health.mp4 ':include :type=video controls width=100% height=600px')

In the example above we have checked the health of the node against the controller node (lifeline healthcheck). Route healthcheck results contain less information, some of which depends on what the node supports:

![Route health results](../_images/route_health_result.png)

If you have problems understanding the results, just open the info dialog by pressing on the `?` button and you will see a detailed explanation of the results. This explanation is also available [here](https://zwave-js.github.io/node-zwave-js/#/api/node?id=checklifelinehealth).
