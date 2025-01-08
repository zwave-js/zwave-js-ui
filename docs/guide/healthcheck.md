# Health check endpoints

`/health`: Returns `200` if both mqtt and zwave client are connected, `500` otherwise
`/health/mqtt`: Returns `200` if mqtt client is connected, `500` otherwise
`/health/zwave`: Returns `200` if zwave client is connected, `500` otherwise

> [!NOTE]
> Remember to add the header: `Accept: text/plain` to your request.

Example:

Using `wget`:

`wget --no-verbose --spider --no-check-certificate --header "Accept: text/plain" http://localhost:8091/health`

Using `curl`:

`curl localhost:8091/health/zwave -H "Accept: text/plain"`
