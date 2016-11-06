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
const cache = require('../cache')
const caps = require('@xmpp/entity-capabilities')
const {disco} = require('./iq-handlers/discoinfo')
const hash = caps.hash(disco)

callee.plugin(entity)
caller.plugin(entity)

iqHandlers.forEach(({match, handle}) => {
  callee.addRequestHandler(entity, match, handle)
})

function updateAvatar (hash, jid, photoHash) {
  const cached = presences.get(hash, 'avatar') || {}
  if (cached.hash === photoHash) return
  caller.get(entity, jid, xml`<vCard xmlns='vcard-temp'/>`).then((value) => {
    const photoEl = value.getChild('PHOTO')
    if (!photoEl) return
    const type = photoEl.getChildText('TYPE')
    const binval = photoEl.getChildText('BINVAL')
    if (type && binval) {
      const buf = new Buffer(binval, 'base64')
      fs.writeFile(path.join(__dirname, '../avatars/', hash), buf, (err) => {
        if (err) return console.error(err)
        else {
          const avatar = {
            type: type,
            size: buf.length,
            hash: photoHash
          }
          presences.set(hash, 'avatar', avatar)
          cache.put(jid, {avatar})
        }
      })
    }
  })
}

entity.on('stanza', (stanza) => {
  const {from, type} = stanza.attrs
  if (!from) return
  const jid = JID(from).bare().toString()
  const hash = presences.hash(jid)

  if (stanza.is('presence')) {
    const nick = stanza.getChildText('nick', 'http://jabber.org/protocol/nick')
    if (nick) presences.set(hash, 'nick', nick)

    if (type === 'subscribe') {
      entity.send(xml`<presence to='${from}' type='subscribed'/>`)
      entity.send(xml`<presence to='${from}' type='subscribe'/>`)

    } else if (type === 'unsubscribed') {
      entity.send(xml`<presence to='${from}' type='unsubscribe'/>`)
      cache.del(from)
      presences.forget(hash)

    } else if (type === 'subscribed') {
      cache.put(from, {})

    } else if (type === 'unavailable') {
      presences.set(hash, 'show', 'unavailable')

    } else if (type === 'probe') {
      entity.send(xml`<presence to='${from}'/>`)

    } else if (type === undefined || type === 'available') {
      presences.set(hash, 'show', stanza.getChildText('show') || 'available')
      presences.set(hash, 'status',  stanza.getChildText('status') || '')
      const vcardEl = stanza.getChild('x', 'vcard-temp:x:update')
      if (vcardEl && vcardEl.getChildText('photo')) {
        updateAvatar(hash, jid, vcardEl.getChildText('photo'))
      }
    }

  } else if (stanza.is('message') && type === 'headline') {
    const eventEl = stanza.getChild('event', 'http://jabber.org/protocol/pubsub#event')
    const itemsEl = eventEl.getChild('items')
    const {node} = itemsEl.attrs
    if (node === 'http://jabber.org/protocol/nick') {
      const itemEl = itemsEl.getChild('item')
      const nick = itemEl.getChildText('nick', 'http://jabber.org/protocol/nick')
      if (typeof nick === 'string') presences.set(hash, 'nick', nick)
    }
  }
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
        entity.send(xml`
          <presence to='${jid}'>
            <c xmlns='http://jabber.org/protocol/caps'
              hash='sha-1'
              node='ubiquity'
              ver='${hash}'/>
          </presence>
        `)
        entity.send(xml`<presence type='probe' to='${jid}'/>`)
      })
    })
}
