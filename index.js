var EventEmitter = require('events').EventEmitter
var gzipMaybe = require('http-gzip-maybe')
var router = require('reg-router')()
var bankai = require('bankai')
var pump = require('pump')

module.exports = bankaiHttp

function bankaiHttp (entry, opts) {
  var compiler = bankai(entry, opts)
  var emitter = new EventEmitter()
  var id = 0

  compiler.on('change', function (nodeName, edgeName, nodeState) {
    var node = nodeState[nodeName][edgeName]
    var name = nodeName + ':' + edgeName

    if (name === 'scripts:bundle') emitter.emit('scripts:bundle', node)
    if (name === 'style:bundle') emitter.emit('style:bundle', node)
  })

  return function (req, res, done) {
    router.route(/^\/manifest.json$/, function (req, res, params) {
      compiler.manifest(function (err, node) {
        err.statusCode = 404
        done(err)
        res.setHeader('content-type', 'application/json')
        gzip(node.buffer, req, res)
      })
    })

    router.route(/\/(service-worker\.js)|(\/sw\.js)$/, function (req, res, params) {
      compiler.serviceWorker(function (err, node) {
        err.statusCode = 404
        done(err)
        res.setHeader('content-type', 'application/javascript')
        gzip(node.buffer, req, res)
      })
    })

    router.route(/\/([a-zA-Z0-9-_]+)\.js$/, function (req, res, params) {
      var name = params[1]
      compiler.scripts(name, function (err, node) {
        err.statusCode = 404
        done(err)
        res.setHeader('content-type', 'application/javascript')
        gzip(node.buffer, req, res)
      })
    })

    router.route(/\/bundle.css$/, function (req, res, params) {
      compiler.style(function (err, node) {
        err.statusCode = 404
        done(err)
        res.setHeader('content-type', 'text/css')
        gzip(node.buffer, req, res)
      })
    })

    router.route(/^\/assets\/(.*)$/, function (req, res, params) {
      var prefix = 'assets' // TODO: also accept 'content'
      var name = prefix + '/' + params[1]
      compiler.assets(name, function (err, node) {
        err.statusCode = 404
        done(err)
        res.end(node.buffer)
      })
    })

    router.route(/\/reload/, function sse (req, res) {
      var connected = true
      emitter.on('scripts:bundle', reloadScript)
      emitter.on('style:bundle', reloadStyle)

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      })
      res.write('retry: 10000\n')

      var interval = setInterval(function () {
        res.write(`id:${id++}\ndata:{ "type:": "heartbeat" }\n\n`)
      }, 4000)

      // Attach an error handler, but no need to actually handle the error.
      // This is a bug in Node core according to mcollina which will be fixed
      // in a future Node release. Let's keep this in place as long as v8.x.x of
      // Node isn't in LTS yet.
      res.on('error', disconnect)
      req.on('error', disconnect)

      req.connection.addListener('close', disconnect, false)

      function disconnect () {
        clearInterval(interval)
        if (connected) {
          emitter.removeListener('scripts:bundle', reloadScript)
          emitter.removeListener('style:bundle', reloadStyle)
          connected = false
        }
      }

      function reloadScript (node) {
        var msg = JSON.stringify({ type: 'scripts' })
        res.write(`id:${id++}\ndata:${msg}\n\n`)
      }

      function reloadStyle (node) {
        var msg = JSON.stringify({
          type: 'style',
          bundle: node.buffer.toString()
        })
        res.write(`id:${id++}\ndata:${msg}\n\n`)
      }
    })
  }
}

function gzip (buffer, req, res) {
  var zipper = gzipMaybe(req, res)
  pump(zipper, res)
  zipper.end(buffer)
}
