// A worker.  Sometimes well-behaved, sometimes not.

var fs = require('fs');
var numToSpawn = 100;

var leak = [];
var bigText = fs.readFileSync('/etc/services');

var doYourThing = module.exports.doYourThing = function doYourThing() {
  goFastWorkers(250);
//  goFastWorkers(350);
  goSlowWorkers(400);
//  goLeakyWorkers();
};

var goSlowWorkers = function goSlowWorkers(interval) {
  // A non-leaking bunch of work that lasts a fairly long time
  if (Math.random() > 0.1) {
    console.log("spawn slow workers.  interval: " + interval);
    var spawned = 0;
    var obj = {};
    // make a huge object and hold onto it for 1/2 sec
    for (var i=0; i<100;i++) {
      obj[i] = i + bigText;
    }
    setTimeout(function() {
      console.log("freeing obj");
      obj = undefined;
      setTimeout(function(){goSlowWorkers(Math.random()*200+200);}, interval);
    }, 100);
  } else {
    setTimeout(function(){goSlowWorkers(Math.random()*200+200);}, interval);
  }
};

var goFastWorkers = function goFastWorkers(interval) {
  // A non-leaking bunch of work that lasts a short time
  if (Math.random() > .5) {
    console.log("spawn fast workers.  interval: " + interval);
    var workers = Math.floor(Math.random() * numToSpawn);
    var spawned = 0;
    function spawn() {
      spawned ++;
      var txt = "";
      for (var i=0; i<100; i++) {
        txt += i + bigText;
      }
    }
    function spawnNext() {
      spawn();
      if (spawned < workers) {
        setTimeout(spawnNext, 15);
      } else {
        setTimeout(function(){goFastWorkers(interval);}, Math.floor(Math.random()*interval));
      }
    }
    spawnNext();
    numToSpawn += Math.floor(numToSpawn / 72);
  } else {
    setTimeout(function(){goFastWorkers(Math.random()*100+100);}, Math.floor(Math.random()*interval));
  }
};

var goLeakyWorkers = function goLeakyWorkers() {
  // A buncho of work that leaks periodically
  if (Math.random() > .999) {
    console.log("LEAKING");
    for (var i=0; i<42; i++) {
      // concat a new huge string each time
      leak.push(i + bigText);
    }
  }
  setTimeout(goLeakyWorkers, 10);
};

var doStuff = module.exports.doStuff = function doStuff() {
  // simulate load spike
  // Called by the "do stuff" button in the console
  var stuff = "";
  var done = 0;
  function next() {
    stuff += Math.random() + bigText;
    done += 1;
    if (done > 500) {
      stuff = undefined;
    } else {
      setTimeout(next, Math.random() * 10);
    }
  }
  next();
};