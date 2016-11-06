const xml = require('@xmpp/xml')
const pkg = require('../package.json')

module.exports.match = function (iq) {
  return iq.getChild('query', 'http://jabber.org/protocol/disco#info')
}

module.exports.handle = function () {
  return xml`
    <query xmlns='http://jabber.org/protocol/disco#info'>
      <feature var='http://jabber.org/protocol/disco#info'/>
      <feature var='jabber:iq:version'/>
      <feature var='urn:xmpp:ping'/>
      <identity
        category='component'
        type='presence'
        name='${pkg.name}'
      />
    </query>
  `
}
