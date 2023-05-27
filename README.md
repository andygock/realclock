# Real Clock

A minimalistic accurate clock written in vanilla JS. Shows the exact real time even if your local time is incorrect. It fetches the correct time from [WorldTimeAPI](https://worldtimeapi.org/) and compensates for network latency.

![screenshot](screenshot.png)

## Demo

<https://realclock.surge.sh/>

## Alternative API server

If you did not want to use [WorldTimeAPI](https://worldtimeapi.org/), an Express server is provided in the `time-server/` dir.
