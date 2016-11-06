'use strict'

const xml = require('@xmpp/xml')

const NS_STANZA = 'urn:ietf:params:xml:ns:xmpp-stanzas'

function addRequestHandler (entity, match, handle) {
  entity._iqMatchers.set(match, handle)
}

function handler (stanza) {
  if (
    !stanza.is('iq') ||
    !stanza.attrs.id ||
    stanza.attrs.type === 'error' ||
    stanza.attrs.type === 'result'
  ) return

  let matched

  const iq = xml`<iq to='${stanza.attrs.from}' from='${stanza.attrs.to}' id='${stanza.attrs.id}'/>`

  this._iqMatchers.forEach((handler, match) => {
    const matching = match(stanza)
    if (!matching) return
    matched = true

    function callback (err, res) {
      if (err) {
        iq.attrs.type = 'error'
        if (xml.isElement(err)) {
          iq.cnode(err)
        }
        // else // FIXME
      } else {
        iq.attrs.type = 'result'
        if (xml.isElement(res)) {
          iq.cnode(res)
        }
      }
    }

    const handled = handler(matching, callback)
    if (xml.isElement(handled)) callback(null, handled)
  })

  if (!matched) {
    iq.attrs.type === 'error'
    iq.cnode(stanza.children[0].clone())
    iq.c('error', {type: 'cancel'})
        .c('service-unavailable', NS_STANZA)
  }

  this.send(iq)
}

function plugin (entity) {
  entity._iqMatchers = new Map()
  entity.on('stanza', handler.bind(entity))
}

module.exports = {
  NS_STANZA,
  addRequestHandler,
  handler,
  plugin
}
