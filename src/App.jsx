import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// calculate the offset of API server time compared with local time, in milliseconds
// compensates for network latency, assume equal round trip time in each direction
// +ve offset means local clock is running behind server clock
async function calculateServerTimeOffset(serverUrl) {
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
}

// calculate the time offset of server, 5 times, then get an average
async function calculateServerTimeOffsetStats(serverUrl) {
  const serverTimeOffsets = [];
  const numberOfRequests = 5;
  const delayPerRequest = 100;

  for (let i = 0; i < numberOfRequests; i++) {
    const offset = await calculateServerTimeOffset(serverUrl);
    serverTimeOffsets.push(offset);

    // delay for (100ms) before the next request
    await new Promise((resolve) => setTimeout(resolve, delayPerRequest));
  }

  // console.log("raw time offsets", serverTimeOffsets);

  // optional: remove lowest and highest values
  // serverTimeOffsets.sort((a, b) => a - b);
  // serverTimeOffsets.pop();
  // serverTimeOffsets.shift();

  // calculate the range from min to max of serverTimeOffsets
  const range = Math.max(...serverTimeOffsets) - Math.min(...serverTimeOffsets);

  // calculate average time offset from remaining values
  const average =
    serverTimeOffsets.reduce((a, b) => a + b, 0) / serverTimeOffsets.length;

  return { average, range };
}

// format the time as a string
const formatTime = (time) => {
  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

// not used
function getNextSecondBoundary(date) {
  const nextSecondBoundary = new Date(date.getTime() + 1000);
  nextSecondBoundary.setMilliseconds(0);
  return nextSecondBoundary;
}

// not used
// take a Date object, and return the second and milliseconds as a float
function getSecondsAndMilliseconds(date) {
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();
  return seconds + milliseconds / 1000;
}

function App() {
  const serverUrl = "https://worldtimeapi.org/api/ip";

  // set to now(), synchoronized time is calculated by adding the time offset to this
  const [currentTime, setCurrentTime] = useState(new Date());

  // server time offset in milliseconds, +ve means local clock is running behind server clock, thus we need to delay display update
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  // the range of min to max server time offsets, in milliseconds
  const [serverTimeOffsetRange, setServerTimeOffsetRange] = useState(0);

  // use a ref to track our initial fetch
  const fetchedRef = useRef(false);

  // Calculate the synchronized time by adding the time offset to the current time
  // IMPORTANT: this is the time displayed on the clock
  const synchronizedTime = new Date(currentTime.getTime() + serverTimeOffset);

  // Calculate the milliseconds remaining until the next second boundary
  const remainingMilliseconds = 1000 - synchronizedTime.getMilliseconds();

  // set the clock display, with a delay to compensate for the time offset
  setTimeout(() => {
    const now = new Date();
    setCurrentTime(now);
  }, remainingMilliseconds);

  // On page load, get the time offset from the server and update the state
  useEffect(() => {
    // don't fetch on page load if we have already fetched, this hook can run twice on page load in dev mode
    if (fetchedRef.current === true) return;

    const calculateOffset = async () => {
      fetchedRef.current = true;
      try {
        const { average: offset, range } = await calculateServerTimeOffsetStats(
          serverUrl
        );

        setServerTimeOffset(offset);
        setServerTimeOffsetRange(range);
      } catch (error) {
        console.error(error);
      }
    };

    calculateOffset();
  }, []);

  // set the font size based on the window size
  const [fontSize, setFontSize] = useState(30);
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const newFontSize = Math.min(width * 0.2, height * 0.5);
      setFontSize(newFontSize);
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div>
      <h1 className="large" style={{ fontSize: `${fontSize}px` }}>
        {formatTime(synchronizedTime)}
      </h1>
      {fetchedRef.current === true ? (
        <p className="stats">
          Your clock is {serverTimeOffset > 0 ? "behind" : "ahead"}. The
          difference from <a href="https://worldtimeapi.org/">WorldTimeAPI</a>{" "}
          is {serverTimeOffset > 0 ? "-" : "+"}
          {Math.round(serverTimeOffset) / 1000} seconds (±{" "}
          {Math.round(serverTimeOffsetRange / 2) / 1000} seconds).
        </p>
      ) : (
        <p>Clock is not synchronized. Please wait...</p>
      )}
      <footer>
        <a href="https://github.com/andygock/realclock">GitHub</a>
      </footer>
    </div>
  );
}

export default App;
