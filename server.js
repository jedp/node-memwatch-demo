const express = require('express'),
      app = express.createServer(),
      io = require('socket.io').listen(app),
      gc = require('gcstats'),
      config = require('./config'),
      memwatch = require('memwatch'),
      worker = require('./worker');

var hd = new memwatch.HeapDiff();
var lastHD = Date.now();
var clients = [];

app.configure(function(){
  app.use(express.static(__dirname + '/static'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.listen(process.env['PORT'] || 3000, function() {
  console.log("server listening on port %d", app.address().port);
});

// reduce socket.io logging noise
io.set('log level', 1);

io.sockets.on('connection', function(socket) {
  clients.push(socket);

  socket.emit('configure', config.clientConfig);

  socket.on('disconnect', function() {
    clients.splice(clients.indexOf(socket), 1);
  });

  // The buttons in the console can cause us to force GC or do a bunch of work
  socket.on('message', function(message) {
    switch (message) {
      case "do_gc":
        gc.gc();
        break;

      case "add_load":
        worker.doStuff();
        break;

      case "pause":
        io.sockets.emit('pause', {paused: worker.togglePause()});
        break;

      default:
        console.log("what is " + message + "?");
        break;
    }
  });
});

// every interval, send sample data to the server

var allocations = {};
var snoitacolla = {};
function updateHeapDiff(diff) {
  var oldValue;
  var newValue;
  diff.change.details.forEach(function(data) {
    if (allocations[data.what] !== undefined) {
      oldValue = allocations[data.what];
      snoitacolla[oldValue].pop(snoitacolla[oldValue].indexOf(oldValue));
      if (!snoitacolla[oldValue].length) {
        delete snoitacolla[oldValue];
      }
    } else {
      oldValue = 0;
    }
    newValue = oldValue + data["+"] - data["-"];
    allocations[data.what] = newValue;
    if (!snoitacolla[newValue]) snoitacolla[newValue] = [];
    snoitacolla[newValue].push(data.what);
  });
}

function topHeapAllocations(howMany) {
  howMany = howMany || 6;
  var result = [];
  // annoyingly, we have to convert the keys to integers first
  var keys = [];
  Object.keys(snoitacolla).forEach(function(key) { keys.push(parseInt(key, 10)); });
  // sort greatest to least
  keys.sort(function(a,b) {return b-a;});

  keys.slice(0, howMany).forEach(function(key) {
    result.push([key, snoitacolla[key]]);
  });
  return result;
}

setInterval(function() {
  io.sockets.emit('temporal-sample', process.memoryUsage());
}, 333);

// and also emit post-gc stats
var skipOne = true;
gc.on('gc', function(data) {
  data.stats = gc.stats();
  if ((Date.now() - lastHD) > config.hdInterval) {
    updateHeapDiff(hd.end());
    hd = new memwatch.HeapDiff();
    lastHD = Date.now();
    io.sockets.emit('heap-allocations', topHeapAllocations());
  }
  io.sockets.emit('post-full-gc-sample', data);
});
gc.on('gc_incremental', function(data) {
  data.stats = gc.stats();
  io.sockets.emit('post-incremental-gc-sample', data);
});
