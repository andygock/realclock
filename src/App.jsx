import React, { useState, useEffect, useRef } from "react";

async function calculateTimeOffset(serverUrl) {
  try {
    const clientTimeStart = Date.now();
    const response = await fetch(serverUrl, { cache: "no-store" });
    const json = await response.json();
    const serverTime = new Date(json.datetime);
    const clientTimeEnd = Date.now();
    const roundTripTime = clientTimeEnd - clientTimeStart;
    const timeOffset =
      serverTime.getTime() - (clientTimeStart + roundTripTime / 2);
    // console.log({ roundTripTime, timeOffset });
    return timeOffset;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// func to calculate the time offset from the server, 5 times, then get an average
async function calculateTimeOffsetAverage(serverUrl) {
  const timeOffsets = [];
  const numberOfRequests = 5;
  const delayPerRequest = 100;

  for (let i = 0; i < numberOfRequests; i++) {
    const offset = await calculateTimeOffset(serverUrl);
    timeOffsets.push(offset);

    // delay for (100ms) before the next request
    await new Promise((resolve) => setTimeout(resolve, delayPerRequest));
  }

  console.log("raw time offsets", timeOffsets);

  // remove lowest and highest values
  timeOffsets.sort((a, b) => a - b);
  timeOffsets.pop();
  timeOffsets.shift();

  // calculate average time offset from remaining values
  const averageTimeOffset =
    timeOffsets.reduce((a, b) => a + b, 0) / timeOffsets.length;

  return averageTimeOffset;
}

// Format the time as a string
const formatTime = (time) => {
  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

function App() {
  // Define the server URL and the initial state variables for the current time, the time offset, and the ticking interval
  const serverUrl = "https://worldtimeapi.org/api/ip";
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeOffset, setTimeOffset] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  // use a ref to track our initial fetch
  const fetchedRef = useRef(false);

  // Calculate the synchronized time by adding the time offset to the current time
  const synchronizedTime = new Date(currentTime.getTime() + timeOffset);

  // Update the current time every second
  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date());
    };
    setIntervalId(setInterval(tick, 1000));
    return () => clearInterval(intervalId);
  }, []);

  // On page load, get the time offset from the server and update the state
  useEffect(() => {
    // don't fetch on page load if we have already fetched, this hook can run twice on page load in dev mode
    if (fetchedRef.current === true) return;

    const calculateOffset = async () => {
      fetchedRef.current = true;
      try {
        const offset = await calculateTimeOffsetAverage(serverUrl);

        setTimeOffset(offset);
      } catch (error) {
        console.error(error);
      }
    };

    calculateOffset();
  }, []);

  // Update the seconds/tick at the exact correct time
  useEffect(() => {
    const updateTick = () => {
      setCurrentTime(new Date());
    };
    setTimeout(() => {
      updateTick();
      setIntervalId(setInterval(updateTick, 1000));
    }, remainingMilliseconds);
    return () => clearInterval(intervalId);
  }, [synchronizedTime]);

  // Calculate the milliseconds remaining until the next second boundary
  const remainingMilliseconds = 1000 - synchronizedTime.getMilliseconds();

  return (
    <div>
      <h1 className="large">{formatTime(synchronizedTime)}</h1>
      <p className="footer">
        Your system time {timeOffset > 0 ? "+" : ""}
        {Math.round(timeOffset)} milliseconds different from{" "}
        <a href="https://worldtimeapi.org/">WorldTimeAPI</a>.
      </p>
    </div>
  );
}

export default App;
