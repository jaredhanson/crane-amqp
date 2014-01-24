function Message(queue, message, headers, deliveryInfo) {
  this.queue = deliveryInfo.queue;
  this.headers = {};
  if (deliveryInfo.contentType) { headers['content-type'] = deliveryInfo.contentType; }
  this.body = message;
  
  this._amqp = { queue: queue };
}

Message.prototype.ack = function() {
  this._amqp.queue.shift();
}


module.exports = Message;
