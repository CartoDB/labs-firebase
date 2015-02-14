#!/usr/bin/env node

var fs = require('fs');
var curl = require('curlrequest');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Firebase = new require('firebase');
var ref = new Firebase('https://publicdata-transit.firebaseio.com/');
var name = 'sf-muni';

f = ref.child(name + "/vehicles");
f.on("value", function (s) {
  var buses = s.val();
  var names = 'the_geom,dirtag,heading,routetag,id,speedkmhr,predictable,'
      + 'secssincereport,timestamp,vtype';
  var values = '';
  var len = _.size(buses);
  var i = 0;
  _.each(buses, function (b) {
    var d = new Date(b.timestamp);
    var ts = d.getUTCFullYear() + '-' + (d.getUTCMonth()+1)
        + '-' + d.getUTCDate() + 'T' + d.getUTCHours() + ':'
        + d.getUTCMinutes() + ':' + d.getUTCSeconds() + 'Z';
    values += '(';
    values += 'CDB_LatLng(' + b.lat + "," + b.lon + '),';
    values += "'" + b.dirTag + "'," + b.heading + ",'" + b.routeTag + "',"
        + b.id + "," + b.speedKmHr + ",'" + b.predictable + "',"
        + b.secsSinceReport + ",TIMESTAMP '" + ts + "','" + b.vtype + "'";
    values += ')';
    if (i !== len - 1) {
      values += ',';
    }
    ++i;
  });
  var query = "INSERT INTO buses_sf_muni (" + names + ") VALUES " + values;
  Step(
    function () {
      curl.request({
        url: 'https://sanderpick.cartodb.com/api/v2/sql',
        method: 'POST',
        data: {
          q: query,
          api_key: 'a3cd828920af200dd4610ad6364adbc3bd8ee09a'
        }
      }, this);
    },
    function (err, data) {
      console.log(err, data);
    }
  );
});

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(5000);
