// A worker.  Sometimes well-behaved, sometimes not.

var fs = require('fs');
var path = require('path');

var paused = true;
var config = require('./config');
console.log("worker config: leak=" + config.leak);

var numToSpawn = 100;
var leak = [];

var bigText = fs.readFileSync(path.join(__dirname, 'something.txt'));
console.log("read %d bytes for bigText", bigText.length);

function SlowTask() {
  this.stuff = bigText;
}

var doYourThing = module.exports.doYourThing = function doYourThing() {
  goFastWorkers(250);
  goSlowWorkers(400);
  if (config.leak) goLeakyWorkers();
};

var togglePause = module.exports.togglePause = function() {
  if (paused) {
    paused = false;
    doYourThing();
  } else {
    paused = true;
  }
  return paused;
};

var goSlowWorkers = function goSlowWorkers(interval) {
  if (paused) {
    return;
  }
  var obj = {};

  // A non-leaking bunch of work that lasts a fairly long time
  if (Math.random() > 0.1) {
    //console.log("spawn slow workers.  interval: " + interval);
    var spawned = 0;
    // make a huge object and hold onto it for 1/2 sec
    for (var i=0; i<100;i++) {
      obj[i] = new SlowTask;
    }
    setTimeout(function() {
      //console.log("freeing obj");
      obj = undefined;
      setTimeout(function(){goSlowWorkers(Math.random()*200+200);}, interval);
    }, 100);
  } else {
    obj = undefined;
    setTimeout(function(){goSlowWorkers(Math.random()*200+200);}, interval);
  }
};

var goFastWorkers = function goFastWorkers(interval) {
  if (paused) {
    return;
  }
  // A non-leaking bunch of work that lasts a short time
  if (Math.random() > .5) {
    //console.log("spawn fast workers.  interval: " + interval);
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
    things = undefined;
    setTimeout(function(){goFastWorkers(Math.random()*100+100);}, Math.floor(Math.random()*interval));
  }
};

function DeathBunny(someInput) {
  this.info = Math.random();
  this.foo = someInput;
  return this.foo + this.info;
};
var goLeakyWorkers = function goLeakyWorkers() {
  if (paused) {
    return;
  }
  // A buncho of work that leaks periodically
  if (Math.random() > .995) {
    var max = Math.floor(Math.random() * 10);
    console.log("LEAKING " + max);
    var txt = "";
    for (var i=0; i<max; i++) {
      // concat a new huge string each time
      leak.push( new DeathBunny(Math.random() + bigText.slice(i)) );
    }
  }
  setTimeout(goLeakyWorkers, 10);
};

var doStuff = module.exports.doStuff = function doStuff() {
  if (paused) {
    return;
  }
  // simulate load spike
  // Called by the "do stuff" button in the console
  var stuff = "";
  var done = 0;
  function next() {
    stuff += done.toString() + bigText;
    done += 1;
    if (done < 200) {
      setTimeout(next, 10);
    }
  }
  next();
};