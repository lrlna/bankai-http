# bankai-http
Bankai HTTP handler

# Usage
```js
var bankaiHttp = require('bankai-http')
var http = require('http')
var path = require('path')

var entry = path.join(__dirname, 'client.js')
var compiler = bankaiHttp(entry)

http.createHttpServer(function (req, res) {
  compiler(req, res, function (err) {
    if (err) {
      res.statusCode = err.statusCode || 404
      res.end(err)
    }
    router(req, res)
  })
})
```
