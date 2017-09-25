var bankaiHttp = require('./')
var http = require('http')
var path = require('path')

var entry = path.join(__dirname, './example-client.js')
var compiler = bankaiHttp(entry)

http.createServer(function (req, res) {
  compiler(req, res, function (err) {
    if (err) {
      res.statusCode = err.statusCode || 404
      res.end(err)
    }
  })
}).listen(3000)
