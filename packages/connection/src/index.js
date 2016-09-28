import EventEmitter from 'events'
import StreamParser from '@xmpp/streamparser'
import JID from '@xmpp/jid'
import url from 'url'

// we ignore url module from the bundle to reduce its size
function getHostname (uri) {
  if (url.parse) {
    return url.parse(uri).hostname
  } else {
    const el = document.createElement('a')
    el.href = uri
    return el.hostname
  }
}

class Connection extends EventEmitter {
  constructor (options) {
    super()
    this.online = false
    this._domain = ''
    this.jid = null
    this.options = typeof options === 'object' ? options : {}
    this.plugins = []

    if (this.Socket && this.Parser) {
      this._handle(new this.Socket(), new this.Parser())
    }
  }

  start (options) {
    if (typeof options === 'string') {
      options = {uri: options}
    }

    if (!options.domain) {
      options.domain = getHostname(options.uri)
    }

    this.options = options
    return this.connect(this.options.uri)
      .then(() => this.open(this.options.domain, this.options.lang))
  }

  stop () {
    return this.end()
      .then(() => this.close())
  }

  _handle (socket, parser) {
    const errorListener = (error) => {
      this.emit('error', error)
    }

    // socket
    const sock = this.socket = socket
    const dataListener = (data) => {
      data = data.toString('utf8')
      this.parser.write(data)
      // FIXME only if parser.write ok
      this.emit('fragment', null, data)
    }
    const closeListener = () => {
      this._domain = ''
      this.online = false
      this.emit('close')
    }
    const connectListener = () => {
      this.online = true
      this.emit('connect')
    }
    sock.on('data', dataListener)
    sock.on('error', errorListener)
    sock.on('close', closeListener)
    sock.on('connect', connectListener)

    // parser
    this.parser = parser
    const elementListener = (element) => {
      this.emit('element', element)
      this.emit(this.isStanza(element) ? 'stanza': 'nonza', element)
    }
    parser.on('element', elementListener)
    parser.on('error', errorListener)
  }

  _online (jid) {
    jid = JID(jid)
    this.emit('online', jid)
    this.jid = jid
    return jid
  }

  id () {
    return Math.random().toString().split('0.')[1]
  }

  connect (options) {
    return new Promise((resolve, reject) => {
      this.socket.connect(options, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  open (domain, lang = 'en') {
    return new Promise((resolve, reject) => {
      // FIXME timeout
      this.waitHeader(domain, lang, (err, attrs, name) => {
        if (err) return reject(err)
        this._domain = domain
        this.emit('open')

        this.once('nonza', el => {
          if (el.name !== 'stream:features') return // FIXME error
          this.emit('features', el)
          resolve(attrs, name, el)
        })

        // FIXME that's not guaranteed...
        // component doesn't use features...
        process.nextTick(() => resolve(attrs, name))
      })
      this.write(this.header(domain, lang))
    })
  }

  restart (...args) {
    return this.open(...args)
  }

  // _write_catch (data) {
  //   // FIXME timeout
  //   return new Promise((resolve, reject) => {
  //     this.once('element', (el) => {
  //       resolve(el)
  //     })
  //     this.write(data).catch(reject)
  //   })
  // }

  // _send_catch (data) {
  //   // FIXME timeout
  //   return new Promise((resolve, reject) => {
  //     this.once('element', (el) => {
  //       resolve(el)
  //     })
  //     this.send(data).catch(reject)
  //   })
  // }

  send (element) {
    element = element.root()

    const {name} = element
    const NS = element.getNS()
    if (NS !== this.NS && name === 'iq' || name === 'message' || name === 'presence') {
      element.attrs.xmlns = this.NS
    }

    return this.write(element)
  }

  write (data) {
    return new Promise((resolve, reject) => {
      data = data.toString('utf8').trim()
      this.socket.write(data, (err) => {
        if (err) return reject(err)
        this.emit('fragment', data)
        resolve()
      })
    })
  }

  isStanza (element) {
    const {name} = element
    return this.online &&
      element.getNS() === this.NS &&
      (name === 'iq' || name === 'message' || name === 'presence')
  }

  isNonza (element) {
    return !this.isStanza(element)
  }

  end () {
    return this.write(this.footer())
  }

  close () {
    return new Promise((resolve, reject) => {
      // TODO timeout
      const handler = () => {
        this.socket.close()
        this.once('close', resolve)
      }
      this.parser.once('end', handler)
    })
  }

  use (plugin) {
    if (this.plugins.includes(plugin)) return
    this.plugins.push(plugin)
    plugin(this)
  }

  // override
  waitHeader () {}
  header () {}
  footer () {}
  match () {}
}

// overrirde
Connection.prototype.NS = ''
Connection.prototype.Socket = null
Connection.prototype.Parser = StreamParser

export default Connection
export {getHostname, Connection}
