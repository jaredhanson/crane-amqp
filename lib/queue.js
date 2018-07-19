/**
 * Module dependencies.
 */
var debug = require('debug')('crane-amqp');


/**
 * `Queue` constructor.
 *
 * @api protected
 */
function Queue(queue, exchange) {
  this._q = queue;
  this._exchange = exchange;
}

/**
 * Bind queue to topic.
 *
 * Examples:
 *
 *     queue.bind('notifications/email/*', function(err) {
 *       if (err) { throw err; }
 *       ...
 *     });
 *
 * @api public
 */
Queue.prototype.bind = function(topic, cb) {
  // AMQP uses period ('.') separators rather than slash ('/')
  topic = topic.replace(/\//g, '.');
  
  var q = this._q
    , exchange = this._exchange;
  
  var onError = function(err) {
    return cb(err);
  };
  
  debug('bind %s %s %s', q.name, this._exchange, topic);
  console.log('BINDING QUEUE: ' + exchange + ' ' + topic);
  
  q.bind(exchange, topic, function(q) {
    q.removeListener('error', onError);
    return cb();
  });
  
  // NOTE: This will occur if an attempt is made to bind to an exchange that
  //       does not exist.
  //
  //       For example, the underlying `amqp` emits an error with the following
  //       properties:
  //         - message: NOT_FOUND - no exchange 'foo' in vhost '/'
  //         - code: 404
  q.once('error', onError);
}


/**
 * Expose `Queue`.
 */
module.exports = Queue;
