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
    // Get the default exchange, which is a direct exchange, and thus suitable
    // for use as a task queue.
    
    // TODO: Ensure that default exhange is durable.
    // TODO: Allow a different exchange to be used.
    self._exchange = self._connection.exchange();
    return cb();
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
    cb && cb();
  });
  this._queues[name] = queue;
}

Broker.prototype.enqueue = function(queue, msg, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // TODO: Make sure these options make sense wrt the exchange (confimation, etc.)
  options.deliveryMode = (options.deliveryMode === undefined) ? PERSISTENT_MODE : options.deliveryMode;
  
  // To ensure that tasks are not lost, messages are marked as persistent (as
  // denoted by the value `2`).
  this._exchange.publish(queue, msg, options);
  return cb();
}

Broker.prototype.dequeue = function(queue, fn) {
  var q = this._queues[queue]
  q.subscribe({ ack: true }, function(message) {
    function shift() { q.shift(); };
    fn(message, shift);
  });
}


/**
 * Expose `Broker`.
 */
module.exports = Broker;
