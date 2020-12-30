# Health check endpoints

`/health`: Returns `200` if both mqtt and zwave client are connected, `500` otherwise
`/health/mqtt`: Returns `200` if mqtt client is connected, `500` otherwise
`/health/zwave`: Returns `200` if zwave client is connected, `500` otherwise

Remember to add the header: `Accept: text/plain` to your request.

Example: `curl localhost:8091/health/zwave -H "Accept: text/plain"`
