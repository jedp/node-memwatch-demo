=================
node-gcstats-demo
=================

This is a demonstration of git://github.com/lloyd/node-gcstats.git, a
library for detecting and identifying memory leaks in Node.JS
applications.

Discovering and Finding Memory Leaks with `node-gcstats`
========================================================

Memory leaks are bad.  They are also notoriously hard to detect.  This
overview will look at one approach,
git://github.com/lloyd/node-gcstats.git, which seeks to help both with
the detection of memory leaks and the identification of their source
in Node.JS applications.

So What?
--------

Cool story, bro, but I've got 2 GB of RAM on this box.  Why should I
care?  What could possibly go wrong?

Well, there are at least three things you should be concerned about:

1. As memory heap size grows, V8 becomes increasingly sluggish.  (In
   part, this is because V8's survival instincts kick in and it starts
   performing full garbage-collections very aggressively.)

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

closures

library code

Tools for Finding Leaks
-----------------------

There is a number of tools for finding leaks in Node.JS applications.

For starters, since this is a memory problem, we can look at `top` or
`htop` or some system utility to discover our memory footprint.

Within Node itself, there is `process.memoryUsage()`, which will
report Node's heap footprint.

Jimb Esser has written
[node-mtrace](https://github.com/Jimbly/node-mtrace), which uses the
GCC `mtrace` utility to profile heap usage.

Danny Coates's
[v8-profiler](https://github.com/dannycoates/v8-profiler) and
[node-inspector](https://github.com/dannycoates/node-inspector)
provide Node bindings for the V8 profiler and a Node debugging
interface using the WebKit Web Inspector.

Felix Geisendörfer's [Node Memory Leak
Tutorial](https://github.com/felixge/node-memory-leak-tutorial) is a
short and sweet explanation of how to use the `v8-profiler` and
`node-debugger`, and is presently the state-of-the-art for most
Node.JS memory leak debugging.

If you are using Joyent's SmartOS platform, there is a tremendous
arsenal of tools at your disposal for [debugging Node.JS memory
leaks](http://dtrace.org/blogs/bmc/2012/05/05/debugging-node-js-memory-leaks/)

What Do We Want To Do About It?
-------------------------------

The memory profiling and debugging tools just mentioned are brilliant,
but they also have some drawbacks.  The Web Inspector approach is
suitable for a few processes while in development, but is difficult to
use on a live deployment, especially when multiple servers and
subprocess are involved in the mix.  As such, it may be difficult to
reproduce memory leaks that bite in long-running and heavily-loaded
production environments.  Tools like `dtrace` and `libumem` are
awe-inspiring, but platform-specific.

We would like to have a platform-independent debugging library that
can alert us when our programs might be leaking memory, and help us
find where they are leaking.

We want a simple API using an `EventEmitter` like this:

```javascript
foo.on('leak', function(leakData) {
 // Looks like there's a leak!  See leakData for details
});
```

And in order to follow the memory usage of a Node.JS application, it
is sometimes desirable to force V8 to perform a full garbage
collection and compaction, after which we can determine the actual
memory usage.  So another important API call would instruct V8 to
perform a full GC, and asynchronously return statistics about the heap
before any new objects have been allocated:

``javascript
foo.gc(function(memData) {
  // We forced GC and now can look at clean memory data
});
```

Tracking Memory Usage
---------------------

A simple approach would be to repeatedly call `memoryUsage()` at a fixed
interval and see if there's a positive delta in heap allocations.

We'll make a simple EventEmitter that emits the memory usage every
minute or so, and plot the usage over time.

Let's try a well-behaved program with no leaks:

  [ demo example 1 ]

Ok, I can see the memory usage spiking up and down - but could I know
for certain that this program was not leaking?  How many days would it
have to run for to produce a useful trend?

Following Post-GC Heap Statistics
---------------------------------

temporal samples naive - how about post-gc

V8 provides a nice post-gc hook, `V8::AddGCEpilogueCallback`, that
lets us execute some code before the js thread has a chance to
allocate any new objects.  So this gives us a more meaningful view of
the heap - after GC (and compaction), we can see the minimum heap
size over time.

So we'll make a simple native module that simply sends us some heap
size statistics every time GC occurs.  We'll emit this data up to our
graph whenever it arrives.

[ demo example 2 ]

This seems promising.  We can plot the base memory usage over time.

Trending Heuristics
-------------------

We can add some analysis to this data and try to establish a trend in
usage over time.

- usage_trend
- current_base
- estimated_base
- num_full_gc
- num_inc_gc
- heap_compactions
- min
- max

So let's try this with a leaky program and see what happens.

[ demo example 3 ]

Where Is The Leak?
------------------

Once we have a leak detector, we need a leak identifier.  How do we know where to look?

The classic approach is at this point to make a huge pot of coffee,
lock yourself in a closet, and start bisecting code for hours or days
until you find the offender.

A more contemporary approach would involve using some of the powerful
debugging and introspection tools:

- dtrace
- node-inspector
- node-mstats
- node-heap-dump

The great thing here is being able to get the names of the guilty
parties quickly.

But there are some limitations with these approaches

- maybe platform specific
- maybe require interactive monitoring of single processes

What if you have lots of processes?  What if they spawn subprocesses?
It gets complicated.

We want to have the benefit of progressive heap diffing, but we also
want the programs to do the work of monitoring themselves and telling
us when something might be wrong.

Traversing the Heap
-------------------

use named constructors for heap data to be meaningful
