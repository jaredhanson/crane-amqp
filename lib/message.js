/**
 * `Message` constructor.
 *
 * @api protected
 */
function Message(queue, message, headers, deliveryInfo) {
  // Crane uses slash ('/') separators rather than period ('.')
  this.topic = deliveryInfo.routingKey.replace(/\./g, '/');
  this.headers = {};
  if (deliveryInfo.contentType) { headers['content-type'] = deliveryInfo.contentType; }
  // TODO: only set body if it has been parsed, otherwise set `data`
  this.body = message;
  
  this._q = queue;
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
  this._q.shift();
}


/**
 * Expose `Message`.
 */
module.exports = Message;
