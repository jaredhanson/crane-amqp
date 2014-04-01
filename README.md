# crane-amqp

[![Build](https://travis-ci.org/jaredhanson/crane-amqp.png)](https://travis-ci.org/jaredhanson/crane-amqp)
[![Coverage](https://coveralls.io/repos/jaredhanson/crane-amqp/badge.png)](https://coveralls.io/r/jaredhanson/crane-amqp)
[![Quality](https://codeclimate.com/github/jaredhanson/crane-amqp.png)](https://codeclimate.com/github/jaredhanson/crane-amqp)
[![Dependencies](https://david-dm.org/jaredhanson/crane-amqp.png)](https://david-dm.org/jaredhanson/crane-amqp)
[![Tips](http://img.shields.io/gittip/jaredhanson.png)](https://www.gittip.com/jaredhanson/)


This module provides an [AMQP](http://www.amqp.org/) 0-9-1 adapter for
[Crane](https://github.com/jaredhanson/crane).  AMQP 0-9-1 is implemented by
popular messages brokers such as [RabbitMQ](https://www.rabbitmq.com/).

## Install

    $ npm install crane-amqp

## Usage

#### Connect to Message Broker

    var amqp = require('crane-amqp');
    var broker = new amqp.Broker();
    
    broker.connect({ host: 'localhost', port: 5672 }, function() {
      console.log('connected!');
    });
    
#### Dispatch Messages to Application

    var crane = require('crane');
    var app = crane();
    
    broker.on('message', app);
    
    broker.subscribe('tasks/email', function(err) {
      if (err) { throw err; }
      console.log('subscribed to queue!');
    });

#### Enqueue Messages

    broker.enqueue('tasks/email', { to: 'ryan@example.com', body: 'Hello!' }, function(err) {
      if (err) { throw err; }
      console.log('enqueued message!');
    });

## Tests

    $ npm install
    $ make test

## Credits

  - [Jared Hanson](http://github.com/jaredhanson)

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2011-2014 Jared Hanson <[http://jaredhanson.net/](http://jaredhanson.net/)>
