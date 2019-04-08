'use strict'

// eslint-disable-next-line one-var
var Datastore = require('nedb'),
  Readable = require('readable-stream').Readable,
  streamsOpts = { objectMode: true },
  storeOpts = {compactionInterval: 30000},
  // msgpack = require('msgpack5'),
  noop = function () {}

/**
 * NeDB implementation of the message store
 *
 */
var Store = function (options) {
  if (!(this instanceof Store)) {
    return new Store(options)
  }

  this._opts = options || {}
  this.db = new Datastore({ filename: this._opts.filename, autoload: true })

  this.db.persistence.setAutocompactionInterval(options.compactionInterval || 30000)
}

/**
 * Adds a packet to the store, a packet is
 * anything that has a messageId property.
 *
 */
Store.prototype.put = function (packet, cb) {
  cb = cb || noop
  this.db.insert({_id: packet.messageId, packet: packet}, function (err, doc) {
    if (err) {
      return this.db.update({_id: packet.messageId}, {_id: packet.messageId, packet: packet}, {}, function (err) {
        cb(err, packet)
      })
    }
    cb(null, doc)
  }.bind(this))
  return this
}

/**
 * Creates a stream with all the packets in the store
 *
 */
Store.prototype.createStream = function () {
  // eslint-disable-next-line one-var
  var stream = new Readable(streamsOpts),
    destroyed = false,
    skip = 0,
    limit = this._opts.limit || 500,
    db = this.db

  stream._read = function () {
    var _skip = skip
    skip += limit

    db
      .find({})
      .skip(_skip)
      .limit(limit)
      .exec(function (err, packets) {
        if (err || destroyed || !packets || packets.length === 0) {
          return this.push(null)
        }

        packets.forEach(function (packet) {
          this.push(packet.packet)
        }.bind(this))
      }.bind(this))
  }

  stream.destroy = function () {
    if (destroyed) {
      return
    }
    var self = this
    destroyed = true
    process.nextTick(function () {
      self.emit('close')
    })
  }
  return stream
}

/**
 * deletes a packet from the store.
 */
Store.prototype.del = function (packet, cb) {
  cb = cb || noop
  this.get(packet, function (err, packetInDb) {
    if (err) {
      return cb(err)
    }
    this.db.remove({ _id: packet.messageId }, {}, function (err) {
      cb(err, packetInDb)
    })
  }.bind(this))
  return this
}

/**
 * get a packet from the store.
 */
Store.prototype.get = function (packet, cb) {
  cb = cb || noop
  this.db.findOne({ _id: packet.messageId }, function (err, packet) {
    if (packet) {
      cb(null, packet.packet)
    } else {
      cb(err || new Error('missing packet'))
    }
  })
  return this
}

/**
 * Close the store
 */
Store.prototype.close = function (cb) {
  cb = cb || noop
  cb()
  return this
}

var Manager = function (path, options) {
  if (!(this instanceof Manager)) {
    return new Manager(path, options)
  }

  if (typeof path === 'object') {
    options = path
    path = null
  }

  if (!options) options = storeOpts

  this.incoming = new Store({filename: require('path').join(path, 'incoming'), compactionInterval: options.compactionInterval})
  this.outgoing = new Store({filename: require('path').join(path, 'outgoing'), compactionInterval: options.compactionInterval})
}

Manager.single = Store

Manager.prototype.close = function (done) {
  this.incoming.close()
  this.outgoing.close()

  done && done() // jshint ignore:line
}

module.exports = Manager
