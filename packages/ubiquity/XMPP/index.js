'use strict'

const Component = require('@xmpp/component')
const iqCallee = require('@xmpp/iq-callee')
const xml = require('@xmpp/xml')
const JID = require('@xmpp/jid')
const iqHandlers = require('./iq-handlers')
const entity = new Component()
const presences = require('../presences')
const subscriptions = require('./subscriptions')

iqCallee.plugin(entity)

iqHandlers.forEach(({match, handle}) => {
  iqCallee.addRequestHandler(entity, match, handle)
})

entity.on('stanza', (stanza) => {
  if (stanza.is('presence')) {
    const {from, type} = stanza.attrs
    if (!from) return
    const jid = JID(from).bare().toString()
    const hash = presences.hash(jid)
    if (type === 'subscribe') {
      entity.send(xml`<presence to='${from}' type='subscribed'/>`)
      entity.send(xml`<presence to='${from}' type='subscribe'/>`)
    } else if (type === 'unsubscribed') {
      entity.send(xml`<presence to='${from}' type='unsubscribe'/>`)
      subscriptions.del(from)
      presences.forget(hash)
    } else if (type === 'subscribed') {
      subscriptions.put(from, '')
    } else if (type === 'unavailable') {
      presences.set(hash, 'status', 'unavailable')
    } else if (type === 'probe') {
      entity.send(xml`<presence to='${from}'/>`)
    } else if (type === undefined || type === 'available') {
      // const show = stanza.getChild('show')
      // const status = stanza.getChild('status')
      presences.set(hash, 'status', 'available')
      const vcardEl = stanza.getChild('x', 'vcard-temp:x:update')
      if (vcardEl) {
        const photo = vcardEl.getChild('photo')
        if (photo && photo.text()) {
          entity.send(xml`
            <iq to='${jid}' type='get'>
              <vCard xmlns='vcard-temp'/>
            </iq>
          `)
        }
      }
    }
  }
  // <presence type='subscribe' to='ubiquity.localhost' from='sonny@localhost' id='e659394d-2174-4482-b557-613759b21468'>
  //   <nick xmlns='http://jabber.org/protocol/nick'>sonny</nick>
  //   <x xmlns='vcard-temp:x:update'/>
  //   <c ver='R9UmbqHoJP+gSo7KAFGnuVU21s0=' hash='sha-1' node='http://gajim.org' xmlns='http://jabber.org/protocol/caps'/>
  //   <status>Hello, I am sonny. I would like to add you to my contact list.</status>
  // </presence>

})

entity.once('error', (err) => {
  console.error('error', err)
})

entity.on('fragment', (output, input) => {
  console.log(output ? '=>' : '<=', (output || input).trim())
})

entity.on('authenticate', authenticate => {
  authenticate('foobar')
    .catch((err) => {
      console.error('authentication failed', err)
    })
})

entity.on('close', () => {
  console.log('closed')
})

module.exports.start = function () {
  return entity.start('xmpp:ubiquity.localhost:5347')
    .then((jid) => {
      console.log('XMPP component', jid.toString(), 'online')
      subscriptions.createKeyStream().on('data', (key) => {
        entity.send(xml`<presence type='probe' to='${key}'/>`)
        entity.send(xml`
          <iq type='get'
              to='${key}'
              id='retrieve1'>
            <pubsub xmlns='http://jabber.org/protocol/pubsub'>
              <items node='urn:xmpp:avatar:data'/>
            </pubsub>
          </iq>
        `)
      })
    })
}
