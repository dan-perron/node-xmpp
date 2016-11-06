'use strict'

const express = require('express')
const server = express()
const presences = require('./presences')

server.get('/:hash/status', (req, res, next) => {
  const status = presences.get(req.params.hash, 'status')
  res.send(status || 'unavailable')
})

// https://presence.jabberfr.org/ddeb37b0fb1b79ff5a850f92e05bcf6e/text-en.txt

module.exports.start = function () {
  return new Promise((resolve, reject) => {
    server.listen(4545, err => {
      if (err) return reject(err)
      console.log('HTTP server listening on', 4545)
      resolve()
    })
  })
}
