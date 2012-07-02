window.Graph = {};

(function() {
  var MB = 1000 * 1000; // actual 1024*1024 makes the resulting text confusing to compare
  var   w = 600,
        h = 300,
   margin = 100;

  var vis = d3.select( document.getElementById('graph') )
    .append("svg:svg")
    .attr("width", w)
    .attr("height", h);

  var base = vis.append("svg:g").attr("transform", "translate(0, 300)");
  var g = vis.append("svg:g").attr("transform", "translate(45, 300)");

  // data sets we're collecting
  var timeSamples = [0];
  var gcFullSamples = [0];
  var nextFullSample = null;
//  var gcIncrementalSamples = [0];
  var heapSize = 0;
  var heapLeast = Infinity;
  var currentBase = 0;
  var estimatedBase = 0;

  var MAX_HISTORY = 350;

  function updateData(arr, data) {
    arr.push(data);
    if (arr.length > MAX_HISTORY) arr.shift();
  }

  function drawLine(data) {
    var y = d3.scale.linear().domain([0, heapSize]).range([0, h]),
        x = d3.scale.linear().domain([0, MAX_HISTORY]).range([0, w - margin]);

    var line = d3.svg.line()
      .x(function(d,i) { return x(i); })
      .y(function(d) { return -1 * y(d); });

    g.append("svg:path").attr("d", line(data));

    // now for a max label
    base.append("svg:text")
      .attr("class", "linktext, data")
      .attr('x', 550)
      .attr('y', 16-h)
      .text(heapSize.toFixed(1));
    // show the estimatedBase size, tracking in y with its curve
    base.append("svg:text")
      .attr("class", "linktext, data")
      .attr('x', 550)
      .attr('y', (currentBase/heapSize || 0) * (16 - h))
      .text(currentBase.toFixed(1));
//    base.append("svg:text").attr("class", "linktext, data")
//      .attr('x', 550)
//      .attr('y', (heapLeast/heapSize) * (16-h))
//      .text(heapLeast.toFixed(1));
  }

  Graph.addGcData = function(type, gcData) {
    // fields are:
    //    compacted: bool
    //    stats:   { num_full_gc:      int
    //               num_inc_gc:       int
    //               heap_compactions: int
    //               usage_trend:      float
    //               estimated_base:   bytes
    //               current_base:     bytes
    //               min:              { bytes: bytes, when: Date }
    //               max:              { bytes: bytes, when: Date } }
    //
    // convert all units to MB
    currentBase = gcData.current_base / MB;
    estimatedBase = gcData.estimated_base / MB;
    var usage_trend = gcData.usageTrend;

    heapLeast = Math.min(heapLeast, gcData.current_base / MB);
    if (type === 'full') {
      nextFullSample = currentBase;
    }
  };

  Graph.addFullGcData = function(gcData) {
    Graph.addGcData('full', gcData);
  };

  Graph.addIncrementalGcData = function(gcData) {
    Graph.addGcData('incremental', gcData);
  };

  Graph.addTimeSample = function(timeData) {
    // fields are:
    //     rss:       bytes
    //     heapTotal: bytes
    //     heapUsed:  bytes
    //
    // Convert all units to MB
    var heapUsed = timeData.heapUsed / MB;
    heapSize = Math.max(heapUsed, heapSize);

    Graph.replot({timeSample: heapUsed});
  };

  Graph.replot = function(sample) {
    var numSamples = timeSamples.length;
    if (sample.timeSample) {
      updateData(timeSamples, sample.timeSample);
      if (nextFullSample !== null) {
        updateData(gcFullSamples, nextFullSample);
        nextFullSample = null;
      } else {
        updateData(gcFullSamples, gcFullSamples[numSamples-1]);
      }
    }

    d3.selectAll('svg path').remove();
    d3.selectAll('svg text').remove();

    drawLine(timeSamples, "MB");
//    drawLine(gcIncrementalSamples, "MB");
    drawLine(gcFullSamples, "MB");
  };
})();
