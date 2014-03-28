/* global describe, it, expect */

var amqp = require('..');

describe('crane-amqp', function() {
  
  it('should export functions', function() {
    expect(amqp.createBroker).to.be.a('function');
  });
  
  it('should export constructors', function() {
    expect(amqp.Broker).to.be.a('function');
  });
  
  describe('#createBroker', function() {
    
    it('should create broker without message listener', function() {
      var broker = amqp.createBroker();
      
      expect(broker).to.be.an.instanceOf(amqp.Broker);
      expect(broker.listeners('message')).to.have.length(0);
    });
    
    it('should create broker with message listener', function() {
      var broker = amqp.createBroker(function(msg) {});
      
      expect(broker).to.be.an.instanceOf(amqp.Broker);
      expect(broker.listeners('message')).to.have.length(1);
    });
    
  });
  
});
