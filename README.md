# Real Clock

A minimalistic accurate clock written in vanilla JS. Shows the exact real time even if your local time is incorrect. It fetches the correct time from [WorldTimeAPI](https://worldtimeapi.org/) and compensates for network latency.

![screenshot](screenshot.png)

The color changes at each multiple of 5 seconds to assist in synchronizing a physical watch or clock.

## Demo

HTML + CSS + Vanilla JS, as is:
<https://andygock.github.io/realclock/>

Vite build: <https://realclock.surge.sh/>

The Vite build may be more compatible with really old browsers, but the [GitHub Pages](https://andygock.github.io/realclock/) hosted version should work with all modern browsers.

## Alternative API server

If you did not want to use [WorldTimeAPI](https://worldtimeapi.org/), an Express server is provided in the `time-server/` dir.
