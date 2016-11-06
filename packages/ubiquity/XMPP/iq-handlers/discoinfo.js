'use strict'

const xml = require('@xmpp/xml')
const pkg = require('../../package.json')
const crypto = require('crypto')

const disco = xml`
  <query xmlns='http://jabber.org/protocol/disco#info'>
    <feature var='http://jabber.org/protocol/disco#info'/>
    <feature var='jabber:iq:version'/>
    <feature var='urn:xmpp:ping'/>
    <feature var='http://jabber.org/protocol/tune+notify'/>
    <feature var='http://jabber.org/protocol/activity+notify'/>
    <feature var='http://jabber.org/protocol/mood+notify'/>
    <feature var='http://jabber.org/protocol/geoloc+notify'/>
    <feature var='http://jabber.org/protocol/nick+notify'/>
    <identity
      category='component'
      type='presence'
      name='${pkg.name}'
    />
  </query>
`

module.exports.disco = disco

module.exports.match = function (iq) {
  return iq.getChild('query', 'http://jabber.org/protocol/disco#info')
}

module.exports.handle = function () {
  return disco
}
