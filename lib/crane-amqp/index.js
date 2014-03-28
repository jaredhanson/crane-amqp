/**
 * Module dependencies.
 */
var Broker = require('./broker');


/**
 * Create broker with optional message listener.
 *
 * @param {Function} messageListener
 * @return {Broker}
 * @api public
 */
exports.createBroker = function(messageListener) {
  var broker = new Broker();
  if (messageListener) { broker.on('message', messageListener); }
  return broker;
}

/**
 * Export constructors.
 */
exports.Broker = Broker;
