'use strict'

module.exports.match = function (iq) {
  return iq.getChild('query', 'urn:xmpp:ping')
}

module.exports.handle = function (match, cb) {
  cb()
}
