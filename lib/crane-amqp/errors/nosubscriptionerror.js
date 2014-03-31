/**
 * `NoSubscriptionError` error.
 *
 * @api public
 */
function NoSubscriptionError(message) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'NoSubscriptionError';
  this.message = message;
  this.code = 'ENOSUB';
}

/**
 * Inherit from `Error`.
 */
NoSubscriptionError.prototype.__proto__ = Error.prototype;


/**
 * Expose `NoSubscriptionError`.
 */
module.exports = NoSubscriptionError;
