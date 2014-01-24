var Broker = require('./broker');

exports.createBroker = function(messageListener) {
  var broker = new Broker();
  if (messageListener) { broker.on('message', messageListener); }
  return broker;
}

exports.Broker = Broker;
