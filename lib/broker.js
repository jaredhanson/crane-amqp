/**
 * Module dependencies.
 */
var EventEmitter = require('events').EventEmitter
  , amqp = require('amqp')
  , util = require('util')
  , Queue = require('./queue')
  , Message = require('./message')
  , NoQueueError = require('./errors/noqueueerror')
  , NoSubscriptionError = require('./errors/nosubscriptionerror')
  , debug = require('debug')('crane-amqp')
  , uid = require('uid');

/**
 * Message delivery mode constants.
 */
var NONPERSISTENT_MODE = 1;
var PERSISTENT_MODE = 2;


/**
 * `Broker` constructor.
 *
 * @api public
 */
function Broker(options) {
  EventEmitter.call(this);
  this._exchange = null;
  this._queues = {};
  this._ctags = {};
  
  this._options = options;
}

/**
 * Inherit from `EventEmitter`.
 */
util.inherits(Broker, EventEmitter);

/**
 * Connect to AMQP server.
 *
 * For AMQP brokers, `options` argument should be an object that specifies the
 * following parameters:
 *
 *   - `port`  port the client should connect to, defaults to 5672
 *   - `host`  host the client should connect to, defaults to localhost
 *
 * Examples:
 *
 *     broker.connect({ host: '127.0.0.1', port: 5672 }, function() {
 *       console.log('ready');
 *     });
 *
 *     broker.connect({ host: '127.0.0.1', port: 5672, exchange: 'amq.topic' }, function() {
 *       console.log('ready');
 *     });
 *
 *     broker.connect({ host: '127.0.0.1', port: 5672,
 *                      exchange: {
 *                        name: 'app1.topic',
 *                        options: { type: 'topic', confirm: false }
 *                      } },
 *       function() {
 *         console.log('ready');
 *       });
 *
 * @param {Object} options
 * @param {Function} readyListener
 * @api public
 */
