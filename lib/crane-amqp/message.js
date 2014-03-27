function Message(queue, message, headers, deliveryInfo) {
  // Crane uses slash ('/') separators rather than period ('.')
  this.topic = deliveryInfo.routingKey.replace(/\./g, '/');
  this.headers = {};
  if (deliveryInfo.contentType) { headers['content-type'] = deliveryInfo.contentType; }
  // TODO: only set body if it has been parsed, otherwise set `data`
  this.body = message;
  
  this._amqp = { queue: queue };
}

Message.prototype.ack = function() {
  this._amqp.queue.shift();
}


module.exports = Message;
