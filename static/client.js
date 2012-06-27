var socket = io.connect('/');

function formatNumber(num) {
  // formats 12345003 as "12,345,003"
  var ords = [];
  var s = "";
  var i;
  while(num > 0) {
    s = (num % 1000).toString();

    // makes sure all digit groups except the first are
    // 0-prefixed.
    if (num > 999) {
      for (i=s.length; i<3; i++) {
        s = "0" + s;
      }
    }
    ords.unshift(s);
    num = (num / 1000).toFixed(0);
    if (ords.length > 4) break;
  }
  // type casting to string ok
  return ords.join(',');
}

/*
 * receive messages from server.  We can get one of three messages:
 * - memory sample (periodic memoryUsage() results)
 * - partial GC stats
 * - full GC stats
 */


socket.on('temporal-sample', function(data) {
  $('.RSS .data').text(formatNumber(data.rss));
  $('.heapTotal .data').text(formatNumber(data.heapTotal));
  $('.heapUsed .data').text(formatNumber(data.heapUsed));
  Graph.addTimeSample(data);
});

function updateGCDataList(stats) {
  $('.usageTrend .data').text(stats.usage_trend.toFixed(2));
  $('.fullGCCount .data').text(formatNumber(stats.num_full_gc));
  $('.incrGCCount .data').text(formatNumber(stats.num_inc_gc));
  $('.heapCompactions .data').text(stats.heap_compactions);
}
socket.on('post-full-gc-sample', function(data) {
  $('.currentBase .data').text(formatNumber(data.stats.current_base));
  $('.estimatedBase .data').text(formatNumber(data.stats.estimated_base));
  updateGCDataList(data.stats);
  Graph.addGcData('full', data);
});

socket.on('post-incremental-gc-sample', function(data) {
  $('.currentBase .data').text(formatNumber(data.stats.current_base));
  $('.estimatedBase .data').text(formatNumber(data.stats.estimated_base));
  updateGCDataList(data.stats);
  Graph.addGcData('incremental', data);
});

socket.on('pause', function(data) {
  if (data.paused) {
    $('.pause-button').addClass('paused').text('GO');
    $('#add_load').addClass('disabled');
  } else {
    $('.pause-button').removeClass('paused').text('STOP');
    $('#add_load').removeClass('disabled');
  }
});

/*
 * Interface - the operator can:
 * - choose "Force Compaction", which calls gc() on the gcstats obj
 * - choose "Make It Busy", which adds load to the server for a second or two
 */
$('#do_gc').on('click', function() {
  socket.send("do_gc");
});

$('#add_load').on('click', function() {
  socket.send("add_load");
});

$('#pause').on('click', function() {
  socket.send("pause");
});