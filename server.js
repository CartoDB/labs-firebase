#!/usr/bin/env node

var fs = require('fs');
var curl = require('curlrequest');
var util = require('util');
var Step = require('step');
var async = require('async');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Firebase = new require('firebase');
var ref = new Firebase('https://publicdata-transit.firebaseio.com/');
var name = 'sf-muni';
var track = {'5': null, '28': null, '8X': null, '18': null, '48': null};

var queue1 = async.queue(post, 20); // parallel tasks
var queue2 = async.queue(post, 1); // ensure sync, avoid deadlocks
queue1.drain = function () {
  util.log(':::queue1 empty:::');
}
queue2.drain = function () {
  util.log(':::queue2 empty:::');
}

function post(q, cb) {
  util.log(_.prune(q, 44));
  curl.request({
    url: 'https://sanderpick.cartodb.com/api/v2/sql',
    method: 'POST',
    data: {
      q: q,
      api_key: 'a3cd828920af200dd4610ad6364adbc3bd8ee09a'
    }
  }, function (err, data) {
    cb(err || JSON.parse(data === '' ? '{}': data).error, data);
  });
}

function insertOrUpdate (b, cb) {
  Step(
    function () {
      var geom = "ST_SetSRID(ST_GeomFromGeoJSON('{\"type\":\"LineString\","
          + "\"coordinates\":[[" + b.lon + "," + b.lat + "]]}'), 4326),";
      var geom2 = "ST_SetSRID(ST_GeomFromGeoJSON('{\"type\":\"LineString\","
          + "\"coordinates\":[[" + b.lon + "," + b.lat + "," + b.timestamp
          + "]]}'), 4326)";
      var vals = geom + geom2 + "," + b.speedKmHr + "," + b.secsSinceReport + ",'"
          + b.routeTag + "'";
      queue1.push("INSERT INTO sf_muni_paths (the_geom,spacetime,speedkmhr,"
          + "secssincereport,routetag,id) VALUES ("
          + vals + "," + b.id + ")", this);
    },
    function (err, data) {
      if (err && err[0] && err[0].indexOf('_idx') !== -1) {
        return this(null, true);
      }
      this(err);
    },
    function (err, update) {
      if (err) return this(err);
      if (!update) {
        return this();
      }
      var geom2 = "ST_Simplify(ST_AddPoint(spacetime, ST_SetSRID(ST_MakePoint("
          + b.lon + "," + b.lat + "," + b.timestamp + "),4326)),0.001)";
      var vals = geom2 + "," + b.speedKmHr + "," + b.secsSinceReport + ",'"
          + b.routeTag + "'";
      queue1.push("UPDATE sf_muni_paths SET (spacetime,speedkmhr,"
          + "secssincereport,routetag) = ("
          + vals + ") WHERE id = " + b.id, this);
    },
    function (err, data) {
      cb(err);
    }
  );
}

f = ref.child(name + "/vehicles");
f.on("value", function (s) {
  var bs = s.val();
  var hasBatchUpdate = false;
  var values = "";
  function _addToBatchUpdate(b) {
    var geom2 = "ST_SetSRID(ST_MakePoint(" + b.lon
        + "," + b.lat + "," + b.timestamp + "),4326)";
    var vals = b.id + "," + geom2 + "," + b.speedKmHr + "," + b.secsSinceReport
        + ",'" + b.routeTag + "'";
    values += "(" + vals + "),";
  }

  _.each(bs, function (b) {
    if (track[b.routeTag] === undefined) {
      return;
    }
    if (track[b.routeTag] === b.id) {
      _addToBatchUpdate(b);
      hasBatchUpdate = true;
    } else if (track[b.routeTag] === null) {
      track[b.routeTag] = b.id;
      insertOrUpdate(b, function (err, data) {
        if (err) return console.log(err);
      });
    }
  });

  if (hasBatchUpdate) {
    if (values[values.length - 1] === ',') {
      values = values.substr(0, values.length - 1);
    }
    values = "UPDATE sf_muni_paths "
        + "SET (spacetime,speedkmhr,secssincereport,routetag) = "
        + "(ST_Simplify(ST_AddPoint(spacetime,v.point),0.0001),v.speedkmhr,"
        + "v.secssincereport,v.routetag)"
        + " FROM (VALUES " + values
        + ") AS v(id,point,speedkmhr,secssincereport,routetag)"
        + " WHERE sf_muni_paths.id = v.id";
    queue2.push(values, function (err, data) {
      if (err) console.log(err);
    });
  }
});

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(5000);
