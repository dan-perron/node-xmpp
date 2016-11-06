'use strict'

const xml = require('@xmpp/xml')
const id = function () {
  return Math.random().toString().substr(2)
}

function request (entity, stanza, options = {}) {
  return new Promise((resolve, reject) => {
    stanza = stanza.root()
    if (!stanza.attrs.id) stanza.attrs.id = id()

    entity._iqHandlers[stanza.attrs.id] = [resolve, reject]

    entity.send(stanza)
  })
}

function get (entity, to, el, options) {
  const iq = xml`<iq type='get' to='${to}'/>`
  iq.cnode(el)
  return request(entity, iq, options)
}

function set (entity, to, el, options) {
  const iq = xml`<iq type='set' to='${to}'/>`
  iq.cnode(el)
  return request(entity, iq, options)
}

function stanzaHandler (stanza) {
  const id = stanza.attrs.id
  if (
    !stanza.is('iq') ||
    !id ||
    (stanza.attrs.type !== 'error' && stanza.attrs.type !== 'result')
  ) return

  const handler = this._iqHandlers[id]
  if (!handler) return

  if (stanza.attrs.type === 'error') {
    handler[1](stanza.getChild('error'))
  } else {
    handler[0](stanza.children[0])
  }

  delete this._iqHandlers[id]
}

function plugin (entity) {
  entity._iqHandlers = Object.create(null)
  entity.on('stanza', stanzaHandler.bind(entity))
}

module.exports = {
  request,
  stanzaHandler,
  get,
  set,
  plugin
}
