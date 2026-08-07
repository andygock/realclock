(() => {
  const serverUrl = "/api/time";

  // calculate the offset of API server time compared with local time, in milliseconds
  // compensates for network latency, assume equal round trip time in each direction
  // +ve offset means local clock is running behind server clock
  const getServerTimeOffset = async () => {
    const clientTimeStart = Date.now();
    const monotonicStart = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response;
    try {
      response = await fetch(serverUrl, {
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Time request failed with HTTP ${response.status}`);
    }

    //
    // expect json response in this format, in UTC, from local server in _time-server
    //
    // { milliseconds: 1759640048519, datetime: "2025-10-05T04:54:08.519Z" }
    //

    const json = await response.json();

    // performance.now() is monotonic, so a system-clock adjustment during the
    // request cannot produce a negative or otherwise corrupt round-trip time.
    const roundTripTime = performance.now() - monotonicStart;

    // Parse the server's datetime string into a Date object
    const serverTime = new Date(json.datetime);
    const serverUtc = serverTime.getTime();

    if (!Number.isFinite(serverUtc)) {
      throw new Error("Time response did not include a valid datetime");
    }

    const timeOffset = serverUtc - (clientTimeStart + roundTripTime / 2);
    return { offset: timeOffset, roundTripTime };
  };

  // Take several samples, discard the slowest requests, and use the median of
  // the fastest three. This reduces bias from transient network queueing.
  const getServerTimeOffsetEstimate = async () => {
    const samples = [];
    const numberOfRequests = 5;
    const delayPerRequest = 100;

    for (let i = 0; i < numberOfRequests; i++) {
      try {
        const sample = await getServerTimeOffset();
        if (
          Number.isFinite(sample.offset) &&
          Number.isFinite(sample.roundTripTime)
        ) {
          samples.push(sample);
        }
      } catch (error) {
        console.warn("Time sync sample failed:", error);
      }

      // Briefly separate requests so one short network stall affects fewer samples.
      if (i < numberOfRequests - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayPerRequest));
      }
    }

    if (samples.length < 3) {
      throw new Error("Could not collect enough valid time samples");
    }

    const fastestSamples = samples
      .sort((a, b) => a.roundTripTime - b.roundTripTime)
      .slice(0, 3);
    const offsets = fastestSamples
      .map((sample) => sample.offset)
      .sort((a, b) => a - b);

    return {
      offset: offsets[Math.floor(offsets.length / 2)],
      range: offsets[offsets.length - 1] - offsets[0],
    };
  };

  // format the time as a string
  const formatTime = (time) => {
    const hours = time.getHours().toString().padStart(2, "0");
    const minutes = time.getMinutes().toString().padStart(2, "0");
    const seconds = time.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const getDaySuffix = (day) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  // format the date
  const formatDate = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // format e.g Monday 1st January 2021
    return `${date.toLocaleDateString("en-GB", {
      weekday: "long",
    })}, ${day} ${date.toLocaleDateString("en-GB", {
      month: "long",
    })} ${year}`;
  };

  // function to return a string saying how behind or ahead the clock, use descriptive text for the time offset
  // e.g "slightly behind"
  // under 0.100 seconds, "exact"
  // 0.1 to 0.5 seconds, "slightly ahead/behind"
  // over 0.5 seconds, "ahead/behind"
  const getTimeOffsetDescription = (offset) => {
    const error = Math.abs(offset) / 1000;
    if (error <= 0.1) return "exact";

    const pre = () => {
      if (error > 0.1 && error < 0.5) return "slightly";
      if (error >= 0.5) return "";
    };

    return `${pre()}${offset <= 0 ? " ahead" : " behind"}`;
  };

  const resizeFont = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const newFontSize = Math.min(width * 0.2, height * 0.5);

    // set font size of clock
    document.getElementById("clock").style.fontSize = `${newFontSize}px`;

    // set font size of date to be 15% of clock font size
    document.getElementById("date").style.fontSize = `${newFontSize * 0.15}px`;
  };

  const analogClockEl = document.getElementById("analog-clock");

  const syncAnalogClockToOffset = (offsetMs) => {
    if (!analogClockEl || typeof analogClockEl.setEpochMs !== "function")
      return;
    const correctedEpoch = Date.now() + offsetMs;
    analogClockEl.setEpochMs(correctedEpoch);
    if (typeof analogClockEl.resume === "function") {
      analogClockEl.resume();
    }
  };

  const setStatsText = (message) => {
    const stats = document.getElementById("stats");
    const p = document.createElement("p");
    p.textContent = message;
    stats.replaceChildren(p);
  };

  // update clock in DOM
  const updateClock = (time, opts) => {
    const { highlight, dim } = opts;

    // update the time in the DOM
    const clock = document.getElementById("clock");
    clock.textContent = formatTime(time);

    // update the date in the DOM
    const date = document.getElementById("date");
    date.textContent = formatDate(time);

    // highlight the text if the seconds are a multiple of 5
    if (highlight) {
      clock.classList.add("highlight");
    } else {
      clock.classList.remove("highlight");
    }

    // dim clock and date text when not synchronized
    if (dim) {
      clock.classList.add("dim");
      date.classList.add("dim");
    } else {
      clock.classList.remove("dim");
      date.classList.remove("dim");
    }
  };

  // update the progress bar
  const updateBar = (time) => {
    const seconds = time.getSeconds();
    const milliseconds = time.getMilliseconds();
    const totalSeconds = seconds + milliseconds / 1000;
    const phase = Math.floor(totalSeconds / 5) % 2;
    const progressInPhase = totalSeconds % 5;
    const widthPercent = (progressInPhase / 5) * 100;

    const bar = document.getElementById("progress-bar");
    const fill = document.getElementById("progress-fill");

    if (phase === 0) {
      bar.style.backgroundColor = "white";
      fill.style.backgroundColor = "black";
    } else {
      bar.style.backgroundColor = "black";
      fill.style.backgroundColor = "white";
    }

    fill.style.width = widthPercent + "%";
  };

  const main = async () => {
    try {
      let currentTime = new Date();
      let synchronizedTime = currentTime;
      let remainingMilliseconds = 0;
      let serverTimeOffset = 0;
      let serverTimeOffsetRange = 0;
      let syncPromise = null;

      // set font size on page load
      resizeFont();

      // set font size on resizing of window
      window.addEventListener("resize", resizeFont);

      // Start analog clock with local time immediately
      syncAnalogClockToOffset(0);

      // initial update of clock with local time, not dimmed
      updateClock(synchronizedTime, { highlight: false, dim: false });
      setStatsText("Fetching accurate time...");

      // update the clock every second with local time initially
      const clockInterval = setInterval(() => {
        const now = new Date();
        currentTime = now;

        // Calculate the synchronized time by adding the time offset to the current time
        // the +1000ms is because this fn is always run 1s behind
        // IMPORTANT: this is the time displayed on the clock
        synchronizedTime = new Date(
          currentTime.getTime() + serverTimeOffset + 1000
        );
        const displayTime = synchronizedTime;

        // Calculate the milliseconds remaining until the next second boundary
        remainingMilliseconds = 1000 - synchronizedTime.getMilliseconds();

        // calculate whether the second portion of synchronizedTime is a multiple of 5
        // used to change font color, to help set watches
        let highlight = displayTime.getSeconds() % 5 === 0;

        // update the DOM every second, but delay until the next second boundary
        setTimeout(() => {
          updateClock(displayTime, { highlight, dim: false });
        }, remainingMilliseconds);
      }, 1000);

      // update the progress bar using requestAnimationFrame for very smooth animation
      const updateBarLoop = () => {
        const now = Date.now();
        const syncedNow = new Date(now + serverTimeOffset);
        updateBar(syncedNow);
        requestAnimationFrame(updateBarLoop);
      };
      updateBarLoop();

      const synchronizeWithServer = () => {
        // Reuse an in-flight synchronization so interval and visibility events
        // cannot start overlapping groups of network requests.
        if (syncPromise) return syncPromise;

        syncPromise = getServerTimeOffsetEstimate()
          .then(({ offset, range }) => {
            serverTimeOffset = offset;
            serverTimeOffsetRange = range;
            syncAnalogClockToOffset(serverTimeOffset);
          })
          .finally(() => {
            syncPromise = null;
          });

        return syncPromise;
      };

      // Retry periodically so oscillator drift, sleep/resume, and manual system
      // clock adjustments do not permanently invalidate the initial offset.
      setInterval(() => {
        synchronizeWithServer().catch((error) => {
          console.warn("Background time synchronization failed:", error);
        });
      }, 5 * 60 * 1000);

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          synchronizeWithServer().catch((error) => {
            console.warn("Resume time synchronization failed:", error);
          });
        }
      });

      await synchronizeWithServer();

      // update these stats on page, delay by 1.5s to allow the clock to update first
      // +ve serverTimeOffset means local clock is running behind server clock
      setTimeout(() => {
        const stats = document.getElementById("stats");
        const p = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = getTimeOffsetDescription(serverTimeOffset);
        p.append(
          "Your clock is ",
          strong,
          `. The difference from our server time is ${
            serverTimeOffset > 0 ? "-" : "+"
          }${(Math.abs(serverTimeOffset) / 1000).toFixed(3)} seconds (+/-${(
            serverTimeOffsetRange / 2000
          ).toFixed(3)} seconds)`
        );
        stats.replaceChildren(p);
      }, 1500);
    } catch (error) {
      console.error(error);

      // display error to user
      const message = error instanceof Error ? error.message : String(error);
      setStatsText(`Could not sync with server time: ${message}`);
      if (analogClockEl) {
        if (typeof analogClockEl.syncToSystemTime === "function") {
          analogClockEl.syncToSystemTime();
        } else if (typeof analogClockEl.resume === "function") {
          analogClockEl.resume();
        }
      }
    }
  }; // main

  main();
})();
