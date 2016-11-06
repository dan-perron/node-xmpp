'use strict'

const crypto = require('crypto')

function sortIdentities (a, b) {
		if (a.category > b.category) {
			return 1
		}
		if (a.category < b.category) {
			return -1
		}
		if (a.type > b.type) {
			return 1
		}
		if (a.type < b.type) {
			return -1
		}
		if (a.lang > b.lang) {
			return 1
		}
		if (a.lang < b.lang) {
			return -1
		}
		return 0
}

function mapIdentites ({attrs}) {
  return {
    category: attrs.category,
    type: attrs.type,
    name: attrs.name,
    lang: attrs['xml:lang']
  }
}

function hash (query) {
  let s = ''

  query.getChildren('identity')
  .map(mapIdentites)
  .sort(sortIdentities)
  .forEach(({category, type, name, lang}) => {
    s += `${category}/${type}/${lang}/${name}<`
  })

  query.getChildren('feature').map(f => f.attrs.var).sort().forEach((feature) => {
    s += `${feature}<`
  })

  query.getChildren('x', 'jabber:x:data').forEach((x) => {
    const fields = x.getChildren('field')
    const formType = fields.find(field => field.attrs.var === 'FORM_TYPE')
    s += `${formType.getChild('value').text()}<`
    fields.forEach((field) => {
      if (field === formType) return
      s += `${field.attrs.var}<`
      field.getChildren('value').map(v => v.text()).sort().forEach((value) => {
        s += `${value}<`
      })
    })
  })

  return crypto
    .createHash('sha1')
    .update(s)
    .digest('base64')
}

function plugin (entity) {}

module.exports = {
  sortIdentities,
  hash,
  plugin
}
