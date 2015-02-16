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

function post(q, cb) {
  util.log(q);
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
      queue.push("INSERT INTO sf_muni_paths (the_geom,spacetime,speedkmhr,"
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
      queue.push("UPDATE sf_muni_paths SET (spacetime,speedkmhr,"
          + "secssincereport,routetag) = ("
          + vals + ") WHERE id = " + b.id, this);
    },
    function (err, data) {
      cb(err);
    }
  );
}

var queue = async.queue(post, 20);
queue.drain = function() {
  util.log(':::queue empty:::');
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
    queue.push(values, function (err, data) {
      if (err) console.log(err);
    });
  }
});

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(5000);



// UPDATE sf_muni_paths SET (spacetime,speedkmhr,secssincereport,routetag) = (ST_Simplify(ST_AddPoint(spacetime,v.point),0.001),v.speedkmhr,v.secssincereport,v.routetag) FROM (VALUES (3,ST_SetSRID(ST_MakePoint(-122.40819,37.78843,1424108088480),4326),0,4,'60')) AS v(id,point,speedkmhr,secssincereport,routetag) WHERE sf_muni_paths.id = v.id


// ST_Simplify(ST_AddPoint(spacetime,v.spacetime),0.001)


// SELECT ST_MakeLine(the_geom_webmercator ORDER BY timestamp ASC) AS the_geom_webmercator, id FROM track_sf_muni GROUP BY id
// update sf_muni_paths set (the_geom) = (ST_SetSRID(ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[3,2],[4,5],[7,8]]}'), 4326)) where cartodb_id = 1412364
// update sf_muni_paths set (the_geom) = (ST_AddPoint(the_geom, CDB_LatLng(11,5))) where cartodb_id = 1412364
// ALTER TABLE sf_muni_paths ALTER COLUMN spacetime TYPE geometry(LineStringZ) USING ST_Force_3D(spacetime)


// CREATE TRIGGER syncGeom
//     AFTER UPDATE ON sf_muni_paths
//     FOR EACH ROW
//     WHEN (pg_trigger_depth() = 0)
//     EXECUTE PROCEDURE dropZ();


// CREATE OR REPLACE FUNCTION dropZ() RETURNS TRIGGER AS $$
//     BEGIN
//         UPDATE sf_muni_paths SET the_geom = ST_Force_2D(NEW.spacetime) WHERE id = NEW.id;
//         RETURN NEW;
//     END;
// $$ language plpgsql;


// ST_SetSRID(ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[]]}'),4326)

// select path, ST_X(geom) as x from 
// (SELECT id, (ST_DumpPoints(spacetime)).path,(ST_DumpPoints(spacetime)).geom FROM sf_muni_paths where id = 8323) as foo where path = ARRAY[2]





// with (select path, ST_X(geom) as x, ST_Y(geom) as y from (
//   SELECT id, (ST_DumpPoints(spacetime)).path[1],(ST_DumpPoints(spacetime)).geom FROM sf_muni_paths where id = 8323 as foo
// )) select max(path) from foo as bar



// select max(path) from (select path, ST_X(geom) as x, ST_Y(geom) as y from (select id, (ST_DumpPoints(spacetime)).path[1],(ST_DumpPoints(spacetime)).geom FROM sf_muni_paths where id = 8323) as foo) as bar


// SELECT ST_MakeLine(the_geom_webmercator ORDER BY timestamp ASC) AS the_geom_webmercator, id FROM track_sf_muni GROUP BY id
