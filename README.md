Discovering and Finding Memory Leaks with `node-memwatch`
=========================================================

Memory leaks are bad.  They are also notoriously hard to detect.

We present [node-memwatch](https://github.com/lloyd/node-memwatch) as
a tool to help detect and track down memory leaks.

This document is the outline of a presentation to be given at
[NodeConf 2012](http://nodeconf/).  It describes some examples of
memory leaks and the problems they can cause, lists some well-known
tools and methods for detecting and finding Node.JS memory leaks, and
introduces `node-memwatch`, which we believe has some unique
advantages.

To run this demonstration:

- Clone this repo (`git clone git://github.com/jedp/node-memwatch-demo.git`)
- `npm install`
- Edit `config.js` (instructions inside)
- `npm start`
- Visit http://localhost:3000/

Don't forget to kill the server if you're running in 'leak' mode or
your computer will hate you!

Memory Leaks?  So What?
-----------------------

Cool story, bro, but I've got 2 GB of RAM on this box.  Why should I
bother spending days tracking down hard-to-find leaks when I can just
restart?

Well, there are at least three things you should be concerned about:

1. As memory heap size grows, V8 becomes increasingly sluggish.  (In
   part, this is because V8's survival instincts kick in and it starts
   performing full garbage-collections very aggressively.)  Memory
   leaks hurt performance.

2. Leaks can be a vector for other types of failure.  If your leaky
   code is hanging onto references to other resources, you may find
   you run out of file descriptors, for example, before you run out of
   memory.  So your app might still trudge along, but your database
   might be inaccessible.

3. Eventually, your stuff will crash.  And it will probably happen
   right when you're getting popular.  And then everybody will laugh
   and it will be horrid.

Some Examples of Leaks
----------------------

Closures are the most notorious source of memory leaks in JavaScript.
This is because closures maintain references to their scope and all
variables therein.  For example:

```javascript

```

Leaks like this will probably be spotted eventually if somebody's
looking for them.  But in Node's asynchronous world, we generate
closures all the time in the form of callbacks.  If these callbacks
are not handled as fast as they are created, memory allocations will
build up and code that doesn't look leaky will act leaky.  That's
harder to spot.

And what if your application is leaking due to a bug in upstream code?
You may be able to track down the location in your code from where the
leak is emanating, but you might just stare in bewilderment at your
perfectly-written code wondering how in the world it can be leaking!
For example, until fairly recently, anyone using `http.ClientRequest`
was leaking a teensy bit of memory.  Long-running services under heavy
load were leaking a lot of memory.  (The fix in the Node codebase was
a change of a [mere two
characters](https://github.com/vvo/node/commit/e138f76ab243ba3579ac859f08261a721edc20fe), replacing the method `on()` with the method `once()`.)


Tools for Finding Leaks
-----------------------

The classic approach is at this point to make a huge pot of coffee,
lock yourself in a closet, and start bisecting code for hours or days
until you find the offender.

Since this is a memory problem, we can start by looking at `top` or
`htop` or some system utility to discover our memory footprint.

Within Node itself, there is `process.memoryUsage()`, which will
report Node's heap footprint.

But that won't get us far.  We need tools to help us find leaks.
Happily, there is a growing collection of good collection of tools for
finding leaks in Node.JS applications.

- Jimb Esser's
  [node-mtrace](https://github.com/Jimbly/node-mtrace), which uses the
  GCC `mtrace` utility to profile heap usage.

- Dave Pacheco's
  [node-heap-dump](https://github.com/davepacheco/node-heap-dump)
  takes a snapshot of the V8 heap and serializes the whole thing out
  in a huge JSON file.  It includes tools to traverse and investigate
  the resulting snapshot in JavaScript.

- Danny Coates's
  [v8-profiler](https://github.com/dannycoates/v8-profiler) and
  [node-inspector](https://github.com/dannycoates/node-inspector)
  provide Node bindings for the V8 profiler and a Node debugging
  interface using the WebKit Web Inspector.

- Felix Gnass's fork of the same that [un-disables the retainers
  graph](http://fgnass.posterous.com/finding-memory-leaks-in-nodejs-applications)

- Felix Geisendörfer's [Node Memory Leak
  Tutorial](https://github.com/felixge/node-memory-leak-tutorial) is a
  short and sweet explanation of how to use the `v8-profiler` and
  `node-debugger`, and is presently the state-of-the-art for most
  Node.JS memory leak debugging.

- Joyent's SmartOS platform, which furnishes an arsenal of tools at
  your disposal for [debugging Node.JS memory
  leaks](http://dtrace.org/blogs/bmc/2012/05/05/debugging-node-js-memory-leaks/)

All these tools are brilliant, but they also have some drawbacks.  The
Web Inspector approach is suitable for applications in development,
but is difficult to use on a live deployment, especially when multiple
servers and subprocess are involved in the mix.  As such, it may be
difficult to reproduce memory leaks that bite in long-running and
heavily-loaded production environments.  Tools like `dtrace` and
`libumem` are awe-inspiring, but only work on certain platforms.

Goal of `node-memwatch`
-----------------------

We would like to have a platform-independent debugging library
requiring no instrumentation that can alert us when our programs might
be leaking memory, and help us find where they are leaking.

The API will provide three main things:

- A `'leak'` event emitter

  ```javascript
  memwatch.on('leak', function(info) {
    // look at info to find out about top contributors
  });
  ```

- A `'stats'` event emitter

  ```javascript
  var memwatch = require('memwatch');
  memwatch.on('stats', function(stats) {
    // do something with post-gc memory usage stats
  });
  ````

- A heap diff class

  ```javascript
  var hd = new memwatch.HeapDiff();
  // ... stuff happens ...
  var diff = hd.end();
  ```

- There is also a function to trigger garbage collection which can be
  useful in testing.

  ```javascript
  var stats = memwatch.gc();
  ```

This is what we want to arrive at.  Now let's begin at the beginning.

Tracking Memory Usage
---------------------

Starting with the most basic approach, a simple way to look for leaks
would be to repeatedly call `memoryUsage()` at a fixed interval and
see if there's a positive delta in heap allocations.

To try this we'll make a simple EventEmitter that emits the memory
usage every minute or so, and plot the usage over time.  We'll write a
simple, well-behaved program and track its memory usage:

  - run example 1

Heap usage spikes up and down chaotically, and it may be difficult to
find a meaningful trend.  How long will we have to wait to know that
we have a leak?  How long to convince ourselves that we don't have a
leak?


`memwatch.on('stats', ...)`: Post-GC Heap Statistics
----------------------------------------------------

We can do a lot better.  We can sample memory usage directlyafter a
full garbage-collection and memory compaction, before any new JS
objects have been allocated.

We'll make a native module utilizing V8's post-gc hook,
`V8::AddGCEpilogueCallback`, and gather heap usage statistics every
time GC occurs.  We'll emit this data up to our graph whenever it
arrives.

This is the first part of our API, the `'stats'` event emitter.  It
will emit a message containing the following:

- usage_trend
- current_base
- estimated_base
- num_full_gc
- num_inc_gc
- heap_compactions
- min
- max


  - run example 2

This seems promising.  We can see the base memory usage over time much
more clearly.

We can also prove that `memwatch` itself doesn't leak memory.


`memwatch.on('leak', ...)`: Heap Allocation Trends
--------------------------------------------------

In this example, we introduce a leaky function to see how our profiler
behaves.

We can add some analysis to this data and try to establish a trend in
usage over time.

So let's try this with a leaky program and see what happens.

![leak-gc-events](https://github.com/jedp/node-memwatch-demo/raw/master/doc/leak-gc-events.png)

We can see clearly that the base heap usage only goes up and up.  The
indicator `usage_trend` remains positive, showing us that we're
allocating more and more heap over time.

`memwatch` will keep an eye on this for you, and emit a `'leak'` event
if heap allocation has grown through five consecutive GCs.  It tells
you in nice, human-readable form what's going on.

```javascript
{ start: Fri, 29 Jun 2012 14:12:13 GMT,
  end: Fri, 29 Jun 2012 14:12:33 GMT,
  growth: 67984,
  reason: 'heap growth over 5 consecutive GCs (20s) - 11.67 mb/hr' }
```

`memwatch.HeapDiff()`: Finding Leaks
------------------------------------

Now that we have a leak detector, we want a leak identifier.

By traversing the V8 heap graph, `memwatch` can collect the names and
allocation counts for all objects on the heap.  By comparing two
successive heap snapshots, we can produce a diff.

The API is:

javascript```
var hd = new memwatch.HeapDiff();

// do something ...

var diff = hd.end();
```

The contents of `diff` will look something like this:

```javascript
{
  "before": {
    "nodes": 11625,
    "size_bytes": 1869904,
    "size": "1.78 mb"
  },
  "after": {
    "nodes": 21435,
    "size_bytes": 2119136,
    "size": "2.02 mb"
  },
  "change": {
    "size_bytes": 249232,
    "size": "243.39 kb",
    "freed_nodes": 197,
    "allocated_nodes": 10007,
    "details": [
      {
        "what": "Array",
        "size_bytes": 66688,
        "size": "65.13 kb",
        "+": 4,
        "-": 78
      },
      {
        "what": "Code",
        "size_bytes": -55296,
        "size": "-54 kb",
        "+": 1,
        "-": 57
      },
      {
        "what": "LeakingClass",
        "size_bytes": 239952,
        "size": "234.33 kb",
        "+": 9998,
        "-": 0
      },
      {
        "what": "String",
        "size_bytes": -2120,
        "size": "-2.07 kb",
        "+": 3,
        "-": 62
      }
    ]
  }
}
```

// XXX add timestamp to before/after?

`HeapDiff` triggers a full GC before taking its samples, so the data
won't be full of a lot of junk.  `memwatch`'s event emitters will not
notify of `HeapDiff` GC events, so you can safely put `HeapDiff` calls
in your `'stats'` handler.

![heap-allocations](https://github.com/jedp/node-memwatch-demo/raw/master/doc/leak-allocations.png)

