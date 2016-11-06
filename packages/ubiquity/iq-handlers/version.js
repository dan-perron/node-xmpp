const xml = require('@xmpp/xml')
const pkg = require('../package.json')

module.exports.match = function (iq) {
  return iq.getChild('query', 'jabber:iq:version')
}

module.exports.handle = function () {
  return xml`
    <query xmlns='jabber:iq:version'>
      <name>${pkg.name}</name>
      <version>${pkg.version}</version>
    </query>
  `
}