Broker.prototype.connect = function(options, readyListener) {
  if (typeof options == 'function') {
    readyListener = options;
    options = undefined;
  }
  options = options || {};
  
  if (readyListener) { this.once('ready', readyListener); }
  
  //debug('connecting %s:%s', options.host || 'localhost', options.port || 5672);
  
  var self = this;
  this._connection = amqp.createConnection(this._options, { reconnect: false });
  this._connection.once('ready', function() {
    var exchange = options.exchange;
    
    console.log('CONNECTING TO EXCHANGE! - ' + exchange);
    
    if (!exchange) {
      debug('default exchange');
      
      // Get the default exchange, which is a direct exchange, and thus suitable
      // for use as a task queue.
      self._exchange = self._connection.exchange();
      // TODO: Emit ready after callback to `exchange()`.
      return self.emit('ready');
    } else {
      var name = exchange
        , opts = {};
      if (typeof exchange == 'object') {
        name = exchange.name;
        opts = exchange.options;
      }
      
      // AMQP uses period ('.') separators rather than slash ('/')
      name = name.replace(/\//g, '.');
      if (name.indexOf('amq.') !== 0) {
        opts.type = (opts.type === undefined) ? 'direct' : opts.type;
        opts.durable = (opts.durable === undefined) ? true : opts.durable;
        opts.autoDelete = (opts.autoDelete === undefined) ? false : opts.autoDelete;
        opts.confirm = (opts.confirm === undefined) ? true : opts.confirm;
      } else {
        // Options for built-in exchanges can not be overridden.
        opts = {};
      }
      
      debug('exchange %s %s', name);
      self._exchange = self._connection.exchange(name, opts, function(exchange) {
        return self.emit('ready');
      });
      self._exchange.on('error', function(err) {
        // NOTE: This will occur if an exchange is redeclared with different
        //       properties.
        //
        //       For example, the underlying `amqp` emits an error with the
        //       following properties:
        //         - message: PRECONDITION_FAILED - cannot redeclare exchange
        //                    'foo' in vhost '/' with different type, durable,
        //                    internal or autodelete value
        //         - code: 406
        return self.emit('error', err);
      });
    }
  });
  
  this._connection.on('error', this.emit.bind(this, 'error'));
}

/**
 * Publish a message to the exchange.
 *
 * In AMQP, publishing a message to an exchange has the effect of enqueuing that
 * message on all queues that are bound to the exchange with a routing key that
 * matches the topic.
 *
 * Examples:
 *
 *     broker.enqueue('tasks/mail', { to: 'bob@example.com', body: 'Welcome!' }, function(err) {
 *       if (err) { throw err; }
 *       ...
 *     });
 *
 *     broker.enqueue('metrics/cpu', { timestamp: 1396288552169, value: 32 });
 *
 * @param {String} topic
 * @param {Mixed} msg
 * @param {Object} options
 * @param {Function} cb
 * @api public
 */
Broker.prototype.publish = function(topic, msg, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // AMQP uses period ('.') separators rather than slash ('/')
  topic = topic.replace(/\//g, '.');
  options.deliveryMode = (options.deliveryMode === undefined) ? PERSISTENT_MODE : options.deliveryMode;
  // TODO: This option appears to have no effect. Investigate why.
  //options.mandatory = (options.mandatory === undefined) ? true : options.mandatory;
  
  if (this._exchange.options && this._exchange.options.confirm) {
    debug('publish %s (confirm)', topic);
    console.log('PUBLISH 1: ' + topic);
    this._exchange.publish(topic, msg, options, function(hadError, err) {
      if (hadError) {
        err = err || new Error('Failed to publish message to topic "' + topic + '"');
        return cb(err);
      }
      return cb();
    });
  } else {
    debug('publish %s', topic);
    console.log('PUBLISH 0: ' + topic);
    this._exchange.publish(topic, msg.body, options);
    if (cb) { return process.nextTick(cb); }
  }
}

/**
 * Subscribe to messages enqueued in a queue.
 *
 * Once subscribed, messages will be delivered and emitted in `message` events.
 * A Crane application can be registered as a listener for these events,
 * allowing worker processes to be developed in a style similar to that of
 * Express applications.
 *
 * Examples:
 *
 *     broker.subscribe('tasks/mail', function(err) {
 *       if (err) { throw err; }
 *       ...
 *     });
 *
 *     broker.subscribe('tasks/serial', { exclusive: true }, function(err) {
 *       if (err) { throw err; }
 *       ...
 *     });
 *
 * @param {String} queue
 * @param {Object} options
 * @param {Function} cb
 * @api public
 */
Broker.prototype.subscribe = function(queue, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  if (!queue) { queue = this.address }
  
  console.log('SUBSCRIBE NOW');
  console.log(queue)
  
  // AMQP uses period ('.') separators rather than slash ('/')
  queue = queue.replace(/\//g, '.');
  options.ack = (options.ack === undefined) ? true : options.ack;
  
  var self = this
    , q = this._queues[queue];
  if (!q) { return cb(new NoQueueError('Queue "' + queue + '" not declared')); }
    
  var onError = function(err) {
    return cb(err);
  };
  
  debug('subscribe %s', queue);
  q.subscribe(options, function(message, headers, deliveryInfo, messageObject) {
    console.log('GOT MESSAGE :)');
    
    var m = new Message(message, headers, deliveryInfo, messageObject);
    m.broker = self;
    
    self.emit('message', m);
    //m.ack();
  }).addCallback(function(ok) {
    // This callback is invoked when the subscription was successful, and is
    // equivalent to the registering a listener for the queue's `basicConsumeOk`
    // event.
    q.removeListener('error', onError);
    
    self._ctags[queue] = ok.consumerTag;
    return cb();
  }).addErrback(function(err) {
    // NOTE: Promise errbacks are not properly invoked by the underlying `amqp`
    //       module.  As a workaround, a listener is explicitly registered for
    //       the queue's `error` event.
  });
  
  // NOTE: This will occur if an attempt is made to subscribe to a queue that
  //       already has an exclusive subscription.
  //
  //       For example, the underlying `amqp` emits an error with the following
  //       properties:
  //         - message: ACCESS_REFUSED - queue 'foo' in vhost '/' in exclusive
  //                    use
  //         - code: 403
  q.once('error', onError);
}

/**
 * Unsubscribe from messages enqueued in a queue.
 *
 * Once unsubscribed, messages will no longer be delivered or emitted in
 * `message` events.
 *
 * Examples:
 *
 *     broker.unsubscribe('tasks/mail', function(err) {
 *       if (err) { throw err; }
 *       ...
 *     });
 *
 * @param {String} queue
 * @param {Object} options
 * @param {Function} cb
 * @api public
 */
Broker.prototype.unsubscribe = function(queue, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // AMQP uses period ('.') separators rather than slash ('/')
  queue = queue.replace(/\//g, '.');
  options.close = (options.close === undefined) ? true : options.close;
  
  var self = this
    , q = this._queues[queue]
    , ctag = this._ctags[queue];
    
  if (!q) { return cb(new NoQueueError('Queue "' + queue + '" not declared')); }
  if (!ctag) { return cb(new NoSubscriptionError('Not subscribed to queue "' + queue + '"')); }
    
  debug('unsubscribe %s', queue);
  q.unsubscribe(ctag)
    .addCallback(function(ok) {
      delete self._ctags[queue];
      
      if (options.close) {
        q.close();
        return cb();
      } else {
        return cb();
      }
    })
    .addErrback(function(err) {
    });
}

/**
 * Declare a queue.
 *
 * Examples:
 *
 *     broker.declare('tasks/mail', function(err, queue) {
 *       if (err) { throw err; }
 *       ...
 *     });
 *
 * @param {String} queue
 * @param {Object} options
 * @param {Function} cb
 * @api public
 */
Broker.prototype.declare = function(queue, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  var bind = (options.bind === undefined) ? true : options.bind;
  
  console.log('DECLARE QUQUE: ' + queue);
  
  // AMQP uses period ('.') separators rather than slash ('/')
  if (queue) { queue = queue.replace(/\//g, '.'); }
  if (!queue) {
    queue = queue || ('entity-' + uid(16));
    console.log('TEMP QUEU NAME: ' + queue);
    
    options.exclusive = true;
    options.durable = false;
    
    
    this.address = queue;
    console.log('DECLARED, ADDRESS - ' + this.address);
    
    //bind = false
  }
  // Task queues are declared as durable, by default.  This ensures that tasks
  // are not lost in the event that that server is stopped or crashes.
  options.durable = (options.durable === undefined) ? true : options.durable;
  options.autoDelete = (options.autoDelete === undefined) ? false : options.autoDelete;
  
  var self = this;
  
  var onError = function(err) {
    return cb(err);
  };
  
  debug('declare %s', queue);
  
  var q = this._connection.queue(queue, options, function onOpen(q) {
    console.log('OPEN!');
    
    var wq = new Queue(q, self._exchange.name);
    q.removeListener('error', onError);
    
    if (bind) {
      wq.bind(queue, function(err) {
        if (err) { return cb(err); }
        return cb(null, wq);
      });
    } else {
      return cb(null, wq);
    }
  });
  // FIXME:
  //return;
  
  this._queues[queue] = q;
  
  // NOTE: This will occur if a queue is redeclared with different properties.
  //
  //       For example, the underlying `amqp` emits an error with the following
  //       properties:
  //         - message: PRECONDITION_FAILED - parameters for queue 'foo' in
  //           vhost '/' not equivalent
  //         - code: 406
  q.once('error', onError);
}


/**
 * Expose `Broker`.
 */
module.exports = Broker;
