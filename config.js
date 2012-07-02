module.exports = {
  /*
   * leak
   *        (boolean)  Set to true to leak memory
   */
  leak: false,

  /*
   * hdInterval
   *        (integer)  Minimum interval in ms to perform heapdump
   *                   comparisons.  Note that heapdump triggers gc,
   *                   so you can't do heapdump on gc without getting
   *                   yourself into a pretty tight loop.
   */
  hdInterval: 1000 * 5,

  /*
   * clientConfig
   *        (dict)     What to show in the client
   *
   *                   'usage' specifies a comma-separated list of
   *                   "events", "usage", and "allocations".  Because
   *                   of space constraints and my laziness, "usage"
   *                   and "allocations" are mutually exclusive.  So
   *                   you can have "events", "envents,usage",
   *                   "events,allocations", or just plain "usage" or
   *                   "allocations".
   *
   *                   'title' specifies the title at the top of the
   *                   page.  Useful if you're demo'ing to an audience.
   */
  clientConfig: {
    title: "Memory Usage of a Well-Behaved (?) Program",
    show: "events,allocations"
  }
};
