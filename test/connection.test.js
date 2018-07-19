/* global describe, it */

var $require = require('proxyquire');
var expect = require('chai').expect;
var sinon = require('sinon');
var Connection = require('../lib/broker');
var EventEmitter = require('events').EventEmitter;


describe('Connection', function() {
  
  it('should export constructor', function() {
    expect(Connection).to.be.a('function');
  });
  
  describe('#consume', function() {
    
    describe('successfully consuming a queue', function() {
      
    });
    
  });
  
});
