const express = require('express'),
      app = express.createServer(),
      io = require('socket.io').listen(app),
      gc = require('node-gcstats'),
      mtrace = require('mtrace'),
      worker = require('./worker');

var clients = [];

app.configure(function(){
  app.use(express.static(__dirname + '/static'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.listen(process.env['PORT'] || 3000, function() {
  console.log("leaky server listening on port %d", app.address().port);
});

// reduce socket.io logging noise
io.set('log level', 1);

io.sockets.on('connection', function(socket) {
  clients.push(socket);

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

      default:
        console.log("what is " + message + "?");
        break;
    }
  });
});

// every interval, send sample data to the server

setInterval(function() {
  io.sockets.emit('temporal-sample', process.memoryUsage());
}, 250);

// and also emit post-gc stats
gc.on('gc', function(data) {
  io.sockets.emit('post-full-gc-sample', data);
});
gc.on('gc_incremental', function(data) {
  io.sockets.emit('post-incremental-gc-sample', data);
});

// start doing random work
worker.doYourThing();