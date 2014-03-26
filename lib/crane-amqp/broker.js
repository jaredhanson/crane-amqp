var EventEmitter = require('events').EventEmitter
  , amqp = require('amqp')
  , util = require('util')
  , Message = require('./message')

var NONPERSISTENT_MODE = 1;
var PERSISTENT_MODE = 2;


/**
 * `Broker` constructor.
 *
 * @api public
 */
function Broker() {
  EventEmitter.call(this);
  this._exchange = null;
  this._queues = {};
  this._ctags = {};
}

/**
 * Inherit from `EventEmitter`.
 */
util.inherits(Broker, EventEmitter);

Broker.prototype.connect = function(options, readyListener) {
  if (readyListener) { this.on('ready', readyListener); }
  
  var self = this;
  this._connection = amqp.createConnection(options);
  this._connection.once('ready', function() {
    var exchange = options.exchange;
    if (!exchange) {
      // Get the default exchange, which is a direct exchange, and thus suitable
      // for use as a task queue.
      self._exchange = self._connection.exchange();
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
      
      opts.type = (opts.type === undefined) ? 'direct' : opts.type;
      opts.durable = (opts.durable === undefined) ? true : opts.durable;
      opts.autoDelete = (opts.autoDelete === undefined) ? false : opts.autoDelete;
      opts.confirm = (opts.confirm === undefined) ? true : opts.confirm;
      
      self._exchange = self._connection.exchange(name, opts, function(err) {
        return self.emit('ready');
      });
    }
  });
  
  this._connection.on('error', this.emit.bind(this, 'error'));
}

Broker.prototype.declare = function(name, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // AMQP uses period ('.') separators rather than slash ('/')
  name = name.replace(/\//g, '.');
  
  // Task queues are declared as durable, by default.  This ensures that tasks
  // are not lost in the event that that server is stopped or crashes.
  options.durable = (options.durable === undefined) ? true : options.durable;
  options.autoDelete = (options.autoDelete === undefined) ? false : options.autoDelete;
  
  var q = this._connection.queue(name, options, function(q) {
    q.removeListener('error', onQueueDeclareError);
    
    var exchange = options.bind;
    if (exchange) {
      // AMQP uses period ('.') separators rather than slash ('/')
      exchange = exchange.replace(/\//g, '.');
      
      // TODO: support binding to multiple topics
      var topic = options.topic || name;
      topic = topic.replace(/\//g, '.');
      
      q.bind(exchange, topic, function(q) {
        q.removeListener('error', onQueueBindError);
        return cb && cb();
      });
      
      // Listen for events that indicate that the queue failed to be bound.
      var onQueueBindError = function(err) {
        return cb && cb(err);
      };
      q.once('error', onQueueBindError);
    } else {
      return cb && cb();
    }
  });
  this._queues[name] = q;
  
  // Listen for events that indicate that the queue failed to be declared.
  var onQueueDeclareError = function(err) {
    return cb && cb(err);
  };
  q.once('error', onQueueDeclareError);
}

Broker.prototype.enqueue = function(queue, msg, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // AMQP uses period ('.') separators rather than slash ('/')
  queue = queue.replace(/\//g, '.');
  
  options.deliveryMode = (options.deliveryMode === undefined) ? PERSISTENT_MODE : options.deliveryMode;
  // TODO: This option appears to have no effect. Why?
  //options.mandatory = (options.mandatory === undefined) ? true : options.mandatory;
  
  if (this._exchange.options && this._exchange.options.confirm) {
    this._exchange.publish(queue, msg, options, function(hadError) {
      var err;
      if (hadError) {
        err = new Error('Failed to enqueue task in queue "' + queue + '"');
      }
      return cb(err);
    });
  } else {
    this._exchange.publish(queue, msg, options);
    return cb();
  }
}

Broker.prototype.subscribe = function(queue, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  
  // AMQP uses period ('.') separators rather than slash ('/')
  queue = queue.replace(/\//g, '.');
  
  options.ack = (options.ack === undefined) ? true : options.ack;
  
  var self = this
    , q = this._queues[queue];
  q.subscribe(options, function(message, headers, deliveryInfo) {
    var m = new Message(q, message, headers, deliveryInfo);
    m.broker = self;
    
    self.emit('message', m);
  }).addCallback(function(ok) {
    self._ctags[queue] = ok.consumerTag;
  });
  
  
  // Listen for events that indicate the subscription has been processed.
  // `basicConsumeOk` is emitted when the subscription is successful.
  // `error` is emitted when the subscription failed.  In practice, this
  // has only been observed when attempting to subscribe to queue that has a
  // previously existing exclusive subscription.
  
  var onBasicConsumeOk = function(args) {
    q.removeListener('error', onBasicConsumeError);
    return cb && cb();
  };
  
  var onBasicConsumeError = function(err) {
    q.removeListener('basicConsumeOk', onBasicConsumeOk);
    return cb && cb(err);
  };
  
  q.once('basicConsumeOk', onBasicConsumeOk);
  q.once('error', onBasicConsumeError);
}

Broker.prototype.unsubscribe = function(queue, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = undefined;
  }
  options = options || {};
  options.close = (options.close === undefined) ? true : options.close;
  
  // AMQP uses period ('.') separators rather than slash ('/')
  queue = queue.replace(/\//g, '.');
  
  var self = this
    , q = this._queues[queue]
    , ctag = this._ctags[queue];
    
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
      // TODO: Handle this (figure out how to force this in a real-world scenario, invalid ctag???)
    });
}


/**
 * Expose `Broker`.
 */
module.exports = Broker;
