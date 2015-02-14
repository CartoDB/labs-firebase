#!/usr/bin/env node

var fs = require('fs');
var curl = require('curlrequest');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Firebase = new require('firebase');
var ref = new Firebase('https://publicdata-transit.firebaseio.com/');
var name = 'brooklyn';

f = ref.child(name + "/vehicles");
f.on("child_changed", function (s) {
  var b = s.val();

  var d = new Date(b.timestamp);
  
  var ts = d.getUTCFullYear() + '-' + (d.getUTCMonth()+1)
      + '-' + d.getUTCDate() + 'T' + d.getUTCHours() + ':'
      + d.getUTCMinutes() + ':' + d.getUTCSeconds() + 'Z';

  var names = 'the_geom,dirtag,heading,routetag,id,speedkmhr,predictable,'
      + 'secssincereport,timestamp';
  var values = 'CDB_LatLng(' + b.lat + "," + b.lon + '),';
  values += "'" + b.dirTag + "'," + b.heading + ",'" + b.routeTag + "',"
      + b.id + "," + b.speedKmHr + ",'" + b.predictable + "',"
      + b.secsSinceReport + ",TIMESTAMP '" + ts + "'";

  var query = "INSERT INTO buses_brooklyn (" + names + ") VALUES (" + values + ")";
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
      console.log(err, data)
      // if (data) {
      //   data = JSON.parse(data);
      //   if (data.error) {
      //     console.log(data.error);
      //   }
      // } else if (err) {
      //   console.log(err);
      // }
    }
  );
});


// firebase.set(trains);


//   function map(features, cb) {
//     if (features.length === 0) {
//       return cb(null, 0);
//     }
//     var tz = {P: 'PST', M: 'MST', C: 'CST', E: 'EST'};
//     var names = 'the_geom, destcode, eventcode, eventdt, eventschar, '
//         + 'eventschdp, eventt, eventtz, heading, id, lastvalts, origcode, '
//         + 'origschdep, origintz, routename, trainnum, trainstate, velocity, '
//         + 'lastvaltsts, lastvaldt';
//     var values = '';
//     var cnt = 0;
//     var trains = {};
//     _.each(features, function (f, i) {
//       p = f.properties;

//       if (p.OriginTZ && p.LastValTS) {
//         var train = {
//           latitude: f.geometry.coordinates[1],
//           longitude: f.geometry.coordinates[0],
//           destcode: p.DestCode || 'null',
//           eventcode: p.EventCode || 'null',
//           eventdt: p.EventDT || 'null',
//           eventschar: p.EventSchAr || 'null',
//           eventschdp: p.EventSchDp || 'null',
//           eventt: p.EventT || 'null',
//           eventtz: p.EventTZ || 'null',
//           heading: p.Heading || 'null',
//           id: p.ID || 'null',
//           lastvalts: p.LastValTS,
//           origcode: p.OrigCode || 'null',
//           origschdep: p.OrigSchDep || 'null',
//           origintz: p.OriginTZ || 'null',
//           routename: p.RouteName || 'null',
//           trainnum: p.TrainNum || 'null',
//           trainstate: p.TrainState || 'null',
//           velocity: p.Velocity || 'null'
//         };

//         var d = new Date(train.lastvalts + ' ' + tz[p.OriginTZ]);
//         train.lastvaltsts = d.getTime() / 1000;
//         train.lastvaldt = d.getUTCFullYear() + '-' + (d.getUTCMonth()+1)
//             + '-' + d.getUTCDate() + 'T' + d.getUTCHours() + ':'
//             + d.getUTCMinutes() + ':' + d.getUTCSeconds() + 'Z';

//         values += '(';
//         values += 'CDB_LatLng(' + train.latitude + "," + train.longitude + '),';
//         values += "'" + train.destcode + "','" + train.eventcode + "','" + train.eventdt
//             + "','" + train.eventschar + "','" + train.eventschdp + "','" + train.eventt
//             + "','" + train.eventtz + "','" + train.heading + "'," + train.id + ",'"
//             + train.lastvalts + "','" + train.origcode + "','" + train.origschdep + "','"
//             + train.origintz + "','" + train.routename + "'," + train.trainnum + ",'"
//             + train.trainstate + "'," + train.velocity + "," + train.lastvaltsts
//             + ",TIMESTAMP '" + train.lastvaldt + "'";
//         values += ')';
//         if (i !== features.length - 1) {
//           values += ',';
//         }
//         trains[train.id] = train;
//         ++cnt;
//       }
//     });

//     if (cnt === 0) {
//       return cb(null, 0);
//     }

//     firebase.set(trains);
//     cb(null, trains);
//   }
// });

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(5000);
