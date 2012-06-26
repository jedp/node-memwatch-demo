questions and things to do

- make node-gcstats npm installable

- some kind of heap diffing - I know I have a leak, but now I want
  help narrowing down where to look.

- how shall we use usage_trend?  After a huge usage surge, even with
  leaky code, it ends up being negative for a long time.

- will it be possible to demo the old http-referer bug live? that would be cool

- eventually make branches for re-deploy on awsbox to show
  - well-behaved program with temporal reporting only
  - well-behaved with temporal and gcstats together
    - show gc() function with "force compaction" button
  - ill-behaved with temporal and gcstats reporting

- i kind of want nyan cat flying through the graph ...
