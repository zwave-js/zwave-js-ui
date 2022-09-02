# Network graph

Network graph allows you to visualize your Zwave mesh network and check connectivity between nodes and the controller.

## Nodes Healthcheck

Nodes healthcheck is a feature that allows you to check connectivity health between your nodes and the controller.

In order to use this feature you need to open **Network Graph** tab, apply some filters in case you have big graph to only see the required nodes and then click on `Reload Graph`. At this point you can see your nodes and how them are connected to the controller.

![Load Graph](../_images/load_graph.gif)

By clicking on nodes like you see in previous gif a panel will open showing you all node informations and last working route informations (if available). At the bottom of this modal there is a button `CHECK HEALTH` that allows you to open a dialog that allows you perform health checks on that node. Depending on if the target node is the controller or a normal node the UI will perform a `lifeline healtcheck` or a `route healthcheck`.

![Lifeline health](../_images/lifeline_health.mp4 ':include :type=video controls width=100% height=600px')

In the example above we have checked the health of the node against the controller node (lifeline healthcheck). Route healthcheck results are a bit different:

![Route health results](../_images/route_health_result.png)

If you have problems understanding the results just open the info dialog by pressing on the `?` button and you will see a detailed explanation of the results, them are also available [here](https://zwave-js.github.io/node-zwave-js/#/api/node?id=checklifelinehealth).
