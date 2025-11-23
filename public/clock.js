(() => {
  const serverUrl = "/api/time";

  // calculate the offset of API server time compared with local time, in milliseconds
  // compensates for network latency, assume equal round trip time in each direction
  // +ve offset means local clock is running behind server clock
  const getServerTimeOffset = async () => {
    const clientTimeStart = Date.now();
    const response = await fetch(serverUrl, {
      cache: "no-store",
    });

    //
    // expect json response in this format, in UTC, from local server in _time-server
    //
    // { milliseconds: 1759640048519, datetime: "2025-10-05T04:54:08.519Z" }
    //

    const json = await response.json();

    const clientTimeEnd = Date.now();
    const roundTripTime = clientTimeEnd - clientTimeStart;

    // Parse the server's datetime string into a Date object
    const serverTime = new Date(json.datetime);
    const serverUtc = serverTime.getTime();

    const timeOffset = serverUtc - (clientTimeStart + roundTripTime / 2);
    return timeOffset;
  };

  // calculate the time offset of server, 5 times, then get an average
  const getServerTimeOffsetAverage = async () => {
    const serverTimeOffsets = [];
    const numberOfRequests = 5;
    const delayPerRequest = 100;

    for (let i = 0; i < numberOfRequests; i++) {
      const offset = await getServerTimeOffset();
      serverTimeOffsets.push(offset);

      // delay for (100ms) before the next request
      await new Promise((resolve) => setTimeout(resolve, delayPerRequest));
    }

    // console.log('raw time offsets', serverTimeOffsets);

    // optional: remove lowest and highest values
    // serverTimeOffsets.sort((a, b) => a - b);
    // serverTimeOffsets.pop();
    // serverTimeOffsets.shift();

    // calculate the range from min to max of serverTimeOffsets
    const range =
      Math.max(...serverTimeOffsets) - Math.min(...serverTimeOffsets);

    // calculate average time offset from remaining values
    const average =
      serverTimeOffsets.reduce((a, b) => a + b, 0) / serverTimeOffsets.length;

    return { average, range };
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
      if (error > 0.5) return "";
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

  // update clock in DOM
  const updateClock = (time, opts) => {
    const { highlight, dim } = opts;

    // update the time in the DOM
    const clock = document.getElementById("clock");
    clock.innerHTML = formatTime(time);

    // update the date in the DOM
    const date = document.getElementById("date");
    date.innerHTML = formatDate(time);

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

      // set font size on page load
      resizeFont();

      // set font size on resizing of window
      window.addEventListener("resize", resizeFont);

      // initial update of clcok is not synchronized
      updateClock(synchronizedTime, { highlight: false, dim: true });
      document.getElementById("stats").innerHTML = "<p>Synchronizing...</p>";

      // calculate how far out local clock is by fetching real time from a server
      // this will make 5 requests and return the average and min/max range
      const { average: offset, range } = await getServerTimeOffsetAverage();

      serverTimeOffset = offset;
      serverTimeOffsetRange = range;

      // update these stats on page, delay by 1.5s to allow the clock to update first
      // +ve serverTimeOffset means local clock is running behind server clock
      setTimeout(() => {
        const statsHTML = `<p>Your clock is <strong>${getTimeOffsetDescription(
          serverTimeOffset
        )}</strong>. The difference from our server time is ${
          serverTimeOffset > 0 ? "-" : "+"
        }${(Math.abs(serverTimeOffset) / 1000).toFixed(3)} seconds (±${(
          serverTimeOffsetRange / 2000
        ).toFixed(3)} seconds)</p>`;
        document.getElementById("stats").innerHTML = statsHTML;
      }, 1500);

      // update the clock every second
      setInterval(() => {
        const now = new Date();
        currentTime = now;

        // Calculate the synchronized time by adding the time offset to the current time
        // the +1000ms is because this fn is always run 1s behind
        // IMPORTANT: this is the time displayed on the clock
        synchronizedTime = new Date(
          currentTime.getTime() + serverTimeOffset + 1000
        );

        // Calculate the milliseconds remaining until the next second boundary
        remainingMilliseconds = 1000 - synchronizedTime.getMilliseconds();

        // calculate whether the second portion of synchronizedTime is a multiple of 5
        // used to change font color, to help set watches
        let highlight = synchronizedTime.getSeconds() % 5 === 0;

        // update the DOM every second, but delay until the next second boundary
        setTimeout(() => {
          updateClock(synchronizedTime, { highlight, dim: false });
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
    } catch (error) {
      console.error(error);

      // display error to user
      document.getElementById("stats").innerHTML = `<p>Error: ${error}</p>`;
    }
  }; // main

  main();
})();
