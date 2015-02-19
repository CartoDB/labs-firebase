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
var interval = 20 * 1e3;
var lastInsert;
// var track = {'5': null, '28': null, '8X': null, '18': null, '48': null,
//     '38L': null, '43': null, '9L': null, '71': null, '12': null};

var queue1 = async.queue(post, 20); // parallel tasks
// var queue2 = async.queue(post, 1); // ensure sync, avoid deadlocks
queue1.drain = function () {
  util.log(':::queue1 empty:::');
}
// queue2.drain = function () {
//   util.log(':::queue2 empty:::');
// }

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

// function insertOrUpdate (b, cb) {
//   Step(
//     function () {
//       var geom = "ST_SetSRID(ST_GeomFromGeoJSON('{\"type\":\"LineString\","
//           + "\"coordinates\":[[" + b.lon + "," + b.lat + "," + b.timestamp
//           + "]]}'), 4326)";
//       var vals = geom + "," + b.speedKmHr + "," + b.secsSinceReport + ",'"
//           + b.routeTag + "'";
//       queue1.push("INSERT INTO sf_muni_paths (spacetime,speedkmhr,"
//           + "secssincereport,routetag,id) VALUES ("
//           + vals + "," + b.id + ")", this);
//     },
//     function (err, data) {
//       if (err && err[0] && err[0].indexOf('_idx') !== -1) {
//         return this(null, true);
//       }
//       this(err);
//     },
//     function (err, update) {
//       if (err) return this(err);
//       if (!update) {
//         return this();
//       }
//       var geom = "ST_Simplify(ST_AddPoint(spacetime, ST_SetSRID(ST_MakePoint("
//           + b.lon + "," + b.lat + "," + b.timestamp + "),4326)),0.001)";
//       var vals = geom + "," + b.speedKmHr + "," + b.secsSinceReport + ",'"
//           + b.routeTag + "'";
//       queue1.push("UPDATE sf_muni_paths SET (spacetime,speedkmhr,"
//           + "secssincereport,routetag) = ("
//           + vals + ") WHERE id = " + b.id, this);
//     },
//     function (err, data) {
//       cb(err);
//     }
//   );
// }

f = ref.child(name + "/vehicles");
f.on("value", function (s) {
  var n = Date.now();
  if (lastInsert && n - lastInsert < interval) {
    util.log('Skipped update. Will take next in '
        + Math.round(((interval - (n - lastInsert)) / 1e3)));
    return;
  }
  lastInsert = n;
  var bs = s.val();

  var values = "";
  function _addToBatchInsert(b) {
    var d = new Date(b.timestamp);
    var ts = d.getUTCFullYear() + '-' + (d.getUTCMonth()+1)
        + '-' + d.getUTCDate() + 'T' + d.getUTCHours() + ':'
        + d.getUTCMinutes() + ':' + d.getUTCSeconds() + 'Z';
    var geom = "ST_SetSRID(ST_MakePoint(" + b.lon + "," + b.lat + "),4326)";
    var vals = b.id + "," + geom + "," + b.speedKmHr + "," + b.secsSinceReport
        + ",'" + b.routeTag + "'," + b.heading + ",'" + b.dirTag
        + "','" + b.vtype + "'," + b.predictable + ",TIMESTAMP '" + ts + "'";
    values += "(" + vals + "),";
  }

  _.each(bs, function (b) {
    // if (track[b.routeTag] === undefined) {
    //   return;
    // }
    // if (track[b.routeTag] === b.id || track[b.routeTag] === null) {
    //   track[b.routeTag] = b.id;
    _addToBatchInsert(b);
    // }
  });

  if (values[values.length - 1] === ',') {
    values = values.substr(0, values.length - 1);
  }
  values = "INSERT INTO sf_muni_points "
      + "(id,the_geom,speedkmhr,secssincereport,routetag,heading,dirtag,vtype"
      + ",predictable,timestamp) VALUES " + values;
  queue1.push(values, function (err, data) {
    if (err) console.log(err);
  });
});

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(5000);
