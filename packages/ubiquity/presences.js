'use strict'

const crypto = require('crypto')

const presences = Object.create(null)

module.exports = {
  hash(jid) {
    return crypto
      .createHash('md5')
      .update(jid.toString())
      .digest('hex')
  },
  set(hash, key, value) {
    if (!presences[hash]) presences[hash] = Object.create(null)
    presences[hash][key] = value
  },
  get(hash, key) {
    console.log(presences, hash)
    if (!presences[hash]) return undefined
    return presences[hash][key]
  },
  del(hash, key) {
    if (!presences[hash]) return
    delete presences[hash][key]
  },
  forget(hash) {
    delete presences[hash]
  }
}
