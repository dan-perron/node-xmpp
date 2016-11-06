'use strict'

const Component = require('@xmpp/component')
const callee = require('@xmpp/iq-callee')
const caller = require('@xmpp/iq-caller')
const xml = require('@xmpp/xml')
const JID = require('@xmpp/jid')
const path = require('path')
const fs = require('fs')
const iqHandlers = require('./iq-handlers')
const entity = new Component()
const presences = require('../presences')
const subscriptions = require('./subscriptions')

callee.plugin(entity)
caller.plugin(entity)

iqHandlers.forEach(({match, handle}) => {
  callee.addRequestHandler(entity, match, handle)
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
      subscriptions.put(from, {})
    } else if (type === 'unavailable') {
      presences.set(hash, 'show', 'unavailable')
    } else if (type === 'probe') {
      entity.send(xml`<presence to='${from}'/>`)
    } else if (type === undefined || type === 'available') {
      const show = stanza.getChild('show')
      if (show && show.text()) presences.set(hash, 'show', show.text())
      else presences.set(hash, 'show', 'available')
      const status = stanza.getChild('status')
      if (status && status.getText()) presences.set(hash, 'status', status.text())
      const vcardEl = stanza.getChild('x', 'vcard-temp:x:update')
      if (vcardEl) {
        const photo = vcardEl.getChild('photo')
        if (photo && photo.text()) {
          const cached = presences.get(hash, 'avatar') || {}
          if (cached.hash === photo.text()) return
          caller.get(entity, jid, xml`<vCard xmlns='vcard-temp'/>`).then((value) => {
            const photoEl = value.getChild('PHOTO')
            if (!photoEl) return
            const typeEl = photoEl.getChild('TYPE')
            const binvalEl = photoEl.getChild('BINVAL')
            if (typeEl && typeEl.text() && binvalEl && binvalEl.text()) {
              const buf = new Buffer(binvalEl.text(), 'base64')
              fs.writeFile(path.join(__dirname, '../avatars/', hash), buf, (err) => {
                if (err) return console.error(err)
                else {
                  const avatar = {
                    type: typeEl.text(),
                    size: buf.length,
                    hash: photo.text()
                  }
                  presences.set(hash, 'avatar', avatar)
                  subscriptions.put(jid, {avatar})
                }
              })
            }
          })
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
      Object.values(presences.store).forEach(({jid}) => {
        entity.send(xml`<presence type='probe' to='${jid}'/>`)
      })
    })
}
