(() => {
  // calculate the offset of API server time compared with local time, in milliseconds
  // compensates for network latency, assume equal round trip time in each direction
  // +ve offset means local clock is running behind server clock
  const getServerTimeOffset = async (serverUrl) => {
    try {
      const clientTimeStart = Date.now();
      const response = await fetch(serverUrl, { cache: "no-store" });
      const json = await response.json();
      const serverTime = new Date(json.datetime);
      const clientTimeEnd = Date.now();
      const roundTripTime = clientTimeEnd - clientTimeStart;
      const timeOffset =
        serverTime.getTime() - (clientTimeStart + roundTripTime / 2);
      return timeOffset;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  // calculate the time offset of server, 5 times, then get an average
  const getServerTimeOffsetAverage = async (serverUrl) => {
    const serverTimeOffsets = [];
    const numberOfRequests = 5;
    const delayPerRequest = 100;

    for (let i = 0; i < numberOfRequests; i++) {
      const offset = await getServerTimeOffset(serverUrl);
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
    document.getElementById("clock").style.fontSize = `${newFontSize}px`;
  };

  // update clock in DOM
  const updateClock = (time, opts) => {
    const { highlight, dim } = opts;
    const clock = document.getElementById("clock");
    clock.innerHTML = formatTime(time);

    // highlight the text if the seconds are a multiple of 5
    if (highlight) {
      clock.classList.add("highlight");
    } else {
      clock.classList.remove("highlight");
    }

    // dim clock text when not synchronized
    if (dim) {
      clock.classList.add("dim");
    } else {
      clock.classList.remove("dim");
    }
  };

  const main = async () => {
    const serverUrl = "https://worldtimeapi.org/api/ip";

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
    const clock = document.getElementById("clock");
    updateClock(synchronizedTime, { highlight: false, dim: true });
    document.getElementById("stats").innerHTML = "<p>Synchronizing...</p>";

    // calculate how far out local clock is by fetching real time from a server
    // this will make 5 requests and return the average and min/max range
    const { average: offset, range } = await getServerTimeOffsetAverage(
      serverUrl
    );

    serverTimeOffset = offset;
    serverTimeOffsetRange = range;

    // update these stats on page
    const statsHTML = `<p>Your clock is ${getTimeOffsetDescription(
      serverTimeOffset
    )}. The difference from <a href="https://worldtimeapi.org/">WorldTimeAPI</a> is ${
      serverTimeOffset > 0 ? "-" : "+"
    }${(serverTimeOffset / 1000).toFixed(3)} seconds (±${(
      serverTimeOffsetRange / 2000
    ).toFixed(3)} seconds)</p>`;
    document.getElementById("stats").innerHTML = statsHTML;

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
  }; // main

  main();
})();
