//
// analog-clock.js
//
// MIT License © 2025 Andy Gock
//

(() => {
  "use strict";

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const toBool = (value, fallback = false) => {
    if (value === null || value === undefined) return fallback;
    const s = String(value).trim().toLowerCase();
    if (s === "" || s === "true" || s === "1" || s === "yes" || s === "on")
      return true;
    if (s === "false" || s === "0" || s === "no" || s === "off") return false;
    return fallback;
  };

  const hasAttr = (el, name) =>
    el.hasAttribute(name) && String(el.getAttribute(name)).trim() !== "";

  const posMod = (a, n) => ((a % n) + n) % n;

  class AnalogClock extends HTMLElement {
    static get observedAttributes() {
      return [
        "size",
        "face-color",
        "rim-color",
        "marker-color",
        "minute-marker-color",
        "hour-hand-color",
        "minute-hand-color",
        "second-hand-color",
        "centre-cap-color",
        "hour-hand-width",
        "minute-hand-width",
        "second-hand-width",
        "rim-width",
        "marker-width",
        "marker-length",
        "minute-marker-width",
        "minute-marker-length",
        "hour-hand-length",
        "minute-hand-length",
        "second-hand-length",
        "centre-cap-radius",
        "tick-offset-ms",
        "timezone-offset-minutes",
        "paused",
      ];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });

      this._pendingRebuild = false;

      // Time model:
      // - "system": epoch = Date.now()
      // - "manual": epoch = manualEpoch + (Date.now() - manualSetSystemNow)
      this._time = {
        mode: "system",
        manualEpochMs: 0,
        manualSetSystemNowMs: 0,
        driftMs: 0,
        tzOffsetMin: -new Date().getTimezoneOffset(),
      };

      this._props = {
        size: 180,
        faceColor: "#0f0f10",
        rimColor: "#2a2a2d",
        markerColor: "#d6d6d6",
        minuteMarkerColor: "",
        hourHandColor: "#ffffff",
        minuteHandColor: "#ffffff",
        secondHandColor: "#ff3b30",
        centreCapColor: "#ffffff",
        tickOffsetMs: 0,
        paused: false,

        computed: {
          rimWidth: 0,
          markerWidth: 0,
          markerLength: 0,
          minuteMarkerWidth: 0,
          minuteMarkerLength: 0,
          hourHandWidth: 0,
          minuteHandWidth: 0,
          secondHandWidth: 0,
          hourHandLength: 0,
          minuteHandLength: 0,
          secondHandLength: 0,
          centreCapRadius: 0,
        },
      };

      this._els = {};
      this._anims = {
        hour: null,
        minute: null,
        second: null,
      };

      this._resyncTimer = 0;
      this._visibilityHandler = () => {
        if (!document.hidden) this._phaseCorrectAll(true);
      };
    }

    connectedCallback() {
      this._readAllAttributes();
      this._render();
      this._startResync();
      document.addEventListener("visibilitychange", this._visibilityHandler, {
        passive: true,
      });
    }

    disconnectedCallback() {
      this._stopResync();
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._cancelAnimations();
    }

    attributeChangedCallback(name) {
      if (name === "size") this._pendingRebuild = true;
      queueMicrotask(() => {
        this._readAllAttributes();
        if (!this.shadowRoot) return;

        if (this._pendingRebuild) {
          this._pendingRebuild = false;
          this._render();
          return;
        }

        // For most attribute changes, re-apply props then re-phase animations
        this._applyStaticProps();
        this._ensureAnimations();
        this._phaseCorrectAll(true);
      });
    }

    // Public API
    syncToSystemTime({ tickOffsetMs } = {}) {
      const offset = Number.isFinite(Number(tickOffsetMs))
        ? Number(tickOffsetMs)
        : this._props.tickOffsetMs;

      this._time.mode = "system";
      this._time.driftMs = 0;
      this._props.tickOffsetMs = clamp(offset, -600000, 600000);

      this._ensureAnimations();
      this._phaseCorrectAll(true);
    }

    setEpochMs(epochMs, { tickOffsetMs } = {}) {
      const ms = Number(epochMs);
      if (!Number.isFinite(ms)) return;

      const offset = Number.isFinite(Number(tickOffsetMs))
        ? Number(tickOffsetMs)
        : this._props.tickOffsetMs;

      this._time.mode = "manual";
      this._time.manualEpochMs = ms;
      this._time.manualSetSystemNowMs = Date.now();
      this._time.driftMs = 0;
      this._props.tickOffsetMs = clamp(offset, -600000, 600000);

      this._ensureAnimations();
      this._phaseCorrectAll(true);
    }

    adjustByMs(deltaMs) {
      const d = Number(deltaMs);
      if (!Number.isFinite(d)) return;
      this._time.driftMs += d;
      this._phaseCorrectAll(true);
    }

    setTimezoneOffsetMinutes(minutes) {
      const m = Number(minutes);
      if (!Number.isFinite(m)) return;
      this._time.tzOffsetMin = clamp(m, -14 * 60, 14 * 60);
      this._phaseCorrectAll(true);
    }

    pause() {
      this._props.paused = true;
      this._applyPlaybackState();
    }

    resume() {
      this._props.paused = false;
      this._applyPlaybackState();
      this._phaseCorrectAll(true);
    }

    _readAllAttributes() {
      const a = (name) => this.getAttribute(name);

      this._props.size = clamp(toNumber(a("size"), this._props.size), 60, 2000);

      this._props.faceColor = a("face-color") ?? this._props.faceColor;
      this._props.rimColor = a("rim-color") ?? this._props.rimColor;
      this._props.markerColor = a("marker-color") ?? this._props.markerColor;
      this._props.minuteMarkerColor =
        a("minute-marker-color") ?? this._props.minuteMarkerColor;

      this._props.hourHandColor =
        a("hour-hand-color") ?? this._props.hourHandColor;
      this._props.minuteHandColor =
        a("minute-hand-color") ?? this._props.minuteHandColor;
      this._props.secondHandColor =
        a("second-hand-color") ?? this._props.secondHandColor;
      this._props.centreCapColor =
        a("centre-cap-color") ?? this._props.centreCapColor;

      if (hasAttr(this, "timezone-offset-minutes")) {
        const tz = toNumber(
          a("timezone-offset-minutes"),
          this._time.tzOffsetMin
        );
        if (Number.isFinite(tz))
          this._time.tzOffsetMin = clamp(tz, -14 * 60, 14 * 60);
      }

      this._props.tickOffsetMs = clamp(
        toNumber(a("tick-offset-ms"), this._props.tickOffsetMs),
        -600000,
        600000
      );

      this._props.paused = toBool(a("paused"), this._props.paused);
    }

    _computeDefaults() {
      const size = this._props.size;

      const rimWidth = clamp(size * 0.03, 3, 24);

      const markerWidth = clamp(size * 0.012, 2, 10);
      const markerLength = clamp(size * 0.065, 7, 38);

      const minuteMarkerWidth = clamp(size * 0.0065, 1, 6);
      const minuteMarkerLength = clamp(size * 0.035, 4, 22);

      const hourHandWidth = clamp(size * 0.03, 3, 18);
      const minuteHandWidth = clamp(size * 0.02, 2.5, 14);
      const secondHandWidth = clamp(size * 0.01, 1.5, 8);

      const hourHandLength = 0.52;
      const minuteHandLength = 0.74;
      const secondHandLength = 0.84;

      const centreCapRadius = clamp(size * 0.03, 3, 18);

      this._props.computed = {
        rimWidth,
        markerWidth,
        markerLength,
        minuteMarkerWidth,
        minuteMarkerLength,
        hourHandWidth,
        minuteHandWidth,
        secondHandWidth,
        hourHandLength,
        minuteHandLength,
        secondHandLength,
        centreCapRadius,
      };
    }

    _effective(attrName, computedKey) {
      if (hasAttr(this, attrName)) {
        const v = toNumber(this.getAttribute(attrName), NaN);
        if (Number.isFinite(v)) return v;
      }
      return this._props.computed[computedKey];
    }

    _effectiveLenFrac(attrName, computedKey) {
      if (hasAttr(this, attrName)) {
        const v = toNumber(this.getAttribute(attrName), NaN);
        if (Number.isFinite(v)) return clamp(v, 0.05, 0.98);
      }
      return this._props.computed[computedKey];
    }

    _render() {
      this._computeDefaults();

      const size = this._props.size;
      const half = size / 2;

      const style = document.createElement("style");
      style.textContent = `
              :host { display: inline-block; line-height: 0; }
              svg { width: ${size}px; height: ${size}px; display: block; }
              .hand, .marker { vector-effect: non-scaling-stroke; stroke-linecap: round; }
            `;

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Analogue clock");

      const rimWidth = this._effective("rim-width", "rimWidth");
      const faceR = Math.max(0, half - rimWidth / 2);

      const face = document.createElementNS(svgNS, "circle");
      face.setAttribute("cx", String(half));
      face.setAttribute("cy", String(half));
      face.setAttribute("r", String(faceR));
      svg.appendChild(face);

      const rim = document.createElementNS(svgNS, "circle");
      rim.setAttribute("cx", String(half));
      rim.setAttribute("cy", String(half));
      rim.setAttribute("r", String(faceR));
      rim.setAttribute("fill", "none");
      svg.appendChild(rim);

      const markersGroup = document.createElementNS(svgNS, "g");
      svg.appendChild(markersGroup);

      // Centre group for hands
      const handsGroup = document.createElementNS(svgNS, "g");
      handsGroup.setAttribute("transform", `translate(${half} ${half})`);
      svg.appendChild(handsGroup);

      // Wrap each hand in its own group so WAAPI animates the group rotation about (0,0)
      const hourWrap = document.createElementNS(svgNS, "g");
      const minuteWrap = document.createElementNS(svgNS, "g");
      const secondWrap = document.createElementNS(svgNS, "g");
      handsGroup.appendChild(hourWrap);
      handsGroup.appendChild(minuteWrap);
      handsGroup.appendChild(secondWrap);

      const hourHand = document.createElementNS(svgNS, "line");
      hourHand.classList.add("hand");
      hourHand.setAttribute("x1", "0");
      hourHand.setAttribute("y1", "0");
      hourWrap.appendChild(hourHand);

      const minuteHand = document.createElementNS(svgNS, "line");
      minuteHand.classList.add("hand");
      minuteHand.setAttribute("x1", "0");
      minuteHand.setAttribute("y1", "0");
      minuteWrap.appendChild(minuteHand);

      const secondHand = document.createElementNS(svgNS, "line");
      secondHand.classList.add("hand");
      secondHand.setAttribute("x1", "0");
      secondHand.setAttribute("y1", "0");
      secondWrap.appendChild(secondHand);

      const centreCap = document.createElementNS(svgNS, "circle");
      centreCap.setAttribute("cx", String(half));
      centreCap.setAttribute("cy", String(half));
      svg.appendChild(centreCap);

      this.shadowRoot.replaceChildren(style, svg);

      this._els = {
        svg,
        face,
        rim,
        markersGroup,
        handsGroup,
        hourWrap,
        minuteWrap,
        secondWrap,
        hourHand,
        minuteHand,
        secondHand,
        centreCap,
      };

      this._buildMarkers();
      this._applyStaticProps();

      this._cancelAnimations();
      this._ensureAnimations();
      this._phaseCorrectAll(true);
    }

    _buildMarkers() {
      const g = this._els.markersGroup;
      if (!g) return;
      g.replaceChildren();

      const svgNS = "http://www.w3.org/2000/svg";
      const size = this._props.size;
      const half = size / 2;

      const rimWidth = this._effective("rim-width", "rimWidth");

      const bigLen = this._effective("marker-length", "markerLength");
      const bigW = this._effective("marker-width", "markerWidth");

      const smallLen = this._effective(
        "minute-marker-length",
        "minuteMarkerLength"
      );
      const smallW = this._effective(
        "minute-marker-width",
        "minuteMarkerWidth"
      );

      const rimInset = rimWidth / 2;
      const outerR = half - rimInset - 2;

      const bigInnerR = Math.max(0, outerR - bigLen);
      const smallInnerR = Math.max(0, outerR - smallLen);

      for (let i = 0; i < 60; i++) {
        const isFive = i % 5 === 0;
        const angle = (i * 6 - 90) * (Math.PI / 180);
        const innerR = isFive ? bigInnerR : smallInnerR;

        const x1 = half + Math.cos(angle) * innerR;
        const y1 = half + Math.sin(angle) * innerR;
        const x2 = half + Math.cos(angle) * outerR;
        const y2 = half + Math.sin(angle) * outerR;

        const line = document.createElementNS(svgNS, "line");
        line.classList.add("marker");
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2));
        line.setAttribute("y2", String(y2));
        line.setAttribute("data-kind", isFive ? "five" : "minute");
        line.setAttribute("stroke-width", String(isFive ? bigW : smallW));
        g.appendChild(line);
      }
    }

    _applyStaticProps() {
      const {
        svg,
        face,
        rim,
        hourHand,
        minuteHand,
        secondHand,
        centreCap,
        markersGroup,
      } = this._els;
      if (!svg) return;

      this._computeDefaults();

      const size = this._props.size;
      const half = size / 2;

      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

      const rimWidth = clamp(this._effective("rim-width", "rimWidth"), 0, 200);
      const faceR = Math.max(0, half - rimWidth / 2);

      face.setAttribute("cx", String(half));
      face.setAttribute("cy", String(half));
      face.setAttribute("r", String(faceR));
      face.setAttribute("fill", this._props.faceColor);

      rim.setAttribute("cx", String(half));
      rim.setAttribute("cy", String(half));
      rim.setAttribute("r", String(faceR));
      rim.setAttribute("stroke", this._props.rimColor);
      rim.setAttribute("stroke-width", String(rimWidth));
      rim.setAttribute("fill", "none");

      this._buildMarkers();

      const bigW = clamp(
        this._effective("marker-width", "markerWidth"),
        0.5,
        50
      );
      const smallW = clamp(
        this._effective("minute-marker-width", "minuteMarkerWidth"),
        0.5,
        50
      );

      const minuteMarkerColourExplicit = hasAttr(this, "minute-marker-color");
      const minuteMarkerColour = minuteMarkerColourExplicit
        ? this.getAttribute("minute-marker-color")
        : this._props.markerColor;

      const markers = markersGroup?.querySelectorAll("line.marker") ?? [];
      for (const m of markers) {
        const isFive = m.getAttribute("data-kind") === "five";
        m.setAttribute(
          "stroke",
          isFive ? this._props.markerColor : minuteMarkerColour
        );
        m.setAttribute("stroke-width", String(isFive ? bigW : smallW));
        if (!minuteMarkerColourExplicit && !isFive)
          m.setAttribute("stroke-opacity", "0.55");
        else m.removeAttribute("stroke-opacity");
      }

      const centreCapRadius = clamp(
        this._effective("centre-cap-radius", "centreCapRadius"),
        0,
        200
      );
      centreCap.setAttribute("cx", String(half));
      centreCap.setAttribute("cy", String(half));
      centreCap.setAttribute("r", String(centreCapRadius));
      centreCap.setAttribute("fill", this._props.centreCapColor);

      this._applyHand(
        hourHand,
        this._props.hourHandColor,
        clamp(this._effective("hour-hand-width", "hourHandWidth"), 0.5, 100),
        this._effectiveLenFrac("hour-hand-length", "hourHandLength"),
        size
      );
      this._applyHand(
        minuteHand,
        this._props.minuteHandColor,
        clamp(
          this._effective("minute-hand-width", "minuteHandWidth"),
          0.5,
          100
        ),
        this._effectiveLenFrac("minute-hand-length", "minuteHandLength"),
        size
      );
      this._applyHand(
        secondHand,
        this._props.secondHandColor,
        clamp(
          this._effective("second-hand-width", "secondHandWidth"),
          0.5,
          100
        ),
        this._effectiveLenFrac("second-hand-length", "secondHandLength"),
        size
      );
    }

    _applyHand(el, colour, width, lengthFrac, size) {
      const radius = size / 2;
      const len = radius * clamp(lengthFrac, 0.05, 0.98);
      el.setAttribute("stroke", colour);
      el.setAttribute("stroke-width", String(width));
      el.setAttribute("x2", "0");
      el.setAttribute("y2", String(-len));
    }

    _epochMsNow() {
      const sysNow = Date.now();
      const base =
        this._time.mode === "system"
          ? sysNow
          : this._time.manualEpochMs +
            (sysNow - this._time.manualSetSystemNowMs);

      return base + this._time.driftMs + this._props.tickOffsetMs;
    }

    _ensureAnimations() {
      if (!this._els.secondWrap) return;

      // Second hand: continuous 60s rotation with a smooth sweep.
      if (!this._anims.second) {
        this._anims.second = this._els.secondWrap.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 60000, iterations: Infinity, easing: "linear" }
        );
      }
      if (!this._anims.minute) {
        this._anims.minute = this._els.minuteWrap.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 3600000, iterations: Infinity, easing: "linear" }
        );
      }
      if (!this._anims.hour) {
        this._anims.hour = this._els.hourWrap.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 43200000, iterations: Infinity, easing: "linear" }
        );
      }

      this._applyPlaybackState();
    }

    _applyPlaybackState() {
      const state = this._props.paused ? "paused" : "running";
      for (const k of ["hour", "minute", "second"]) {
        const a = this._anims[k];
        if (!a) continue;
        if (state === "paused") a.pause();
        else a.play();
      }
    }

    _cancelAnimations() {
      for (const k of ["hour", "minute", "second"]) {
        const a = this._anims[k];
        if (a) a.cancel();
        this._anims[k] = null;
      }
    }

    _phaseCorrectAll(force) {
      this._ensureAnimations();
      if (!this._anims.second || !this._anims.minute || !this._anims.hour)
        return;

      const t = this._epochMsNow() + this._time.tzOffsetMin * 60000;

      // Phase within each period
      const secPhase = posMod(t, 60000);
      const minPhase = posMod(t, 3600000);
      const hourPhase = posMod(t, 43200000);

      const secPhaseCorrected = secPhase;

      // Set currentTime on animations to phase-correct.
      // This is the core alignment mechanism and respects offset and manual time mode.
      if (force) {
        this._anims.second.currentTime = secPhaseCorrected;
        this._anims.minute.currentTime = minPhase;
        this._anims.hour.currentTime = hourPhase;
        return;
      }

      // Non-force mode: only correct if drift becomes noticeable
      const driftThreshMs = 12; // small but avoids micro-jitter
      if (
        Math.abs(this._anims.second.currentTime - secPhaseCorrected) >
        driftThreshMs
      ) {
        this._anims.second.currentTime = secPhaseCorrected;
      }
      if (Math.abs(this._anims.minute.currentTime - minPhase) > driftThreshMs) {
        this._anims.minute.currentTime = minPhase;
      }
      if (Math.abs(this._anims.hour.currentTime - hourPhase) > driftThreshMs) {
        this._anims.hour.currentTime = hourPhase;
      }
    }

    _startResync() {
      this._stopResync();
      // Phase correct frequently enough to track system time adjustments and any drift.
      // Keep it gentle: frequent checks, but only hard-set when needed.
      this._resyncTimer = window.setInterval(() => {
        if (this._props.paused) return;
        // Keep the animations aligned with the system time.
        this._phaseCorrectAll();
      }, 250);
    }

    _stopResync() {
      if (this._resyncTimer) {
        clearInterval(this._resyncTimer);
        this._resyncTimer = 0;
      }
    }
  }

  if (!customElements.get("analog-clock")) {
    customElements.define("analog-clock", AnalogClock);
  }
})();
