var amqp = require('amqp')
  , util = require('util');

/**
 * `Adapter` constructor.
 *
 * @api public
 */
function Adapter() {
  this._exchange = null;
  this._queues = {};
}

Adapter.prototype.connect = function(options, cb) {
  var self = this;
  this._connection = amqp.createConnection(options);
  this._connection.on('ready', function() {
    self._exchange = self._connection.exchange();
    return cb();
  });
}

Adapter.prototype.declare = function(queue, cb) {
  this._queue(queue, cb);
}

Adapter.prototype.enqueue = function(queue, data, cb) {
  // To ensure that tasks are not lost, messages are marked as persistent (as
  // denoted by the value `2`).
  this._exchange.publish(queue, data, { deliveryMode: 2 });
  return cb();
}

Adapter.prototype.dequeue = function(queue, fn) {
  var queue = this._queue(queue);
  queue.subscribe({ ack: true }, function(message) {
    function shift() { queue.shift(); };
    fn(message, shift);
  });
}

Adapter.prototype._queue = function(name, cb) {
  var q = this._queues[name];
  if (!q) {
    // AMQP work queues are declared as durable, in order to ensure that tasks
    // are not lost in the event that that server is stopped or crashes.
    q = this._connection.queue(name, { durable: true, autoDelete: false }, function() {
      cb && cb();
    });
    this._queues[name] = q;
  } else {
    cb && cb();
  }
  return q;
}


/**
 * Expose `Adapter`.
 */
module.exports = Adapter;
