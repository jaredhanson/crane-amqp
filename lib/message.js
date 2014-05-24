/**
 * `Message` constructor.
 *
 * @api protected
 */
function Message(message, headers, deliveryInfo, obj) {
  // Crane uses slash ('/') separators rather than period ('.')
  this.topic = deliveryInfo.routingKey.replace(/\./g, '/');
  this.headers = headers;
  if (deliveryInfo.contentType) { this.headers['content-type'] = deliveryInfo.contentType; }
  
  if (Buffer.isBuffer(message.data)) {
    this.data = message.data;
  } else {
    this.body = message;
  }
  
  this.__msg = obj;
}

/**
 * Acknowledge message.
 *
 * Examples:
 *
 *     msg.ack();
 *
 * @api public
 */
Message.prototype.ack = function() {
  this.__msg.acknowledge();
}

/**
 * Reject message.
 *
 * Examples:
 *
 *     msg.nack();
 *
 *     msg.nack(true);
 *
 * @api public
 */
Message.prototype.nack = function(requeue) {
  this.__msg.reject(requeue);
}


/**
 * Expose `Message`.
 */
module.exports = Message;
