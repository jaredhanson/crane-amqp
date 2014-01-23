var amqp = require('amqp')
  , util = require('util');

var NONPERSISTENT_MODE = 1;
var PERSISTENT_MODE = 2;


/**
 * `Broker` constructor.
 *
 * @api public
 */
function Broker() {
  this._exchange = null;
  this._queues = {};
}

Broker.prototype.connect = function(options, cb) {
  var self = this;
  this._connection = amqp.createConnection(options);
  this._connection.once('ready', function() {
    var exchange = options.exchange;
    if (!exchange) {
      // Get the default exchange, which is a direct exchange, and thus suitable
      // for use as a task queue.
      self._exchange = self._connection.exchange();
      return cb();
    } else {
      var name = exchange
        , opts = {};
      if (typeof exchange == 'object') {
        name = exchange.name;
        opts = exchange.options;
      }
      
      opts.type = (opts.type === undefined) ? 'direct' : opts.type;
      opts.durable = (opts.durable === undefined) ? true : opts.durable;
      opts.autoDelete = (opts.autoDelete === undefined) ? false : opts.autoDelete;
      opts.confirm = (opts.confirm === undefined) ? true : opts.confirm;
      
      self._exchange = self._connection.exchange(name, opts, function(err) {
        return cb();
      });
    }
  });
}

Broker.prototype.declare = function(name, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // Task queues are declared as durable, by default.  This ensures that tasks
  // are not lost in the event that that server is stopped or crashes.
  options.durable = (options.durable === undefined) ? true : options.durable;
  options.autoDelete = (options.autoDelete === undefined) ? false : options.autoDelete;
  
  var queue = this._connection.queue(name, options, function(q) {
    var exchange = options.bind;
    if (exchange) {
      q.bind(exchange, name, function(q) {
        cb && cb();
      });
    } else {
      cb && cb();
    }
  });
  this._queues[name] = queue;
}

Broker.prototype.enqueue = function(queue, msg, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  options.deliveryMode = (options.deliveryMode === undefined) ? PERSISTENT_MODE : options.deliveryMode;
  // TODO: This option appears to have no effect. Why?
  //options.mandatory = (options.mandatory === undefined) ? true : options.mandatory;
  
  if (this._exchange.options && this._exchange.options.confirm) {
    this._exchange.publish(queue, msg, options, function(hadError) {
      var err;
      if (hadError) {
        err = new Error('Failed to publish message');
      }
      return cb(err);
    });
  } else {
    this._exchange.publish(queue, msg, options);
    return cb();
  }
}

Broker.prototype.dequeue = function(queue, options, fn) {
  if (typeof options == 'function') {
    fn = options;
    options = undefined;
  }
  options = options || {};
  
  options.ack = (options.ack === undefined) ? true : options.ack;
  
  var q = this._queues[queue]
  q.subscribe(options, function(message) {
    function shift() { q.shift(); };
    fn(message, shift);
  });
}


/**
 * Expose `Broker`.
 */
module.exports = Broker;
