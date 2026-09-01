/*! Dice components; includes cannon-es 0.20.0, distributed under the MIT License. */
import { Body, Box, ContactMaterial, Material, Plane, Quaternion, SAPBroadphase, Vec3, World } from "cannon-es";

(function(global) {
  "use strict";

  const STYLE_ID = "dice-cover-styles";
  const EPSILON = 1e-7;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .dice-cover {
        --bc-figure-max-width: min(52rem, 100%);
        position: relative;
      }

      .dice-cover .dice-cover-stage {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        border-radius: var(--bc-radius-lg, 8px);
      }

      .dice-cover .dice-cover-canvas {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 12 / 5;
        touch-action: manipulation;
      }

      .dice-cover .dice-cover-status {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .dice-cover .dice-cover-seed-debug {
        display: grid;
        gap: 0.45rem;
        margin-top: 0.55rem;
        padding: 0.55rem 0.65rem;
        border: 1px dashed var(--bc-border);
        border-radius: var(--bc-radius-lg, 8px);
        background: color-mix(in srgb, var(--bc-control-bg) 78%, transparent);
      }

      .dice-cover .dice-cover-seed-row,
      .dice-cover .dice-cover-seed-scan {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 0.45rem;
      }

      .dice-cover .dice-cover-seed-debug label {
        display: grid;
        gap: 0.15rem;
        color: var(--bc-muted);
        font-size: 0.75rem;
        font-weight: 700;
      }

      .dice-cover .dice-cover-seed-debug input {
        width: 7.5rem;
      }

      .dice-cover .dice-cover-dev-section {
        border-top: 1px solid var(--bc-border);
        padding-top: 0.4rem;
      }

      .dice-cover .dice-cover-dev-section > summary {
        cursor: pointer;
        color: var(--bc-muted);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .dice-cover .dice-cover-dev-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: 0.4rem 0.7rem;
        margin-top: 0.45rem;
      }

      .dice-cover .dice-cover-dev-grid label {
        grid-template-columns: 1fr auto;
        align-items: center;
      }

      .dice-cover .dice-cover-dev-grid output {
        color: var(--bc-text);
        font-variant-numeric: tabular-nums;
      }

      .dice-cover .dice-cover-dev-grid input[type="range"] {
        grid-column: 1 / -1;
        width: 100%;
      }

      .dice-cover .dice-cover-seed-scan select {
        min-width: 8rem;
      }

      .dice-cover .dice-cover-check-label {
        display: inline-flex !important;
        grid-auto-flow: column;
        align-items: center;
        gap: 0.35rem !important;
        min-height: 2.1rem;
      }

      .dice-cover .dice-cover-check-label input {
        width: auto;
      }

      .dice-cover .dice-cover-seed-result {
        margin-left: auto;
        color: var(--bc-muted);
        font-size: 0.82rem;
        font-variant-numeric: tabular-nums;
      }

      .dice-cover.dice-cover-no-webgl .dice-cover-stage {
        display: grid;
        place-items: center;
        min-height: 10rem;
        border: 1px solid var(--bc-border);
        background: var(--bc-control-bg);
      }

      .dice-cover.dice-cover-no-webgl .dice-cover-canvas {
        display: none;
      }

      .dice-cover.dice-cover-no-webgl .dice-cover-status {
        position: static;
        width: auto;
        height: auto;
        margin: 0;
        clip: auto;
        white-space: normal;
      }

      .dice-roller {
        --bc-figure-max-width: 46rem;
        /* The theoretical overlay is an annotation, not a second series, so
           it borrows the text colour rather than a data colour. Full strength
           in both themes: at a million rolls it has to stay legible lying
           along the top edge of a bar. */
        --dice-expected-color: var(--bc-text);
      }

      .dice-roller .dice-roller-stage {
        position: relative;
        isolation: isolate;
        overflow: hidden;
      }

      .dice-roller .dice-roller-stage::before {
        content: "";
        position: absolute;
        z-index: 0;
        inset: 5%;
        border: 1px solid var(--bc-border);
        border-radius: var(--bc-radius-lg, 8px);
        pointer-events: none;
      }

      .dice-roller .dice-roller-canvas {
        display: block;
        position: relative;
        z-index: 1;
        width: 100%;
        height: auto;
        aspect-ratio: 12 / 5;
      }

      .dice-roller .dice-grab-handle {
        position: absolute;
        z-index: 4;
        width: 3.5rem;
        height: 3.5rem;
        padding: 0;
        transform: translate(-50%, -50%);
        border: 0;
        border-radius: 50%;
        background: transparent;
        box-shadow: none;
        cursor: grab;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }

      .dice-roller .dice-grab-handle:active,
      .dice-roller .dice-grab-handle.is-grabbing {
        cursor: grabbing;
      }

      .dice-roller .dice-grab-handle:focus-visible {
        outline: 2px solid var(--bc-accent, #2c7fb8);
        outline-offset: 2px;
      }

      /* Standalone the controls are a plain visible action row. Inside a
         callout interactiveFigure.wrap() turns this same element into the
         shared drawer, which owns its own spacing. */
      .dice-roller .dice-roller-controls:not(.bc-if-controls) {
        margin-bottom: 0.65rem;
      }

      .dice-roller .dice-wall-debug {
        position: absolute;
        z-index: 3;
        box-sizing: border-box;
        border: 0.7rem solid rgb(210 76 64 / 72%);
        outline: 1px dashed rgb(126 31 24 / 92%);
        outline-offset: -1px;
        pointer-events: none;
      }

      .dice-roller .dice-wall-debug::after {
        content: "collision walls";
        position: absolute;
        top: 0.15rem;
        left: 50%;
        padding: 0.08rem 0.28rem;
        transform: translateX(-50%);
        border-radius: 0.2rem;
        background: rgb(126 31 24 / 86%);
        color: white;
        font: 600 0.65rem/1.25 var(--bs-body-font-family);
        letter-spacing: 0.03em;
        white-space: nowrap;
      }

      .dice-roller .dice-tuning {
        margin: 0 0 0.75rem;
        border: 1px dashed var(--bc-border);
        border-radius: var(--bc-radius-lg, 8px);
        background: color-mix(in srgb, var(--bc-control-bg) 78%, transparent);
      }

      .dice-roller .dice-tuning > summary {
        padding: 0.5rem 0.7rem;
        cursor: pointer;
        color: var(--bc-muted);
        font-size: 0.86rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .dice-roller .dice-tuning-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        gap: 0.55rem 0.9rem;
        padding: 0.2rem 0.7rem 0.7rem;
      }

      .dice-roller .dice-tuning-control {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.18rem 0.5rem;
        align-items: center;
        color: var(--bc-muted);
        font-size: 0.78rem;
      }

      .dice-roller .dice-tuning-control output {
        min-width: 3.2rem;
        color: var(--bc-text);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      .dice-roller .dice-tuning-control input {
        grid-column: 1 / -1;
        width: 100%;
        accent-color: var(--bc-accent, #2c7fb8);
      }

      .dice-roller .dice-tuning-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0 0.7rem 0.7rem;
      }

      .dice-roller .dice-tuning-note {
        color: var(--bc-muted);
        font-size: 0.72rem;
      }

      .dice-roller .dice-roller-readout {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.35rem 1rem;
        margin: 0.25rem 0 0.45rem;
        color: var(--bc-muted);
        font-size: 0.92rem;
        font-variant-numeric: tabular-nums;
      }

      .dice-roller .dice-roller-result {
        color: var(--bc-text);
        font-weight: 700;
      }

      .dice-roller .dice-histogram {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }

      .dice-roller .dice-histogram-bar {
        fill: var(--graph-bar-fill);
        stroke: var(--graph-bar-stroke);
        stroke-width: 0.7;
        vector-effect: non-scaling-stroke;
        transition: y 160ms ease, height 160ms ease, fill 120ms ease;
      }

      .dice-roller .dice-histogram-bar.is-current {
        fill: var(--bc-current-color);
      }

      .dice-roller .dice-histogram-label,
      .dice-roller .dice-histogram-count {
        fill: var(--graph-text-color);
        font-family: var(--bs-body-font-family);
        text-anchor: middle;
      }

      .dice-roller .dice-histogram-label {
        font-size: 13px;
      }

      .dice-roller .dice-histogram-count {
        font-size: 11px;
      }

      .dice-roller .dice-histogram-axis {
        stroke: var(--graph-axis-color);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }

      /* The theoretical distribution: one stepped outline spanning whole
         slots, so it reads as an envelope laid over the bars rather than a
         second series drawn in bar-width. Dashes and a neutral colour keep
         it legible whether it sits far above the bars (few rolls) or exactly
         along their tops (many). */
      .dice-roller .dice-histogram-expected-shape {
        fill: none;
        stroke: var(--dice-expected-color);
        stroke-width: 2;
        stroke-dasharray: 7 4.5;
        stroke-linecap: butt;
        stroke-linejoin: miter;
        vector-effect: non-scaling-stroke;
        transition: d 160ms ease;
      }

      .dice-roller .dice-histogram-expected-shape.is-instant {
        transition: none;
      }

      .dice-roller .dice-histogram-legend {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0.1rem 0 0;
        color: var(--bc-muted);
        font-size: var(--bc-figure-note-size, 0.8125rem);
        line-height: 1.35;
      }

      .dice-roller .dice-histogram-legend[hidden] {
        display: none;
      }

      .dice-roller .dice-histogram-legend-swatch {
        flex: 0 0 auto;
        width: 1.6rem;
        height: 0;
        border-top: 2px dashed var(--dice-expected-color);
      }

      @media (prefers-reduced-motion: reduce) {
        .dice-roller .dice-histogram-bar,
        .dice-roller .dice-histogram-expected-shape {
          transition: none;
        }
      }

      html[data-motion="reduced"] .dice-roller .dice-histogram-bar,
      html[data-motion="reduced"] .dice-roller .dice-histogram-expected-shape {
        transition: none;
      }

      @media (max-width: 560px) {
        .dice-roller .dice-histogram-label {
          font-size: 18px;
        }

        .dice-roller .dice-histogram-count {
          font-size: 14px;
        }

        /* Five- and six-figure counts are set in a scaled viewBox, so on a
           phone they arrive as a crowded grey haze across the bar tops. The
           house rule is to drop crowded furniture rather than shrink it: the
           running total is in the readout, and the shape is the point. */
        .dice-roller .dice-histogram[data-dense-counts="true"] .dice-histogram-count {
          display: none;
        }

        .dice-roller .dice-histogram-expected-shape {
          stroke-width: 2.5;
        }
      }

    `;
    document.head.appendChild(style);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalize3(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }

  function cross3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function planeBoundsForCamera(camera, target, up, fieldOfView, aspect, inset, planeY) {
    const forward = normalize3([
      target[0] - camera[0],
      target[1] - camera[1],
      target[2] - camera[2]
    ]);
    const right = normalize3(cross3(forward, up));
    const trueUp = normalize3(cross3(right, forward));
    const tangentHalfFov = Math.tan(fieldOfView * Math.PI / 360);
    const limit = 1 - clamp(inset, 0, 0.49) * 2;
    const points = [];
    [-limit, limit].forEach((ndcX) => {
      [-limit, limit].forEach((ndcY) => {
        const direction = normalize3([
          forward[0] + right[0] * ndcX * tangentHalfFov * aspect + trueUp[0] * ndcY * tangentHalfFov,
          forward[1] + right[1] * ndcX * tangentHalfFov * aspect + trueUp[1] * ndcY * tangentHalfFov,
          forward[2] + right[2] * ndcX * tangentHalfFov * aspect + trueUp[2] * ndcY * tangentHalfFov
        ]);
        const distance = (planeY - camera[1]) / direction[1];
        points.push([
          camera[0] + direction[0] * distance,
          planeY,
          camera[2] + direction[2] * distance
        ]);
      });
    });
    const xs = points.map((point) => point[0]);
    const zs = points.map((point) => point[2]);
    return {
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...zs) - Math.min(...zs)
    };
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }

  function orthographic(left, right, bottom, top, near, far) {
    const out = new Float32Array(16);
    out[0] = 2 / (right - left);
    out[5] = 2 / (top - bottom);
    out[10] = -2 / (far - near);
    out[12] = -(right + left) / (right - left);
    out[13] = -(top + bottom) / (top - bottom);
    out[14] = -(far + near) / (far - near);
    out[15] = 1;
    return out;
  }

  function transformPoint(matrix, point) {
    return [
      matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
      matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
      matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14]
    ];
  }

  function lookAt(eye, center, up) {
    const z = normalize3([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    const x = normalize3(cross3(up, z));
    const y = cross3(z, x);
    const out = new Float32Array(16);
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0];
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1];
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2];
    out[12] = -dot3(x, eye);
    out[13] = -dot3(y, eye);
    out[14] = -dot3(z, eye);
    out[15] = 1;
    return out;
  }

  function quatFromAxisAngle(axis, angle) {
    const n = normalize3(axis);
    const half = angle / 2;
    const s = Math.sin(half);
    return [n[0] * s, n[1] * s, n[2] * s, Math.cos(half)];
  }

  function quatMultiply(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
  }

  function modelMatrix(position, quaternion, scale) {
    const x = quaternion[0], y = quaternion[1], z = quaternion[2], w = quaternion[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const out = new Float32Array(16);
    out[0] = (1 - (yy + zz)) * scale;
    out[1] = (xy + wz) * scale;
    out[2] = (xz - wy) * scale;
    out[4] = (xy - wz) * scale;
    out[5] = (1 - (xx + zz)) * scale;
    out[6] = (yz + wx) * scale;
    out[8] = (xz + wy) * scale;
    out[9] = (yz - wx) * scale;
    out[10] = (1 - (xx + yy)) * scale;
    out[12] = position[0];
    out[13] = position[1];
    out[14] = position[2];
    out[15] = 1;
    return out;
  }

  function shadowMatrix(position, scaleX, scaleZ) {
    const out = new Float32Array(16);
    out[0] = scaleX;
    out[5] = 1;
    out[10] = scaleZ;
    out[12] = position[0];
    out[13] = 0.025;
    out[14] = position[2];
    out[15] = 1;
    return out;
  }

  function notchWave(value, radius, depth) {
    const scaled = Math.PI * clamp(value / radius, -1, 1);
    return depth * (Math.cos(scaled) + 1);
  }

  function notch(a, b, radius, depth) {
    return notchWave(a, radius, depth) * notchWave(b, radius, depth);
  }

  function roundDieVertex(source) {
    const edgeRadius = 0.075;
    const sub = 0.5 - edgeRadius;
    const p = source.slice();
    const corner = [Math.sign(p[0]) * sub, Math.sign(p[1]) * sub, Math.sign(p[2]) * sub];
    const outside = [Math.abs(p[0]) > sub, Math.abs(p[1]) > sub, Math.abs(p[2]) > sub];
    const count = outside.filter(Boolean).length;

    if (count >= 2) {
      const addition = [p[0] - corner[0], p[1] - corner[1], p[2] - corner[2]];
      if (!outside[0]) addition[0] = 0;
      if (!outside[1]) addition[1] = 0;
      if (!outside[2]) addition[2] = 0;
      const rounded = normalize3(addition);
      for (let i = 0; i < 3; i += 1) {
        if (outside[i]) p[i] = corner[i] + rounded[i] * edgeRadius;
      }
    }
    return p;
  }

  function deformDieVertex(source) {
    const notchRadius = 0.14;
    const notchDepth = 0.105;
    const p = roundDieVertex(source);
    const offset = 0.23;
    const near = (value, target) => Math.abs(value - target) < EPSILON;
    if (near(p[1], 0.5)) {
      p[1] -= notch(p[0], p[2], notchRadius, notchDepth);
    } else if (near(p[0], 0.5)) {
      p[0] -= notch(p[1] + offset, p[2] + offset, notchRadius, notchDepth);
      p[0] -= notch(p[1] - offset, p[2] - offset, notchRadius, notchDepth);
    } else if (near(p[2], 0.5)) {
      p[2] -= notch(p[0] - offset, p[1] + offset, notchRadius, notchDepth);
      p[2] -= notch(p[0], p[1], notchRadius, notchDepth);
      p[2] -= notch(p[0] + offset, p[1] - offset, notchRadius, notchDepth);
    } else if (near(p[2], -0.5)) {
      p[2] += notch(p[0] + offset, p[1] + offset, notchRadius, notchDepth);
      p[2] += notch(p[0] + offset, p[1] - offset, notchRadius, notchDepth);
      p[2] += notch(p[0] - offset, p[1] + offset, notchRadius, notchDepth);
      p[2] += notch(p[0] - offset, p[1] - offset, notchRadius, notchDepth);
    } else if (near(p[0], -0.5)) {
      p[0] += notch(p[1] + offset, p[2] + offset, notchRadius, notchDepth);
      p[0] += notch(p[1] + offset, p[2] - offset, notchRadius, notchDepth);
      p[0] += notch(p[1], p[2], notchRadius, notchDepth);
      p[0] += notch(p[1] - offset, p[2] + offset, notchRadius, notchDepth);
      p[0] += notch(p[1] - offset, p[2] - offset, notchRadius, notchDepth);
    } else if (near(p[1], -0.5)) {
      p[1] += notch(p[0] + offset, p[2] + offset, notchRadius, notchDepth);
      p[1] += notch(p[0] + offset, p[2], notchRadius, notchDepth);
      p[1] += notch(p[0] + offset, p[2] - offset, notchRadius, notchDepth);
      p[1] += notch(p[0] - offset, p[2] + offset, notchRadius, notchDepth);
      p[1] += notch(p[0] - offset, p[2], notchRadius, notchDepth);
      p[1] += notch(p[0] - offset, p[2] - offset, notchRadius, notchDepth);
    }
    return p;
  }

  const FACE_SPECS = [
    { center: [0.5, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { center: [-0.5, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { center: [0, 0.5, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { center: [0, -0.5, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { center: [0, 0, 0.5], u: [1, 0, 0], v: [0, 1, 0] },
    { center: [0, 0, -0.5], u: [-1, 0, 0], v: [0, 1, 0] }
  ];

  function createOuterGeometry(segments) {
    const rawPositions = [];
    const rawIndices = [];
    FACE_SPECS.forEach((face) => {
      const base = rawPositions.length;
      for (let row = 0; row <= segments; row += 1) {
        for (let column = 0; column <= segments; column += 1) {
          const u = column / segments - 0.5;
          const v = row / segments - 0.5;
          rawPositions.push(deformDieVertex([
            face.center[0] + face.u[0] * u + face.v[0] * v,
            face.center[1] + face.u[1] * u + face.v[1] * v,
            face.center[2] + face.u[2] * u + face.v[2] * v
          ]));
        }
      }
      const stride = segments + 1;
      for (let row = 0; row < segments; row += 1) {
        for (let column = 0; column < segments; column += 1) {
          const a = base + row * stride + column;
          const b = a + 1;
          const d = a + stride;
          const c = d + 1;
          rawIndices.push(a, b, d, b, c, d);
        }
      }
    });

    const positions = [];
    const remap = new Uint16Array(rawPositions.length);
    const byPosition = new Map();
    rawPositions.forEach((p, index) => {
      const key = p.map((value) => value.toFixed(6)).join("|");
      let target = byPosition.get(key);
      if (target === undefined) {
        target = positions.length / 3;
        byPosition.set(key, target);
        positions.push(p[0], p[1], p[2]);
      }
      remap[index] = target;
    });

    const indices = new Uint16Array(rawIndices.map((index) => remap[index]));
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i] * 3;
      const ib = indices[i + 1] * 3;
      const ic = indices[i + 2] * 3;
      const ab = [positions[ib] - positions[ia], positions[ib + 1] - positions[ia + 1], positions[ib + 2] - positions[ia + 2]];
      const ac = [positions[ic] - positions[ia], positions[ic + 1] - positions[ia + 1], positions[ic + 2] - positions[ia + 2]];
      const normal = cross3(ab, ac);
      [ia, ib, ic].forEach((offset) => {
        normals[offset] += normal[0];
        normals[offset + 1] += normal[1];
        normals[offset + 2] += normal[2];
      });
    }
    for (let i = 0; i < normals.length; i += 3) {
      const n = normalize3([normals[i], normals[i + 1], normals[i + 2]]);
      normals[i] = n[0]; normals[i + 1] = n[1]; normals[i + 2] = n[2];
    }
    return { positions: new Float32Array(positions), normals, indices };
  }

  function createInnerGeometry() {
    const positions = [];
    const normals = [];
    const indices = [];
    const half = 0.42;
    FACE_SPECS.forEach((face) => {
      const normal = normalize3(cross3(face.u, face.v));
      const center = normal.map((value) => value * 0.48);
      const base = positions.length / 3;
      [[-half, -half], [half, -half], [half, half], [-half, half]].forEach(([u, v]) => {
        positions.push(
          center[0] + face.u[0] * u + face.v[0] * v,
          center[1] + face.u[1] * u + face.v[1] * v,
          center[2] + face.u[2] * u + face.v[2] * v
        );
        normals.push(normal[0], normal[1], normal[2]);
      });
      indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
    });
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint16Array(indices)
    };
  }

  function createShadowGeometry() {
    return {
      positions: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 3, 1, 2, 3])
    };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Dice shader compilation failed: " + message);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      uniform mat4 u_model;
      uniform mat4 u_viewProjection;
      varying vec3 v_normal;
      varying vec3 v_worldPosition;
      varying vec3 v_localPosition;
      varying vec4 v_lightPosition;
      uniform mat4 u_lightViewProjection;
      void main() {
        vec4 world = u_model * vec4(a_position, 1.0);
        v_worldPosition = world.xyz;
        v_localPosition = a_position;
        v_normal = normalize(mat3(u_model) * a_normal);
        v_lightPosition = u_lightViewProjection * world;
        gl_Position = u_viewProjection * world;
      }
    `);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform vec3 u_color;
      uniform vec3 u_camera;
      uniform float u_shadow;
      uniform float u_shadowOpacity;
      uniform float u_shadowMapEnabled;
      uniform sampler2D u_shadowMap;
      uniform vec2 u_shadowTexelSize;
      uniform float u_shadowSoftness;
      uniform float u_shadowBias;
      varying vec3 v_normal;
      varying vec3 v_worldPosition;
      varying vec3 v_localPosition;
      varying vec4 v_lightPosition;

      float unpackDepth(vec4 packedDepth) {
        return dot(packedDepth, vec4(
          1.0 / 16777216.0,
          1.0 / 65536.0,
          1.0 / 256.0,
          1.0
        ));
      }

      float mappedShadow() {
        vec3 projected = v_lightPosition.xyz / v_lightPosition.w * 0.5 + 0.5;
        if (projected.x <= 0.0 || projected.x >= 1.0 ||
            projected.y <= 0.0 || projected.y >= 1.0 ||
            projected.z <= 0.0 || projected.z >= 1.0) return 0.0;
        float currentDepth = projected.z - u_shadowBias;
        float result = 0.0;
        for (int x = -1; x <= 1; x += 1) {
          for (int y = -1; y <= 1; y += 1) {
            vec2 offset = vec2(float(x), float(y)) * u_shadowTexelSize * u_shadowSoftness;
            float closestDepth = unpackDepth(texture2D(u_shadowMap, projected.xy + offset));
            result += currentDepth > closestDepth ? 1.0 : 0.0;
          }
        }
        return result / 9.0;
      }

      void main() {
        if (u_shadow > 0.5) {
          float alpha;
          if (u_shadowMapEnabled > 0.5) {
            alpha = mappedShadow() * u_shadowOpacity;
          } else {
            float radius = length(v_localPosition.xz);
            alpha = (1.0 - smoothstep(0.18, 1.0, radius)) * u_shadowOpacity;
          }
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(0.02, 0.025, 0.035, alpha);
          return;
        }
        vec3 normal = normalize(v_normal);
        vec3 light = normalize(vec3(-0.45, 0.82, 0.55));
        vec3 view = normalize(u_camera - v_worldPosition);
        vec3 halfVector = normalize(light + view);
        float diffuse = max(dot(normal, light), 0.0);
        float softFill = 0.68 + 0.38 * diffuse;
        float specular = pow(max(dot(normal, halfVector), 0.0), 42.0) * 0.18;
        float rim = pow(1.0 - max(dot(normal, view), 0.0), 2.0) * 0.08;
        vec3 color = u_color * softFill + vec3(specular + rim);
        gl_FragColor = vec4(color, 1.0);
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Dice shader link failed: " + gl.getProgramInfoLog(program));
    }
    return program;
  }

  function createShadowDepthProgram(gl) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      uniform mat4 u_model;
      uniform mat4 u_lightViewProjection;
      void main() {
        gl_Position = u_lightViewProjection * u_model * vec4(a_position, 1.0);
      }
    `);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
      precision highp float;
      vec4 packDepth(float depth) {
        const vec4 bitShift = vec4(16777216.0, 65536.0, 256.0, 1.0);
        const vec4 bitMask = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
        vec4 encodedDepth = fract(depth * bitShift);
        encodedDepth -= encodedDepth.xxyz * bitMask;
        return encodedDepth;
      }
      void main() {
        gl_FragColor = packDepth(gl_FragCoord.z);
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Dice shadow shader link failed: " + gl.getProgramInfoLog(program));
    }
    return program;
  }

  function createShadowMapResources(gl, size) {
    const program = createShadowDepthProgram(gl);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    if (!complete) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteRenderbuffer(depth);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      throw new Error("Dice shadow-map framebuffer is incomplete.");
    }
    return {
      program,
      texture,
      depth,
      framebuffer,
      size,
      position: gl.getAttribLocation(program, "a_position"),
      model: gl.getUniformLocation(program, "u_model"),
      lightViewProjection: gl.getUniformLocation(program, "u_lightViewProjection")
    };
  }

  function uploadGeometry(gl, geometry) {
    const position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    const normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normal);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
    const index = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    return { position, normal, index, count: geometry.indices.length };
  }

  let sharedOuterGeometry = null;
  let sharedInnerGeometry = null;
  let sharedShadowGeometry = null;

  function createRenderer(canvas, options) {
    const opts = options || {};
    let dieScale = Number(opts.dieScale) || 1.82;
    const halfScale = dieScale / 2;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: true,
      powerPreference: "low-power",
      premultipliedAlpha: true,
      preserveDrawingBuffer: true
    });
    if (!gl) throw new Error("WebGL is unavailable.");

    const program = createProgram(gl);
    const locations = {
      position: gl.getAttribLocation(program, "a_position"),
      normal: gl.getAttribLocation(program, "a_normal"),
      model: gl.getUniformLocation(program, "u_model"),
      viewProjection: gl.getUniformLocation(program, "u_viewProjection"),
      color: gl.getUniformLocation(program, "u_color"),
      camera: gl.getUniformLocation(program, "u_camera"),
      shadow: gl.getUniformLocation(program, "u_shadow"),
      shadowOpacity: gl.getUniformLocation(program, "u_shadowOpacity"),
      shadowMapEnabled: gl.getUniformLocation(program, "u_shadowMapEnabled"),
      shadowMap: gl.getUniformLocation(program, "u_shadowMap"),
      shadowTexelSize: gl.getUniformLocation(program, "u_shadowTexelSize"),
      shadowSoftness: gl.getUniformLocation(program, "u_shadowSoftness"),
      shadowBias: gl.getUniformLocation(program, "u_shadowBias"),
      lightViewProjection: gl.getUniformLocation(program, "u_lightViewProjection")
    };
    sharedOuterGeometry = sharedOuterGeometry || createOuterGeometry(28);
    sharedInnerGeometry = sharedInnerGeometry || createInnerGeometry();
    sharedShadowGeometry = sharedShadowGeometry || createShadowGeometry();
    const outer = uploadGeometry(gl, sharedOuterGeometry);
    const inner = uploadGeometry(gl, sharedInnerGeometry);
    const shadow = uploadGeometry(gl, sharedShadowGeometry);
    const camera = (opts.camera || [0, 5.35, 7.65]).slice();
    const cameraTarget = (opts.cameraTarget || [0, 1.02, 0]).slice();
    const cameraUp = (opts.cameraUp || [0, 1, 0]).slice();
    let fieldOfView = Number(opts.fieldOfView) || 34;
    let shadowOpacity = clamp(finiteNumber(opts.shadowOpacity, 0.28), 0, 0.8);
    let shadowOffsetX = clamp(finiteNumber(opts.shadowOffsetX, 0.22), -0.8, 0.8);
    let shadowOffsetZ = clamp(finiteNumber(opts.shadowOffsetZ, -0.14), -0.8, 0.8);
    let shadowMode = ["map", "blob", "none"].includes(opts.shadowMode) ? opts.shadowMode : "map";
    const shadowMapSize = clamp(Math.round(finiteNumber(opts.shadowMapSize, 512)), 128, 2048);
    let shadowSoftness = clamp(finiteNumber(opts.shadowSoftness, 1.35), 0.25, 4);
    let shadowBias = clamp(finiteNumber(opts.shadowBias, 0.0018), 0.0001, 0.02);
    let shadowMapResources = null;
    let shadowMapFailed = false;
    let shadowPlaneWidth = 20;
    let shadowPlaneDepth = 12;
    let lightViewProjection = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    let lightMatrixDirty = true;
    let lightMatrixAspect = 0;
    let cameraForward;
    let cameraRight;
    let cameraTrueUp;
    let tangentHalfFov = Math.tan(fieldOfView * Math.PI / 360);
    let viewProjection = new Float32Array(16);

    function ensureShadowMap() {
      if (shadowMode !== "map") return false;
      if (shadowMapResources) return true;
      if (shadowMapFailed) {
        shadowMode = "blob";
        return false;
      }
      try {
        shadowMapResources = createShadowMapResources(gl, shadowMapSize);
        return true;
      } catch (error) {
        shadowMapFailed = true;
        console.warn("Dice shadow mapping is unavailable; using the lightweight fallback.", error);
        shadowMode = "blob";
        return false;
      }
    }

    function updateLightMatrix(aspect) {
      const bounds = planeBoundsForCamera(
        camera,
        cameraTarget,
        cameraUp,
        fieldOfView,
        aspect,
        0,
        0
      );
      shadowPlaneWidth = bounds.width * 1.08;
      shadowPlaneDepth = bounds.depth * 1.08;
      const toLight = normalize3([-shadowOffsetX, 1, -shadowOffsetZ]);
      const target = [0, 2.25, 0];
      const eye = [
        target[0] + toLight[0] * 30,
        target[1] + toLight[1] * 30,
        target[2] + toLight[2] * 30
      ];
      const lightUp = Math.abs(toLight[1]) > 0.96 ? [0, 0, -1] : [0, 1, 0];
      const lightView = lookAt(eye, target, lightUp);
      const transformed = [];
      [-shadowPlaneWidth / 2, shadowPlaneWidth / 2].forEach((x) => {
        [0, 8].forEach((y) => {
          [-shadowPlaneDepth / 2, shadowPlaneDepth / 2].forEach((z) => {
            transformed.push(transformPoint(lightView, [x, y, z]));
          });
        });
      });
      const xs = transformed.map((point) => point[0]);
      const ys = transformed.map((point) => point[1]);
      const depths = transformed.map((point) => -point[2]);
      const padding = dieScale * 0.75;
      const projection = orthographic(
        Math.min(...xs) - padding,
        Math.max(...xs) + padding,
        Math.min(...ys) - padding,
        Math.max(...ys) + padding,
        Math.max(0.1, Math.min(...depths) - padding),
        Math.max(...depths) + padding
      );
      lightViewProjection = mat4Multiply(projection, lightView);
    }

    function refreshCameraBasis() {
      cameraForward = normalize3([
        cameraTarget[0] - camera[0],
        cameraTarget[1] - camera[1],
        cameraTarget[2] - camera[2]
      ]);
      cameraRight = normalize3(cross3(cameraForward, cameraUp));
      cameraTrueUp = normalize3(cross3(cameraRight, cameraForward));
    }

    refreshCameraBasis();

    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
    gl.disable(gl.CULL_FACE);
    gl.uniform3fv(locations.camera, camera);

    function bind(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
      gl.enableVertexAttribArray(locations.position);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
      gl.enableVertexAttribArray(locations.normal);
      gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(global.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      const aspect = width / height;
      if (lightMatrixDirty || Math.abs(aspect - lightMatrixAspect) > 0.0001) {
        updateLightMatrix(aspect);
        lightMatrixAspect = aspect;
        lightMatrixDirty = false;
      }
      // Keep depth precision concentrated around the dice. A fixed 0.1–250
      // frustum causes the recessed pip layer to shimmer when a distant camera
      // and very narrow field of view magnify tiny depth-buffer differences.
      const sceneDistance = Math.hypot(camera[0], camera[1] - 2, camera[2]);
      const nearPlane = Math.max(0.1, sceneDistance - 40);
      const farPlane = Math.max(nearPlane + 80, sceneDistance + 60);
      viewProjection = mat4Multiply(
        perspective(fieldOfView * Math.PI / 180, aspect, nearPlane, farPlane),
        lookAt(camera, cameraTarget, cameraUp)
      );
      gl.useProgram(program);
      gl.uniform3fv(locations.camera, camera);
      gl.uniformMatrix4fv(locations.viewProjection, false, viewProjection);
      gl.uniformMatrix4fv(locations.lightViewProjection, false, lightViewProjection);
    }

    function drawMesh(mesh, model, color, isShadow) {
      bind(mesh);
      gl.uniformMatrix4fv(locations.model, false, model);
      gl.uniform3fv(locations.color, color);
      gl.uniform1f(locations.shadow, isShadow ? 1 : 0);
      gl.uniform1f(locations.shadowOpacity, shadowOpacity);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }

    function renderShadowMap(dice) {
      if (!ensureShadowMap()) return false;
      const resources = shadowMapResources;
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
      gl.viewport(0, 0, resources.size, resources.size);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(resources.program);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.bindBuffer(gl.ARRAY_BUFFER, outer.position);
      gl.enableVertexAttribArray(resources.position);
      gl.vertexAttribPointer(resources.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, outer.index);
      gl.uniformMatrix4fv(resources.lightViewProjection, false, lightViewProjection);
      dice.forEach((die) => {
        gl.uniformMatrix4fv(resources.model, false, modelMatrix(die.position, die.quaternion, dieScale));
        gl.drawElements(gl.TRIANGLES, outer.count, gl.UNSIGNED_SHORT, 0);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return true;
    }

    function render(dice) {
      resize();
      const mapped = shadowMode === "map" && renderShadowMap(dice);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );
      gl.uniform3fv(locations.camera, camera);
      gl.uniformMatrix4fv(locations.viewProjection, false, viewProjection);
      gl.uniformMatrix4fv(locations.lightViewProjection, false, lightViewProjection);
      gl.uniform1f(locations.shadowMapEnabled, mapped ? 1 : 0);
      gl.uniform1f(locations.shadowSoftness, shadowSoftness);
      gl.uniform1f(locations.shadowBias, shadowBias);
      gl.uniform2f(locations.shadowTexelSize, 1 / shadowMapSize, 1 / shadowMapSize);
      if (mapped) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, shadowMapResources.texture);
        gl.uniform1i(locations.shadowMap, 0);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.depthMask(false);
      if (mapped) {
        drawMesh(
          shadow,
          shadowMatrix([0, 0, 0], shadowPlaneWidth / 2, shadowPlaneDepth / 2),
          [0, 0, 0],
          true
        );
      } else if (shadowMode === "blob") {
        dice.forEach((die) => {
          const height = clamp((die.position[1] - halfScale) / 4, 0, 1);
          const castHeight = Math.max(0, die.position[1] - 0.04);
          const shadowPosition = [
            die.position[0] + shadowOffsetX * castHeight,
            0,
            die.position[2] + shadowOffsetZ * castHeight
          ];
          drawMesh(
            shadow,
            shadowMatrix(shadowPosition, dieScale * (0.76 + height * 0.22), dieScale * (0.58 + height * 0.18)),
            [0, 0, 0],
            true
          );
        });
      }
      gl.depthMask(true);

      dice.forEach((die) => {
        const model = modelMatrix(die.position, die.quaternion, dieScale);
        drawMesh(inner, model, die.pipColor, false);
        drawMesh(outer, model, [0.91, 0.925, 0.94], false);
      });
    }

    function projectPoint(point) {
      const rect = canvas.getBoundingClientRect();
      const relative = [point[0] - camera[0], point[1] - camera[1], point[2] - camera[2]];
      const depth = dot3(relative, cameraForward);
      if (depth <= 0 || rect.width <= 0 || rect.height <= 0) return null;
      const aspect = rect.width / rect.height;
      const ndcX = dot3(relative, cameraRight) / (depth * tangentHalfFov * aspect);
      const ndcY = dot3(relative, cameraTrueUp) / (depth * tangentHalfFov);
      return {
        x: (ndcX + 1) * rect.width / 2,
        y: (1 - ndcY) * rect.height / 2,
        depth
      };
    }

    function screenToWorld(clientX, clientY, planeY) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const ndcX = (clientX - rect.left) / rect.width * 2 - 1;
      const ndcY = 1 - (clientY - rect.top) / rect.height * 2;
      const aspect = rect.width / rect.height;
      const direction = normalize3([
        cameraForward[0] + cameraRight[0] * ndcX * tangentHalfFov * aspect + cameraTrueUp[0] * ndcY * tangentHalfFov,
        cameraForward[1] + cameraRight[1] * ndcX * tangentHalfFov * aspect + cameraTrueUp[1] * ndcY * tangentHalfFov,
        cameraForward[2] + cameraRight[2] * ndcX * tangentHalfFov * aspect + cameraTrueUp[2] * ndcY * tangentHalfFov
      ]);
      if (Math.abs(direction[1]) < EPSILON) return null;
      const distance = (planeY - camera[1]) / direction[1];
      if (distance <= 0) return null;
      return [
        camera[0] + direction[0] * distance,
        planeY,
        camera[2] + direction[2] * distance
      ];
    }

    function projectedDieSize(position) {
      const center = projectPoint(position);
      const edge = projectPoint([position[0] + dieScale * 0.72, position[1], position[2]]);
      if (!center || !edge) return 54;
      return clamp(Math.abs(edge.x - center.x) * 2, 48, 108);
    }

    function setCameraHeight(height) {
      return setCameraOptions({ position: [camera[0], height, camera[2]] }).position[1];
    }

    function setDieScale(value) {
      dieScale = clamp(finiteNumber(value, dieScale), 0.8, 3);
      return dieScale;
    }

    function setCameraOptions(optionsToApply) {
      const next = optionsToApply || {};
      if (Array.isArray(next.position)) {
        camera[0] = clamp(finiteNumber(next.position[0], camera[0]), -100, 100);
        camera[1] = clamp(finiteNumber(next.position[1], camera[1]), 0.1, 100);
        camera[2] = clamp(finiteNumber(next.position[2], camera[2]), -100, 100);
      }
      if (Array.isArray(next.target)) {
        cameraTarget[0] = clamp(finiteNumber(next.target[0], cameraTarget[0]), -100, 100);
        cameraTarget[1] = clamp(finiteNumber(next.target[1], cameraTarget[1]), -100, 100);
        cameraTarget[2] = clamp(finiteNumber(next.target[2], cameraTarget[2]), -100, 100);
      }
      fieldOfView = clamp(finiteNumber(next.fieldOfView, fieldOfView), 1, 120);
      tangentHalfFov = Math.tan(fieldOfView * Math.PI / 360);
      refreshCameraBasis();
      lightMatrixDirty = true;
      resize();
      return {
        position: camera.slice(),
        target: cameraTarget.slice(),
        fieldOfView
      };
    }

    function setShadowOptions(optionsToApply) {
      const next = optionsToApply || {};
      shadowOpacity = clamp(finiteNumber(next.opacity, shadowOpacity), 0, 0.8);
      shadowOffsetX = clamp(finiteNumber(next.offsetX, shadowOffsetX), -0.8, 0.8);
      shadowOffsetZ = clamp(finiteNumber(next.offsetZ, shadowOffsetZ), -0.8, 0.8);
      shadowSoftness = clamp(finiteNumber(next.softness, shadowSoftness), 0.25, 4);
      shadowBias = clamp(finiteNumber(next.bias, shadowBias), 0.0001, 0.02);
      lightMatrixDirty = true;
      if (next.mode !== undefined) setShadowMode(next.mode);
      resize();
      return {
        mode: shadowMode,
        opacity: shadowOpacity,
        offsetX: shadowOffsetX,
        offsetZ: shadowOffsetZ,
        softness: shadowSoftness,
        bias: shadowBias
      };
    }

    function setShadowMode(mode) {
      shadowMode = ["map", "blob", "none"].includes(mode) ? mode : shadowMode;
      if (shadowMode === "map") ensureShadowMap();
      return shadowMode;
    }

    function releaseShadowMap() {
      if (!shadowMapResources) return false;
      gl.deleteFramebuffer(shadowMapResources.framebuffer);
      gl.deleteRenderbuffer(shadowMapResources.depth);
      gl.deleteTexture(shadowMapResources.texture);
      gl.deleteProgram(shadowMapResources.program);
      shadowMapResources = null;
      return true;
    }

    function planeBoundsAtInset(inset, planeY) {
      const rect = canvas.getBoundingClientRect();
      const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
      return planeBoundsForCamera(
        camera,
        cameraTarget,
        cameraUp,
        fieldOfView,
        aspect,
        inset,
        finiteNumber(planeY, 0)
      );
    }

    function destroy() {
      [outer, inner, shadow].forEach((mesh) => {
        gl.deleteBuffer(mesh.position);
        gl.deleteBuffer(mesh.normal);
        gl.deleteBuffer(mesh.index);
      });
      releaseShadowMap();
      gl.deleteProgram(program);
    }

    resize();
    return {
      render,
      resize,
      projectPoint,
      projectedDieSize,
      screenToWorld,
      setDieScale,
      setCameraHeight,
      setCameraOptions,
      getCameraOptions: () => ({ position: camera.slice(), target: cameraTarget.slice(), fieldOfView }),
      setShadowOptions,
      setShadowMode,
      releaseShadowMap,
      hasShadowMapResources: () => Boolean(shadowMapResources),
      planeBoundsAtInset,
      destroy
    };
  }

  function prefersReducedMotion() {
    return global.interactiveRuntime && global.interactiveRuntime.motion
      ? global.interactiveRuntime.motion.isReduced()
      : Boolean(global.matchMedia &&
          global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function hashSeed(seed) {
    const text = String(seed == null ? "dice-v1" : seed);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
    return function() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function addStaticPlane(world, position, rotation, material) {
    const body = new Body({ mass: 0, shape: new Plane(), material });
    body.position.set(position[0], position[1], position[2]);
    body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2], "XYZ");
    world.addBody(body);
    return body;
  }

  const FACE_NORMALS = [
    { normal: new Vec3(0, 1, 0), value: 1 },
    { normal: new Vec3(1, 0, 0), value: 2 },
    { normal: new Vec3(0, 0, 1), value: 3 },
    { normal: new Vec3(0, 0, -1), value: 4 },
    { normal: new Vec3(-1, 0, 0), value: 5 },
    { normal: new Vec3(0, -1, 0), value: 6 }
  ];
  const DICE_PIP_COLORS = [
    [0.82, 0.25, 0.31],
    [0.20, 0.47, 0.69],
    [0.28, 0.62, 0.36],
    [0.82, 0.64, 0.12],
    [0.58, 0.36, 0.72],
    [0.45, 0.45, 0.48]
  ];

  function restingQuaternion(value, yaw) {
    const base = new Quaternion();
    if (value === 2) base.setFromEuler(0, 0, -Math.PI / 2);
    else if (value === 3) base.setFromEuler(Math.PI / 2, 0, 0);
    else if (value === 4) base.setFromEuler(-Math.PI / 2, 0, 0);
    else if (value === 5) base.setFromEuler(0, 0, Math.PI / 2);
    else if (value === 6) base.setFromEuler(Math.PI, 0, 0);
    const turn = new Quaternion().setFromAxisAngle(new Vec3(0, 1, 0), yaw);
    return turn.mult(base).normalize();
  }

  function faceUp(body) {
    let bestValue = 1;
    let bestY = -Infinity;
    FACE_NORMALS.forEach((face) => {
      const worldNormal = body.quaternion.vmult(face.normal);
      if (worldNormal.y > bestY) {
        bestY = worldNormal.y;
        bestValue = face.value;
      }
    });
    return bestValue;
  }

  function faceAlignment(body) {
    return FACE_NORMALS.reduce((best, face) => {
      return Math.max(best, body.quaternion.vmult(face.normal).y);
    }, -Infinity);
  }

  function createDicePhysics(numberOfDice, options) {
    const opts = options || {};
    const dieScale = Number(opts.dieScale) || 1.82;
    const half = dieScale / 2;
    const throwProfile = opts.throwProfile === "approach" ? "approach" : "standard";
    const requestedThrowSettings = opts.throwSettings || {};
    const throwSettings = {
      spread: clamp(finiteNumber(requestedThrowSettings.spread, 1.65), 0.5, 3.5),
      startHeight: clamp(finiteNumber(requestedThrowSettings.startHeight, 3.15), 1.2, 8),
      startDistance: clamp(finiteNumber(requestedThrowSettings.startDistance, 8), 2, 14),
      lateralSpeed: clamp(finiteNumber(requestedThrowSettings.lateralSpeed, 1.1), 0, 6),
      lift: clamp(finiteNumber(requestedThrowSettings.lift, 0.35), 0, 5),
      forwardSpeed: clamp(finiteNumber(requestedThrowSettings.forwardSpeed, 7.2), 1, 16)
    };
    let halfWidth = Number(opts.halfWidth) || 4.5;
    let halfDepth = Number(opts.halfDepth) || 3.5;
    const tuning = {
      gravity: clamp(finiteNumber(opts.gravity, 30), 0, 80),
      mass: clamp(finiteNumber(opts.mass, 1.5), 0.1, 10),
      floorFriction: clamp(finiteNumber(opts.floorFriction, 0.24), 0, 1),
      wallFriction: clamp(finiteNumber(opts.wallFriction, 0.015), 0, 1),
      diceFriction: clamp(finiteNumber(opts.diceFriction, 0.04), 0, 1),
      restitution: clamp(finiteNumber(opts.restitution, 0.34), 0, 1),
      linearDamping: clamp(finiteNumber(opts.linearDamping, 0.08), 0, 0.95),
      angularDamping: clamp(finiteNumber(opts.angularDamping, 0.08), 0, 0.95),
      sleepSpeed: clamp(finiteNumber(opts.sleepSpeed, 0.16), 0.02, 1),
      throwStrength: clamp(finiteNumber(opts.throwStrength, 1), 0.25, 2.5),
      spinStrength: clamp(finiteNumber(opts.spinStrength, 1), 0, 2.5),
      releaseSpeedScale: clamp(finiteNumber(opts.releaseSpeedScale, 1), 0.1, 4),
      releaseMinSpeed: clamp(finiteNumber(opts.releaseMinSpeed, 3.5), 0, 20),
      releaseMaxSpeed: clamp(finiteNumber(opts.releaseMaxSpeed, 8), 1, 50),
      releaseLift: clamp(finiteNumber(opts.releaseLift, 4.3), 0, 20),
      releaseSpinBoost: clamp(finiteNumber(opts.releaseSpinBoost, 1), 0, 4),
      arenaWidth: halfWidth * 2,
      arenaDepth: halfDepth * 2
    };
    const world = new World({
      gravity: new Vec3(0, -tuning.gravity, 0),
      allowSleep: true
    });
    world.broadphase = new SAPBroadphase(world);
    world.defaultContactMaterial.friction = 0.08;
    world.defaultContactMaterial.restitution = 0.34;
    world.solver.iterations = 12;

    const diceMaterial = new Material("dice");
    const floorMaterial = new Material("dice-floor");
    const wallMaterial = new Material("dice-wall");
    const floorContact = new ContactMaterial(diceMaterial, floorMaterial, {
      friction: tuning.floorFriction,
      restitution: tuning.restitution
    });
    const wallContact = new ContactMaterial(diceMaterial, wallMaterial, {
      friction: tuning.wallFriction,
      restitution: tuning.restitution
    });
    const diceContact = new ContactMaterial(diceMaterial, diceMaterial, {
      friction: tuning.diceFriction,
      restitution: tuning.restitution
    });
    world.addContactMaterial(floorContact);
    world.addContactMaterial(wallContact);
    world.addContactMaterial(diceContact);

    const staticBodies = [
      addStaticPlane(world, [0, 0, 0], [-Math.PI / 2, 0, 0], floorMaterial),
      addStaticPlane(world, [-halfWidth, 0, 0], [0, Math.PI / 2, 0], wallMaterial),
      addStaticPlane(world, [halfWidth, 0, 0], [0, -Math.PI / 2, 0], wallMaterial),
      addStaticPlane(world, [0, 0, -halfDepth], [0, 0, 0], wallMaterial),
      addStaticPlane(world, [0, 0, halfDepth], [0, Math.PI, 0], wallMaterial)
    ];
    const bodies = [];
    const landingCorrections = Array(numberOfDice).fill(null);
    const landingStallStartedAt = Array(numberOfDice).fill(null);
    let grabState = null;
    for (let i = 0; i < numberOfDice; i += 1) {
      const body = new Body({
        mass: tuning.mass,
        shape: new Box(new Vec3(half, half, half)),
        material: diceMaterial,
        linearDamping: tuning.linearDamping,
        angularDamping: tuning.angularDamping,
        sleepSpeedLimit: tuning.sleepSpeed,
        sleepTimeLimit: 0.25
      });
      body.allowSleep = true;
      world.addBody(body);
      bodies.push(body);
    }

    let elapsed = 0;

    function restoreGrabBodies() {
      bodies.forEach((body) => {
        body.collisionResponse = true;
        body.allowSleep = true;
      });
    }

    function clearGrab() {
      restoreGrabBodies();
      grabState = null;
    }

    function synchronizeTeleportedBody(body) {
      body.previousPosition.copy(body.position);
      body.interpolatedPosition.copy(body.position);
      body.previousQuaternion.copy(body.quaternion);
      body.interpolatedQuaternion.copy(body.quaternion);
      body.updateInertiaWorld(true);
      body.aabbNeedsUpdate = true;
    }

    function throwDice(random) {
      clearGrab();
      elapsed = 0;
      landingCorrections.fill(null);
      landingStallStartedAt.fill(null);
      let standardThrow = null;
      if (throwProfile === "standard") {
        const sourceSide = random() < 0.5 ? -1 : 1;
        const source = [
          sourceSide * (3.75 + random() * 0.45),
          (random() - 0.5) * 1.4
        ];
        const target = [
          (random() - 0.5) * 1.4,
          (random() - 0.5) * 1.0
        ];
        const deltaX = target[0] - source[0];
        const deltaZ = target[1] - source[1];
        const directionLength = Math.hypot(deltaX, deltaZ) || 1;
        const direction = [deltaX / directionLength, deltaZ / directionLength];
        standardThrow = {
          source,
          target,
          direction,
          perpendicular: [-direction[1], direction[0]],
          columns: Math.min(3, Math.ceil(Math.sqrt(numberOfDice))),
          travelSpeed: 6.2 + random() * 1.4
        };
        standardThrow.rows = Math.ceil(numberOfDice / standardThrow.columns);
      }
      bodies.forEach((body, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const lane = Math.floor(index / 2);
        let standardTarget = null;
        if (throwProfile === "approach") {
          body.position.set(
            side * (throwSettings.spread + random() * 0.4),
            throwSettings.startHeight + random() * 0.55 + lane * 0.12,
            -throwSettings.startDistance - random() * 0.4 - lane * 0.18
          );
        } else {
          const column = index % standardThrow.columns;
          const row = Math.floor(index / standardThrow.columns);
          const perpendicularOffset = (column - (standardThrow.columns - 1) / 2) * dieScale * 1.06;
          const directionOffset = (row - (standardThrow.rows - 1) / 2) * dieScale * 1.06;
          standardTarget = [
            standardThrow.target[0]
              + standardThrow.perpendicular[0] * perpendicularOffset * 0.34
              + standardThrow.direction[0] * directionOffset * 0.12,
            standardThrow.target[1]
              + standardThrow.perpendicular[1] * perpendicularOffset * 0.34
              + standardThrow.direction[1] * directionOffset * 0.12
          ];
          body.position.set(
            standardThrow.source[0]
              + standardThrow.perpendicular[0] * perpendicularOffset
              - standardThrow.direction[0] * directionOffset,
            3.8 + random() * 0.5 + row * 0.12,
            standardThrow.source[1]
              + standardThrow.perpendicular[1] * perpendicularOffset
              - standardThrow.direction[1] * directionOffset
          );
        }
        body.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2);
        if (throwProfile === "approach") {
          body.velocity.set(
            -side * (throwSettings.lateralSpeed + random() * 0.9) * tuning.throwStrength,
            (throwSettings.lift + random() * 1.1) * tuning.throwStrength,
            (throwSettings.forwardSpeed + random() * 1.2) * tuning.throwStrength
          );
        } else {
          const deltaX = standardTarget[0] - body.position.x;
          const deltaZ = standardTarget[1] - body.position.z;
          const directionLength = Math.hypot(deltaX, deltaZ) || 1;
          const travelSpeed = (standardThrow.travelSpeed + (random() - 0.5) * 0.8) * tuning.throwStrength;
          body.velocity.set(
            deltaX / directionLength * travelSpeed,
            (1.4 + random() * 2.1) * tuning.throwStrength,
            deltaZ / directionLength * travelSpeed
          );
        }
        body.angularVelocity.set(
          (random() - 0.5) * 18 * tuning.spinStrength,
          (random() - 0.5) * 18 * tuning.spinStrength,
          (random() - 0.5) * 18 * tuning.spinStrength
        );
        body.force.setZero();
        body.torque.setZero();
        synchronizeTeleportedBody(body);
        body.wakeUp();
      });
      world.broadphase.dirty = true;
    }

    function beginGrab(index, target) {
      const leaderIndex = clamp(Math.round(index), 0, bodies.length - 1);
      const leader = bodies[leaderIndex];
      const spacing = dieScale * 1.06;
      const followerIndices = bodies.map((_, bodyIndex) => bodyIndex).filter((bodyIndex) => bodyIndex !== leaderIndex);
      const followers = followerIndices.map((bodyIndex, followerPosition) => {
        const follower = bodies[bodyIndex];
        const angle = bodies.length === 2
          ? Math.atan2(follower.position.z - leader.position.z, follower.position.x - leader.position.x)
          : followerPosition / followerIndices.length * Math.PI * 2;
        return {
          index: bodyIndex,
          offset: new Vec3(Math.cos(angle) * spacing, -dieScale * 0.08, Math.sin(angle) * spacing),
          gathered: false
        };
      });
      elapsed = 0;
      landingCorrections.fill(null);
      landingStallStartedAt.fill(null);
      grabState = {
        leaderIndex,
        followers,
        target: new Vec3(target[0], target[1], target[2]),
        startedAt: 0
      };
      bodies.forEach((body) => {
        body.collisionResponse = false;
        body.allowSleep = false;
        body.wakeUp();
      });
      leader.velocity.setZero();
      leader.angularVelocity.setZero();
      return true;
    }

    function updateGrabTarget(target) {
      if (!grabState || !target) return;
      grabState.target.set(
        clamp(target[0], -halfWidth + half * 1.1, halfWidth - half * 1.1),
        clamp(target[1], half + 0.8, 4.8),
        clamp(target[2], -halfDepth + half * 1.1, halfDepth - half * 1.1)
      );
    }

    function updateGrabPose() {
      if (!grabState) return;
      const leader = bodies[grabState.leaderIndex];
      const follow = 0.34;
      leader.position.x += (grabState.target.x - leader.position.x) * follow;
      leader.position.y += (grabState.target.y - leader.position.y) * follow;
      leader.position.z += (grabState.target.z - leader.position.z) * follow;
      leader.velocity.setZero();
      leader.angularVelocity.setZero();
      leader.force.setZero();
      leader.torque.setZero();
      leader.aabbNeedsUpdate = true;
      leader.wakeUp();

      grabState.followers.forEach((record) => {
        const follower = bodies[record.index];
        const desired = new Vec3(
          leader.position.x + record.offset.x,
          leader.position.y + record.offset.y,
          leader.position.z + record.offset.z
        );
        const delta = desired.vsub(follower.position);
        if (!record.gathered) {
          const distance = delta.length();
          const pull = 0.26;
          follower.velocity.x += (delta.x * 7 - follower.velocity.x) * pull;
          follower.velocity.y += (delta.y * 7 - follower.velocity.y) * pull;
          follower.velocity.z += (delta.z * 7 - follower.velocity.z) * pull;
          const speed = follower.velocity.length();
          if (speed > 10) follower.velocity.scale(10 / speed, follower.velocity);
          follower.angularVelocity.scale(0.82, follower.angularVelocity);
          if (distance < dieScale * 0.48 || elapsed - grabState.startedAt > 0.58) {
            record.gathered = true;
          }
        }
        if (record.gathered) {
          const gather = 0.3;
          follower.position.x += (desired.x - follower.position.x) * gather;
          follower.position.y += (desired.y - follower.position.y) * gather;
          follower.position.z += (desired.z - follower.position.z) * gather;
          follower.velocity.setZero();
          follower.angularVelocity.setZero();
        }
        follower.force.setZero();
        follower.torque.setZero();
        follower.aabbNeedsUpdate = true;
        follower.wakeUp();
      });
    }

    function releaseGrab(pointerVelocity, random, fallbackDirection) {
      if (!grabState) return false;
      const source = typeof random === "function" ? random : Math.random;
      let velocityX = Number(pointerVelocity && pointerVelocity[0]) || 0;
      let velocityZ = Number(pointerVelocity && pointerVelocity[2]) || 0;
      const measuredSpeed = Math.hypot(velocityX, velocityZ);
      let directionX;
      let directionZ;
      if (measuredSpeed > 0.05) {
        directionX = velocityX / measuredSpeed;
        directionZ = velocityZ / measuredSpeed;
      } else if (fallbackDirection && Math.hypot(fallbackDirection[0], fallbackDirection[2]) > 0.05) {
        const fallbackLength = Math.hypot(fallbackDirection[0], fallbackDirection[2]);
        directionX = fallbackDirection[0] / fallbackLength;
        directionZ = fallbackDirection[2] / fallbackLength;
      } else {
        const angle = source() * Math.PI * 2;
        directionX = Math.cos(angle);
        directionZ = Math.sin(angle);
      }
      const minimumSpeed = Math.min(tuning.releaseMinSpeed, tuning.releaseMaxSpeed);
      const maximumSpeed = Math.max(tuning.releaseMinSpeed, tuning.releaseMaxSpeed);
      const horizontalSpeed = clamp(measuredSpeed * tuning.releaseSpeedScale, minimumSpeed, maximumSpeed);
      velocityX = directionX * horizontalSpeed;
      velocityZ = directionZ * horizontalSpeed;
      const releaseOffsets = new Map(grabState.followers.map((record) => [record.index, record.offset]));
      if (grabState.followers.length === 1) {
        const onlyOffset = grabState.followers[0].offset;
        releaseOffsets.set(grabState.leaderIndex, new Vec3(-onlyOffset.x, 0, -onlyOffset.z));
      }
      restoreGrabBodies();
      bodies.forEach((body, index) => {
        const releaseOffset = releaseOffsets.get(index) || new Vec3(0, 0, 0);
        const releaseOffsetLength = Math.hypot(releaseOffset.x, releaseOffset.z) || 1;
        const separationX = releaseOffset.x / releaseOffsetLength;
        const separationZ = releaseOffset.z / releaseOffsetLength;
        body.position.y = Math.max(body.position.y, half + 0.08);
        body.velocity.set(
          (velocityX + separationX * 0.28) * tuning.throwStrength,
          (tuning.releaseLift + Math.min(1.25, horizontalSpeed * 0.16) + source() * 0.45) * tuning.throwStrength,
          (velocityZ + separationZ * 0.28) * tuning.throwStrength
        );
        body.angularVelocity.set(
          (source() - 0.5) * 17 * tuning.spinStrength * tuning.releaseSpinBoost,
          (source() - 0.5) * 17 * tuning.spinStrength * tuning.releaseSpinBoost,
          (source() - 0.5) * 17 * tuning.spinStrength * tuning.releaseSpinBoost
        );
        body.force.setZero();
        body.torque.setZero();
        body.aabbNeedsUpdate = true;
        body.wakeUp();
      });
      grabState = null;
      elapsed = 0;
      landingCorrections.fill(null);
      landingStallStartedAt.fill(null);
      return true;
    }

    function step() {
      world.step(1 / 60);
      elapsed += 1 / 60;
      if (grabState) {
        updateGrabPose();
        return;
      }
      bodies.forEach((body, index) => {
        if (body.position.y < -4 || Math.abs(body.position.x) > halfWidth + 2.5 || Math.abs(body.position.z) > halfDepth + 2.5) {
          const side = index % 2 === 0 ? -1 : 1;
          body.position.set(side * 1.1, 3.2 + index * 0.18, 0);
          body.velocity.set(-side * 1.4, 0.4, -0.6);
          body.angularVelocity.set(side * 5.5, 7.5, -side * 4.5);
          body.force.setZero();
          body.torque.setZero();
          body.aabbNeedsUpdate = true;
          body.wakeUp();
        }

        const correction = landingCorrections[index];
        if (correction) {
          const progress = clamp((elapsed - correction.startedAt) / 0.2, 0, 1);
          const eased = progress * progress * (3 - 2 * progress);
          correction.fromQuaternion.slerp(correction.toQuaternion, eased, body.quaternion);
          body.position.set(
            correction.fromPosition.x + (correction.toPosition.x - correction.fromPosition.x) * eased,
            correction.fromPosition.y + (correction.toPosition.y - correction.fromPosition.y) * eased,
            correction.fromPosition.z + (correction.toPosition.z - correction.fromPosition.z) * eased
          );
          body.velocity.setZero();
          body.angularVelocity.setZero();
          body.force.setZero();
          body.torque.setZero();
          body.aabbNeedsUpdate = true;
          if (progress >= 1) {
            landingCorrections[index] = null;
            landingStallStartedAt[index] = null;
            body.sleep();
          } else {
            body.wakeUp();
          }
          return;
        }

        const alignment = faceAlignment(body);
        const linearSpeedSquared = body.velocity.x * body.velocity.x
          + body.velocity.y * body.velocity.y
          + body.velocity.z * body.velocity.z;
        const angularSpeedSquared = body.angularVelocity.x * body.angularVelocity.x
          + body.angularVelocity.y * body.angularVelocity.y
          + body.angularVelocity.z * body.angularVelocity.z;
        const isNearFloor = body.position.y < half * 1.75;
        const isStalledOffFace = (
          elapsed > 1.1
          && alignment < 0.985
          && isNearFloor
          && linearSpeedSquared < 0.045
          && angularSpeedSquared < 0.08
        );
        const needsLateLandingCorrection = (
          elapsed > 3.2
          && alignment < 0.985
          && isNearFloor
          && linearSpeedSquared < 0.2
          && angularSpeedSquared < 0.35
        );
        if (
          elapsed > 3.2
          && alignment >= 0.985
          && linearSpeedSquared < 0.08
          && angularSpeedSquared < 0.08
        ) {
          body.sleep();
          return;
        }
        if (!isStalledOffFace) {
          landingStallStartedAt[index] = null;
        } else if (landingStallStartedAt[index] === null) {
          landingStallStartedAt[index] = elapsed;
        }
        if (
          needsLateLandingCorrection
          || (landingStallStartedAt[index] !== null && elapsed - landingStallStartedAt[index] > 0.28)
        ) {
          let landingNormal = null;
          let topY = -Infinity;
          FACE_NORMALS.forEach((face) => {
            const normal = body.quaternion.vmult(face.normal);
            if (normal.y > topY) {
              topY = normal.y;
              landingNormal = normal;
            }
          });
          const correctionQuaternion = new Quaternion().setFromVectors(landingNormal, new Vec3(0, 1, 0));
          landingCorrections[index] = {
            startedAt: elapsed,
            fromQuaternion: body.quaternion.clone(),
            toQuaternion: correctionQuaternion.mult(body.quaternion).normalize(),
            fromPosition: body.position.clone(),
            toPosition: new Vec3(
              clamp(body.position.x, -halfWidth + half, halfWidth - half),
              half + 0.002,
              clamp(body.position.z, -halfDepth + half, halfDepth - half)
            )
          };
          body.velocity.setZero();
          body.angularVelocity.setZero();
          body.wakeUp();
        }
      });
    }

    function isSettled() {
      return !grabState && elapsed > 0.65 && landingCorrections.every((correction) => correction === null) && bodies.every((body) => {
        return body.sleepState === Body.SLEEPING && faceAlignment(body) >= 0.985;
      });
    }

    function settleImmediately() {
      for (let i = 0; i < 900 && !isSettled(); i += 1) step();
      if (!isSettled()) bodies.forEach((body) => body.sleep());
    }

    function snapshot() {
      return bodies.map((body, index) => ({
        position: [body.position.x, body.position.y, body.position.z],
        quaternion: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w],
        pipColor: DICE_PIP_COLORS[index % DICE_PIP_COLORS.length]
      }));
    }

    function setPose(dice) {
      clearGrab();
      elapsed = 1;
      landingCorrections.fill(null);
      landingStallStartedAt.fill(null);
      bodies.forEach((body, index) => {
        const die = dice && dice[index];
        if (!die || !Array.isArray(die.position) || !Array.isArray(die.quaternion)) return;
        body.position.set(die.position[0], die.position[1], die.position[2]);
        body.quaternion.set(die.quaternion[0], die.quaternion[1], die.quaternion[2], die.quaternion[3]);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.force.setZero();
        body.torque.setZero();
        synchronizeTeleportedBody(body);
        body.sleep();
      });
      world.broadphase.dirty = true;
    }

    function outcomes() {
      return bodies.map(faceUp);
    }

    function setRestingPose() {
      clearGrab();
      elapsed = 1;
      const columns = Math.min(3, Math.ceil(Math.sqrt(bodies.length)));
      const rows = Math.ceil(bodies.length / columns);
      const spacing = dieScale * 1.42;
      bodies.forEach((body, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        body.position.set(
          (column - (columns - 1) / 2) * spacing,
          half,
          (row - (rows - 1) / 2) * spacing
        );
        body.quaternion.setFromEuler(0, index % 2 === 0 ? -0.28 : 0.4, 0);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.force.setZero();
        body.torque.setZero();
        synchronizeTeleportedBody(body);
        body.sleep();
      });
      world.broadphase.dirty = true;
    }

    function getTuning() {
      return Object.assign({}, tuning);
    }

    function getThrowSettings() {
      return Object.assign({}, throwSettings);
    }

    function setThrowSettings(changes) {
      const next = changes || {};
      throwSettings.spread = clamp(finiteNumber(next.spread, throwSettings.spread), 0.5, 3.5);
      throwSettings.startHeight = clamp(finiteNumber(next.startHeight, throwSettings.startHeight), 1.2, 8);
      throwSettings.startDistance = clamp(finiteNumber(next.startDistance, throwSettings.startDistance), 2, 14);
      throwSettings.lateralSpeed = clamp(finiteNumber(next.lateralSpeed, throwSettings.lateralSpeed), 0, 6);
      throwSettings.lift = clamp(finiteNumber(next.lift, throwSettings.lift), 0, 5);
      throwSettings.forwardSpeed = clamp(finiteNumber(next.forwardSpeed, throwSettings.forwardSpeed), 1, 16);
      return getThrowSettings();
    }

    function setTuning(changes) {
      const next = changes || {};
      tuning.gravity = clamp(finiteNumber(next.gravity, tuning.gravity), 0, 80);
      tuning.mass = clamp(finiteNumber(next.mass, tuning.mass), 0.1, 10);
      tuning.floorFriction = clamp(finiteNumber(next.floorFriction, tuning.floorFriction), 0, 1);
      tuning.wallFriction = clamp(finiteNumber(next.wallFriction, tuning.wallFriction), 0, 1);
      tuning.diceFriction = clamp(finiteNumber(next.diceFriction, tuning.diceFriction), 0, 1);
      tuning.restitution = clamp(finiteNumber(next.restitution, tuning.restitution), 0, 1);
      tuning.linearDamping = clamp(finiteNumber(next.linearDamping, tuning.linearDamping), 0, 0.95);
      tuning.angularDamping = clamp(finiteNumber(next.angularDamping, tuning.angularDamping), 0, 0.95);
      tuning.sleepSpeed = clamp(finiteNumber(next.sleepSpeed, tuning.sleepSpeed), 0.02, 1);
      tuning.throwStrength = clamp(finiteNumber(next.throwStrength, tuning.throwStrength), 0.25, 2.5);
      tuning.spinStrength = clamp(finiteNumber(next.spinStrength, tuning.spinStrength), 0, 2.5);
      tuning.releaseSpeedScale = clamp(finiteNumber(next.releaseSpeedScale, tuning.releaseSpeedScale), 0.1, 4);
      tuning.releaseMinSpeed = clamp(finiteNumber(next.releaseMinSpeed, tuning.releaseMinSpeed), 0, 20);
      tuning.releaseMaxSpeed = clamp(finiteNumber(next.releaseMaxSpeed, tuning.releaseMaxSpeed), 1, 50);
      tuning.releaseLift = clamp(finiteNumber(next.releaseLift, tuning.releaseLift), 0, 20);
      tuning.releaseSpinBoost = clamp(finiteNumber(next.releaseSpinBoost, tuning.releaseSpinBoost), 0, 4);
      tuning.arenaWidth = clamp(finiteNumber(next.arenaWidth, tuning.arenaWidth), dieScale * 2.4, 40);
      tuning.arenaDepth = clamp(finiteNumber(next.arenaDepth, tuning.arenaDepth), dieScale * 2.4, 20);
      halfWidth = tuning.arenaWidth / 2;
      halfDepth = tuning.arenaDepth / 2;

      world.gravity.y = -tuning.gravity;
      floorContact.friction = tuning.floorFriction;
      wallContact.friction = tuning.wallFriction;
      diceContact.friction = tuning.diceFriction;
      floorContact.restitution = tuning.restitution;
      wallContact.restitution = tuning.restitution;
      diceContact.restitution = tuning.restitution;
      staticBodies[1].position.x = -halfWidth;
      staticBodies[2].position.x = halfWidth;
      staticBodies[3].position.z = -halfDepth;
      staticBodies[4].position.z = halfDepth;
      staticBodies.slice(1).forEach((body) => {
        body.aabbNeedsUpdate = true;
      });
      bodies.forEach((body) => {
        body.mass = tuning.mass;
        body.linearDamping = tuning.linearDamping;
        body.angularDamping = tuning.angularDamping;
        body.sleepSpeedLimit = tuning.sleepSpeed;
        body.updateMassProperties();
        body.position.x = clamp(body.position.x, -halfWidth + half, halfWidth - half);
        body.position.z = clamp(body.position.z, -halfDepth + half, halfDepth - half);
        body.aabbNeedsUpdate = true;
      });
      return getTuning();
    }

    function destroy() {
      bodies.forEach((body) => world.removeBody(body));
      staticBodies.forEach((body) => world.removeBody(body));
    }

    return {
      bodies,
      throwWithRandom: throwDice,
      throwWithSeed: (seed) => throwDice(seededRandom(seed)),
      beginGrab,
      updateGrabTarget,
      releaseGrab,
      step,
      isSettled,
      settleImmediately,
      setPose,
      snapshot,
      outcomes,
      setRestingPose,
      setTuning,
      getTuning,
      setThrowSettings,
      getThrowSettings,
      simulateSeed: function(seed) {
        throwDice(seededRandom(seed));
        settleImmediately();
        return outcomes();
      },
      getBounds: () => ({ halfWidth, halfDepth }),
      isGrabbing: () => Boolean(grabState),
      getElapsed: () => elapsed,
      destroy
    };
  }

  function createPhysicsAnimator(root, physics, renderer, callbacks) {
    const cb = callbacks || {};
    let frame = null;
    let running = false;
    let inView = false;
    let previousTime = null;
    let accumulator = 0;

    function render() {
      const dice = physics.snapshot();
      renderer.render(dice);
      if (cb.onFrame) cb.onFrame(dice);
    }

    function finish() {
      running = false;
      frame = null;
      previousTime = null;
      render();
      if (cb.onSettle) cb.onSettle(physics.outcomes());
    }

    function tick(timestamp) {
      frame = null;
      if (!running || !inView || document.hidden) return;
      if (previousTime === null) previousTime = timestamp;
      accumulator += Math.min(0.05, Math.max(0, (timestamp - previousTime) / 1000));
      previousTime = timestamp;
      while (accumulator >= 1 / 60) {
        physics.step();
        accumulator -= 1 / 60;
      }
      render();
      if (!physics.isGrabbing() && (physics.isSettled() || physics.getElapsed() > 8)) {
        if (!physics.isSettled()) physics.settleImmediately();
        finish();
      } else {
        frame = global.requestAnimationFrame(tick);
      }
    }

    function schedule() {
      if (running && inView && !document.hidden && frame === null) {
        previousTime = null;
        frame = global.requestAnimationFrame(tick);
      }
    }

    function start(interactive) {
      if (frame !== null) global.cancelAnimationFrame(frame);
      frame = null;
      running = true;
      previousTime = null;
      accumulator = 0;
      render();
      const reduceMotion = typeof cb.reduceMotion === "function"
        ? cb.reduceMotion()
        : prefersReducedMotion();
      if (reduceMotion && !interactive) {
        physics.settleImmediately();
        finish();
      } else {
        schedule();
      }
    }

    function stop() {
      if (frame !== null) global.cancelAnimationFrame(frame);
      frame = null;
      running = false;
      previousTime = null;
      accumulator = 0;
    }

    function handleVisibilityChange() {
      if (!document.hidden) schedule();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const observer = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          inView = Boolean(entries[0] && entries[0].isIntersecting);
          if (!inView && frame !== null) {
            global.cancelAnimationFrame(frame);
            frame = null;
          }
          schedule();
          if (cb.onFirstVisible && inView) cb.onFirstVisible();
        }, { threshold: 0.08 })
      : null;
    if (observer) observer.observe(root);
    else inView = true;

    function destroy() {
      if (frame !== null) global.cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    return {
      start,
      stop,
      render,
      schedule,
      isRunning: () => running,
      destroy
    };
  }

  function createButton(label, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "bc-button";
    button.textContent = label;
    return button;
  }

  const ROLLER_CAMERA = [0, 11, 0.01];
  const ROLLER_CAMERA_TARGET = [0, 0, 0];
  const ROLLER_CAMERA_UP = [0, 0, -1];
  const ROLLER_FIELD_OF_VIEW = 40;
  const ROLLER_ASPECT_RATIO = 12 / 5;
  const ROLLER_BORDER_INSET = 0.05;
  function rollerDieScale(numberOfDice) {
    // Preserve the current two-die size while following the original roller's
    // gradual scale reduction as more dice are added.
    return clamp(1.7533333333 - clamp(numberOfDice, 1, 5) / 15, 1.42, 1.69);
  }
  const ROLLER_ARENA_BOUNDS = planeBoundsForCamera(
    ROLLER_CAMERA,
    ROLLER_CAMERA_TARGET,
    ROLLER_CAMERA_UP,
    ROLLER_FIELD_OF_VIEW,
    ROLLER_ASPECT_RATIO,
    ROLLER_BORDER_INSET,
    0
  );

  const DICE_TUNING_SPECS = [
    { key: "gravity", label: "Gravity", min: 5, max: 60, step: 1 },
    { key: "mass", label: "Die mass", min: 0.25, max: 5, step: 0.25 },
    { key: "floorFriction", label: "Floor friction", min: 0, max: 0.8, step: 0.01 },
    { key: "wallFriction", label: "Wall friction", min: 0, max: 0.5, step: 0.005 },
    { key: "diceFriction", label: "Die-to-die friction", min: 0, max: 0.5, step: 0.01 },
    { key: "restitution", label: "Bounce", min: 0, max: 0.8, step: 0.01 },
    { key: "linearDamping", label: "Linear damping", min: 0, max: 0.3, step: 0.01 },
    { key: "angularDamping", label: "Angular damping", min: 0, max: 0.3, step: 0.01 },
    { key: "sleepSpeed", label: "Sleep threshold", min: 0.04, max: 0.5, step: 0.01 },
    { key: "throwStrength", label: "Throw strength", min: 0.5, max: 1.8, step: 0.05 },
    { key: "spinStrength", label: "Spin strength", min: 0, max: 2, step: 0.05 },
    { key: "releaseSpeedScale", label: "Release speed scale", min: 0.25, max: 3, step: 0.05 },
    { key: "releaseMinSpeed", label: "Release minimum speed", min: 0, max: 15, step: 0.5 },
    { key: "releaseMaxSpeed", label: "Release maximum speed", min: 4, max: 40, step: 1 },
    { key: "releaseLift", label: "Release lift", min: 0, max: 15, step: 0.1 },
    { key: "releaseSpinBoost", label: "Release spin boost", min: 0, max: 3, step: 0.05 },
    { key: "cameraHeight", label: "Camera height", min: 7, max: 16, step: 0.25 },
    { key: "cameraFov", label: "Camera field of view", min: 20, max: 70, step: 1 },
    { key: "shadowOpacity", label: "Shadow opacity", min: 0, max: 0.6, step: 0.02 },
    { key: "shadowOffsetX", label: "Shadow X direction", min: -0.5, max: 0.5, step: 0.02 },
    { key: "shadowOffsetZ", label: "Shadow Z direction", min: -0.5, max: 0.5, step: 0.02 },
    { key: "arenaWidth", label: "Arena width", min: 4, max: null, step: 0.1 },
    { key: "arenaDepth", label: "Arena depth", min: 4, max: null, step: 0.1 },
    { key: "wallOpacity", label: "Wall opacity", min: 0, max: 0.8, step: 0.05 }
  ];

  function diceDebugEnabled(options) {
    if (options && options.debug !== undefined) return Boolean(options.debug);
    try {
      return /^(1|true|yes)$/i.test(new URLSearchParams(global.location.search).get("diceDebug") || "");
    } catch (error) {
      return false;
    }
  }

  function createDiceTuningPanel(initialValues, onChange) {
    const details = document.createElement("details");
    details.className = "dice-tuning";
    details.open = true;
    details.dataset.testid = "dice-tuning";
    const summary = document.createElement("summary");
    summary.textContent = "Development physics controls";
    const grid = document.createElement("div");
    grid.className = "dice-tuning-grid";
    const inputs = new Map();
    const specs = DICE_TUNING_SPECS.map((spec) => {
      if (spec.key === "arenaWidth" || spec.key === "arenaDepth") {
        return Object.assign({}, spec, { max: initialValues[spec.key] });
      }
      return spec;
    });

    function decimalPlaces(step) {
      const text = String(step);
      return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
    }

    function setControl(spec, value, notify) {
      const control = inputs.get(spec.key);
      if (!control) return;
      const next = clamp(finiteNumber(value, initialValues[spec.key]), spec.min, spec.max);
      control.input.value = String(next);
      control.output.value = next.toFixed(decimalPlaces(spec.step));
      control.output.textContent = control.output.value;
      if (notify) onChange(spec.key, next);
    }

    specs.forEach((spec) => {
      const label = document.createElement("label");
      label.className = "dice-tuning-control";
      label.textContent = spec.label;
      const output = document.createElement("output");
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.dataset.tuningKey = spec.key;
      input.setAttribute("aria-label", spec.label);
      label.append(output, input);
      grid.append(label);
      inputs.set(spec.key, { input, output });
      setControl(spec, initialValues[spec.key], false);
      input.addEventListener("input", () => setControl(spec, input.value, true));
    });

    const actions = document.createElement("div");
    actions.className = "dice-tuning-actions";
    const note = document.createElement("span");
    note.className = "dice-tuning-note";
    note.textContent = "Shown only with ?diceDebug=1 or debug: true.";
    const reset = createButton("Reset tuning");
    reset.dataset.testid = "dice-tuning-reset";
    reset.addEventListener("click", () => {
      specs.forEach((spec) => setControl(spec, initialValues[spec.key], true));
    });
    actions.append(note, reset);
    details.append(summary, grid, actions);

    return {
      element: details,
      setValues: function(values, notify) {
        specs.forEach((spec) => {
          if (values[spec.key] !== undefined) setControl(spec, values[spec.key], Boolean(notify));
        });
      },
      setLimit: function(key, maximum, value, notify) {
        const spec = specs.find((candidate) => candidate.key === key);
        const control = inputs.get(key);
        if (!spec || !control) return;
        spec.max = maximum;
        control.input.max = String(maximum);
        setControl(spec, value, Boolean(notify));
      },
      values: function() {
        const values = {};
        specs.forEach((spec) => {
          values[spec.key] = finiteNumber(inputs.get(spec.key).input.value, initialValues[spec.key]);
        });
        return values;
      }
    };
  }

  // Ways to reach each sum with `diceCount` fair six-sided dice, by
  // convolution: ways[sum] for a single die is one for each of 1..6, and each
  // further die shifts and re-adds that. For two dice this reproduces the
  // familiar 6 - |sum - 7|; for one to five it is the same idea generalised,
  // which is what lets the overlay follow the dice-count control.
  const waysCache = new Map();
  function waysBySum(diceCount) {
    const key = clamp(Math.round(finiteNumber(diceCount, 2)), 1, 5);
    if (waysCache.has(key)) return waysCache.get(key);
    let ways = [1];
    for (let die = 0; die < key; die += 1) {
      const next = new Array(ways.length + 6).fill(0);
      for (let sum = 0; sum < ways.length; sum += 1) {
        const count = ways[sum];
        if (!count) continue;
        for (let face = 1; face <= 6; face += 1) next[sum + face] += count;
      }
      ways = next;
    }
    waysCache.set(key, ways);
    return ways;
  }

  function expectedCountsFor(diceCount, totalRolls) {
    const key = clamp(Math.round(finiteNumber(diceCount, 2)), 1, 5);
    const rolls = Math.max(0, finiteNumber(totalRolls, 0));
    const ways = waysBySum(key);
    const outcomes = Math.pow(6, key);
    const expected = new Array(key * 6 + 1).fill(0);
    for (let sum = key; sum <= key * 6; sum += 1) {
      expected[sum] = rolls * ways[sum] / outcomes;
    }
    return expected;
  }

  function probabilitiesFor(diceCount) {
    const key = clamp(Math.round(finiteNumber(diceCount, 2)), 1, 5);
    const ways = waysBySum(key);
    const outcomes = Math.pow(6, key);
    const probabilities = new Array(key * 6 + 1).fill(0);
    for (let sum = key; sum <= key * 6; sum += 1) {
      probabilities[sum] = ways[sum] / outcomes;
    }
    return probabilities;
  }

  function createHistogram(numberOfDice) {
    const diceCount = clamp(Math.round(finiteNumber(numberOfDice, 2)), 1, 5);
    const minimumSum = diceCount;
    const maximumSum = diceCount * 6;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("class", "dice-histogram bc-svg bc-graph");
    svg.setAttribute("viewBox", "0 0 660 185");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Histogram of the sums rolled with " + diceCount + (diceCount === 1 ? " die." : " dice."));
    const axis = document.createElementNS(namespace, "line");
    axis.setAttribute("class", "dice-histogram-axis");
    axis.setAttribute("x1", "30"); axis.setAttribute("x2", "640");
    axis.setAttribute("y1", "154"); axis.setAttribute("y2", "154");
    svg.append(axis);
    const marks = [];
    const numberOfSums = maximumSum - minimumSum + 1;
    const slotWidth = 610 / numberOfSums;
    const barWidth = Math.max(4, slotWidth * 0.76);
    for (let value = minimumSum; value <= maximumSum; value += 1) {
      const x = 30 + (value - minimumSum) * slotWidth + (slotWidth - barWidth) / 2;
      const bar = document.createElementNS(namespace, "rect");
      bar.setAttribute("class", "dice-histogram-bar bc-graph-bar");
      bar.setAttribute("x", String(x));
      bar.setAttribute("y", "154");
      bar.setAttribute("width", String(barWidth));
      bar.setAttribute("height", "0");
      const count = document.createElementNS(namespace, "text");
      count.setAttribute("class", "dice-histogram-count");
      count.setAttribute("x", String(x + barWidth / 2));
      count.setAttribute("y", "148");
      const label = document.createElementNS(namespace, "text");
      label.setAttribute("class", "dice-histogram-label");
      label.setAttribute("x", String(x + barWidth / 2));
      label.setAttribute("y", "174");
      label.textContent = String(value);
      svg.append(bar, count, label);
      marks.push({ value, bar, count, slotStart: 30 + (value - minimumSum) * slotWidth });
    }

    // Appended last so the outline rides on top of the bars: at a million
    // rolls it has to be readable sitting exactly along their tops.
    const expectedLayer = document.createElementNS(namespace, "g");
    expectedLayer.setAttribute("class", "dice-histogram-expected");
    const expectedShape = document.createElementNS(namespace, "path");
    expectedShape.setAttribute("class", "dice-histogram-expected-shape");
    expectedLayer.append(expectedShape);
    svg.append(expectedLayer);

    const baseLabel = svg.getAttribute("aria-label");

    function update(counts, current, options) {
      const settings = options || {};
      const expected = settings.expected || null;
      let max = Math.max(1, ...counts.slice(minimumSum, maximumSum + 1));
      if (expected) {
        // One shared scale, so "the bars sit on the line" is a fact about the
        // picture and not an artefact of two scales. Only the visible overlay
        // joins the scale, which leaves the bare figure's heights untouched.
        for (let value = minimumSum; value <= maximumSum; value += 1) {
          max = Math.max(max, expected[value] || 0);
        }
      }
      marks.forEach((mark) => {
        const value = counts[mark.value] || 0;
        const height = value / max * 124;
        mark.bar.setAttribute("y", String(154 - height));
        mark.bar.setAttribute("height", String(height));
        mark.bar.classList.toggle("is-current", mark.value === current);
        // Six- and seven-figure counts overrun their slot once a bulk fill
        // gets large; an unreadable pile of digits helps nobody, so the
        // number steps aside and the bar heights carry the comparison.
        const text = value ? value.toLocaleString() : "";
        mark.count.textContent = text.length * 6.1 <= slotWidth - 2 ? text : "";
        // Clear the outline too, so a count never lands on the dashes: where
        // theory runs above the bar, the number rides above theory.
        const clearance = expected
          ? Math.max(height, (expected[mark.value] || 0) / max * 124)
          : height;
        mark.count.setAttribute("y", String(Math.max(17, 148 - clearance)));
      });

      if (expected) {
        let path = "";
        marks.forEach((mark, index) => {
          const height = (expected[mark.value] || 0) / max * 124;
          const y = (154 - height).toFixed(2);
          path += (index === 0 ? "M" : "L") + mark.slotStart.toFixed(2) + " " + y +
            "L" + (mark.slotStart + slotWidth).toFixed(2) + " " + y;
        });
        expectedShape.setAttribute("d", path);
      }
      svg.dataset.denseCounts = String(marks.some(function(mark) {
        return String(counts[mark.value] || 0).length > 3;
      }));
      svg.setAttribute("aria-label", expected
        ? baseLabel + " The theoretical distribution is drawn over the bars as a dashed outline."
        : baseLabel);
    }

    function setExpectedInstant(instant) {
      expectedShape.classList.toggle("is-instant", Boolean(instant));
    }

    return { svg, update, expectedLayer, setExpectedInstant };
  }

  global.makeDiceCover = function(options) {
    const opts = options || {};
    const debugEnabled = diceDebugEnabled(opts);
    const outcomes = Array.isArray(opts.outcomes) && opts.outcomes.length >= 2
      ? opts.outcomes.slice(0, 2).map((value) => clamp(Math.round(Number(value) || 1), 1, 6))
      : [3, 4];
    let currentThrowSeed = Number.isFinite(Number(opts.throwSeed)) ? Math.trunc(Number(opts.throwSeed)) : 14;
    const dieScale = clamp(finiteNumber(opts.dieScale, 1.82), 1, 3);
    const coverCamera = Array.isArray(opts.camera) ? opts.camera : [0, 5.3, 8.6];
    const coverCameraTarget = Array.isArray(opts.cameraTarget) ? opts.cameraTarget : [0, 0.65, 0.25];
    const coverCameraUp = Array.isArray(opts.cameraUp) ? opts.cameraUp : [0, 1, 0];
    const coverFieldOfView = clamp(finiteNumber(opts.fieldOfView, 34), 1, 120);
    const coverThrowSettings = Object.assign({
      spread: 1.65,
      startHeight: 3.15,
      startDistance: 8,
      lateralSpeed: 1.1,
      lift: 0.35,
      forwardSpeed: 7.2
    }, opts.throwSettings || {});
    const coverPhysicsSettings = {
      gravity: clamp(finiteNumber(opts.gravity, 30), 5, 80),
      spinStrength: clamp(finiteNumber(opts.spinStrength, 1), 0, 2.5)
    };
    let debugFastForward = false;
    let candidateSeeds = [];
    let scanGeneration = 0;
    ensureStyles();

    const root = document.createElement("div");
    root.className = "dice-cover bc-figure bc-figure-cover";
    const stage = document.createElement("div");
    stage.className = "dice-cover-stage bc-chart-wrap";
    const canvas = document.createElement("canvas");
    canvas.className = "dice-cover-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Two oversized dice roll into view and settle on " + outcomes[0] + " and " + outcomes[1] + ".");
    const status = document.createElement("span");
    status.className = "dice-cover-status";
    status.setAttribute("aria-live", "polite");
    stage.append(canvas, status);
    root.append(stage);
    let seedInput = null;
    let seedResult = null;
    let previousSeedButton = null;
    let trySeedButton = null;
    let nextSeedButton = null;
    let fastForwardInput = null;
    let matchingOnlyInput = null;
    let scanFromInput = null;
    let scanToInput = null;
    let scanButton = null;
    let matchSelect = null;
    let scanStatus = null;
    const trajectoryInputs = new Map();
    const cameraInputs = new Map();
    if (debugEnabled) {
      const seedDebug = document.createElement("div");
      seedDebug.className = "dice-cover-seed-debug";
      seedDebug.dataset.testid = "dice-cover-seed-debug";
      const seedRow = document.createElement("div");
      seedRow.className = "dice-cover-seed-row";
      const seedLabel = document.createElement("label");
      seedLabel.textContent = "Cover throw seed";
      seedInput = document.createElement("input");
      seedInput.type = "number";
      seedInput.step = "1";
      seedInput.value = String(currentThrowSeed);
      seedInput.setAttribute("aria-label", "Cover throw seed");
      seedLabel.append(seedInput);
      previousSeedButton = createButton("← Previous seed");
      trySeedButton = createButton("Try seed");
      nextSeedButton = createButton("Next seed →");
      seedResult = document.createElement("output");
      seedResult.className = "dice-cover-seed-result";
      seedResult.textContent = "Result: waiting";
      const fastForwardLabel = document.createElement("label");
      fastForwardLabel.className = "dice-cover-check-label";
      fastForwardInput = document.createElement("input");
      fastForwardInput.type = "checkbox";
      fastForwardInput.setAttribute("aria-label", "Fast-forward cover rolls");
      fastForwardLabel.append(fastForwardInput, document.createTextNode("Fast-forward rolls"));
      seedRow.append(seedLabel, previousSeedButton, trySeedButton, nextSeedButton, fastForwardLabel, seedResult);

      const trajectoryDetails = document.createElement("details");
      trajectoryDetails.className = "dice-cover-dev-section";
      const trajectorySummary = document.createElement("summary");
      trajectorySummary.textContent = "Throw trajectory";
      const trajectoryGrid = document.createElement("div");
      trajectoryGrid.className = "dice-cover-dev-grid";
      const trajectorySpecs = [
        { key: "startDistance", label: "Start distance", min: 2, max: 14, step: 0.25, value: coverThrowSettings.startDistance },
        { key: "startHeight", label: "Start height", min: 1.2, max: 8, step: 0.1, value: coverThrowSettings.startHeight },
        { key: "forwardSpeed", label: "Forward speed", min: 1, max: 16, step: 0.1, value: coverThrowSettings.forwardSpeed },
        { key: "lift", label: "Upward lift", min: 0, max: 5, step: 0.1, value: coverThrowSettings.lift },
        { key: "lateralSpeed", label: "Inward speed", min: 0, max: 6, step: 0.1, value: coverThrowSettings.lateralSpeed },
        { key: "spread", label: "Starting spread", min: 0.5, max: 3.5, step: 0.1, value: coverThrowSettings.spread },
        { key: "gravity", label: "Gravity", min: 5, max: 80, step: 1, value: coverPhysicsSettings.gravity },
        { key: "spinStrength", label: "Spin", min: 0, max: 2.5, step: 0.05, value: coverPhysicsSettings.spinStrength }
      ];
      trajectorySpecs.forEach((spec) => {
        const label = document.createElement("label");
        label.textContent = spec.label;
        const output = document.createElement("output");
        output.textContent = String(spec.value);
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(spec.value);
        input.setAttribute("aria-label", spec.label);
        label.append(output, input);
        trajectoryGrid.append(label);
        trajectoryInputs.set(spec.key, { input, output });
      });
      trajectoryDetails.append(trajectorySummary, trajectoryGrid);

      const cameraDetails = document.createElement("details");
      cameraDetails.className = "dice-cover-dev-section";
      const cameraSummary = document.createElement("summary");
      cameraSummary.textContent = "Camera and framing";
      const cameraGrid = document.createElement("div");
      cameraGrid.className = "dice-cover-dev-grid";
      const cameraSpecs = [
        { key: "cameraX", label: "Camera X", min: -50, max: 50, step: 0.1, value: coverCamera[0] },
        { key: "cameraY", label: "Camera height", min: 0.5, max: 60, step: 0.1, value: coverCamera[1] },
        { key: "cameraZ", label: "Camera Z", min: -50, max: 75, step: 0.1, value: coverCamera[2] },
        { key: "targetX", label: "Look-at X", min: -30, max: 30, step: 0.1, value: coverCameraTarget[0] },
        { key: "targetY", label: "Look-at height", min: -30, max: 30, step: 0.1, value: coverCameraTarget[1] },
        { key: "targetZ", label: "Look-at Z", min: -30, max: 30, step: 0.1, value: coverCameraTarget[2] },
        { key: "fieldOfView", label: "Field of view", min: 1, max: 120, step: 0.5, value: coverFieldOfView }
      ];
      cameraSpecs.forEach((spec) => {
        const label = document.createElement("label");
        label.textContent = spec.label;
        const output = document.createElement("output");
        output.textContent = String(spec.value);
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(spec.value);
        input.setAttribute("aria-label", spec.label);
        label.append(output, input);
        cameraGrid.append(label);
        cameraInputs.set(spec.key, { input, output });
      });
      cameraDetails.append(cameraSummary, cameraGrid);

      const scanRow = document.createElement("div");
      scanRow.className = "dice-cover-seed-scan dice-cover-dev-section";
      const scanFromLabel = document.createElement("label");
      scanFromLabel.textContent = "Scan from";
      scanFromInput = document.createElement("input");
      scanFromInput.type = "number";
      scanFromInput.step = "1";
      scanFromInput.value = "0";
      scanFromLabel.append(scanFromInput);
      const scanToLabel = document.createElement("label");
      scanToLabel.textContent = "through";
      scanToInput = document.createElement("input");
      scanToInput.type = "number";
      scanToInput.step = "1";
      scanToInput.value = "1000";
      scanToLabel.append(scanToInput);
      scanButton = createButton(
        "Find " + outcomes[0] + " & " + outcomes[1] + " seeds (either order)"
      );
      matchingOnlyInput = document.createElement("input");
      matchingOnlyInput.type = "checkbox";
      matchingOnlyInput.disabled = true;
      const matchingOnlyLabel = document.createElement("label");
      matchingOnlyLabel.className = "dice-cover-check-label";
      matchingOnlyLabel.append(matchingOnlyInput, document.createTextNode("Previous/next use matches"));
      matchSelect = document.createElement("select");
      matchSelect.setAttribute("aria-label", "Matching cover seeds");
      matchSelect.disabled = true;
      const emptyOption = document.createElement("option");
      emptyOption.textContent = "No scan yet";
      matchSelect.append(emptyOption);
      scanStatus = document.createElement("output");
      scanStatus.className = "dice-cover-seed-result";
      scanStatus.textContent = "Matches are exhaustive within the chosen range.";
      scanRow.append(scanFromLabel, scanToLabel, scanButton, matchingOnlyLabel, matchSelect, scanStatus);

      seedDebug.append(seedRow, trajectoryDetails, cameraDetails, scanRow);
      root.append(seedDebug);
    }
    root.value = {
      outcomes: outcomes.slice(),
      sum: outcomes[0] + outcomes[1],
      settled: false,
      seed: currentThrowSeed
    };

    let renderer;
    let physics;
    try {
      renderer = createRenderer(canvas, {
        dieScale,
        camera: coverCamera,
        cameraTarget: coverCameraTarget,
        cameraUp: coverCameraUp,
        fieldOfView: coverFieldOfView,
        shadowMode: opts.shadowMode || "map",
        shadowMapSize: opts.shadowMapSize,
        shadowOpacity: opts.shadowOpacity,
        shadowOffsetX: opts.shadowOffsetX,
        shadowOffsetZ: opts.shadowOffsetZ,
        shadowSoftness: opts.shadowSoftness,
        shadowBias: opts.shadowBias
      });
      physics = createDicePhysics(2, {
        dieScale,
        halfWidth: clamp(finiteNumber(opts.arenaWidth, 9), dieScale * 2.4, 20) / 2,
        halfDepth: clamp(finiteNumber(opts.arenaDepth, 20), dieScale * 2.4, 24) / 2,
        throwProfile: opts.throwProfile || "approach",
        throwSettings: coverThrowSettings,
        gravity: coverPhysicsSettings.gravity,
        spinStrength: coverPhysicsSettings.spinStrength
      });
    } catch (error) {
      console.warn(error);
      root.classList.add("dice-cover-no-webgl");
      status.textContent = "Dice showing " + outcomes[0] + " and " + outcomes[1] + ", totaling " + (outcomes[0] + outcomes[1]) + ".";
      return root;
    }

    let hasStarted = false;
    function commitSettledOutcome(actualOutcomes, dispatch) {
      const sum = actualOutcomes.reduce((total, value) => total + value, 0);
      root.value = { outcomes: actualOutcomes, sum, settled: true, seed: currentThrowSeed };
      status.textContent = "Dice settled on " + actualOutcomes[0] + " and " + actualOutcomes[1] + ", totaling " + sum + ".";
      if (seedResult) seedResult.textContent = "Result: " + actualOutcomes.join(" + ") + " = " + sum;
      if (!debugEnabled && (actualOutcomes[0] !== outcomes[0] || actualOutcomes[1] !== outcomes[1])) {
        console.warn("The stored dice-cover throw produced an unexpected outcome.", actualOutcomes);
      }
      if (dispatch) root.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const animator = createPhysicsAnimator(root, physics, renderer, {
      onSettle: function(actualOutcomes) {
        commitSettledOutcome(actualOutcomes, true);
        renderer.releaseShadowMap();
      },
      reduceMotion: function() {
        return debugFastForward || prefersReducedMotion();
      },
      onFirstVisible: function() {
        if (!hasStarted) play();
      }
    });

    function play() {
      hasStarted = true;
      physics.throwWithSeed(currentThrowSeed);
      root.value = {
        outcomes: outcomes.slice(),
        sum: outcomes[0] + outcomes[1],
        settled: false,
        seed: currentThrowSeed
      };
      status.textContent = "Dice rolling.";
      if (seedInput) seedInput.value = String(currentThrowSeed);
      if (seedResult) seedResult.textContent = "Result: rolling…";
      animator.start();
    }

    function selectSeed(value) {
      currentThrowSeed = Math.trunc(finiteNumber(value, currentThrowSeed));
      if (matchSelect && candidateSeeds.includes(currentThrowSeed)) {
        matchSelect.value = String(currentThrowSeed);
      }
      play();
      return currentThrowSeed;
    }

    function invalidateCandidates(message) {
      scanGeneration += 1;
      candidateSeeds = [];
      if (!debugEnabled) return;
      matchingOnlyInput.checked = false;
      matchingOnlyInput.disabled = true;
      matchSelect.disabled = true;
      matchSelect.replaceChildren();
      const option = document.createElement("option");
      option.textContent = "No current matches";
      matchSelect.append(option);
      scanStatus.textContent = message || "Trajectory changed; scan again.";
    }

    function selectAdjacentSeed(direction) {
      if (matchingOnlyInput && matchingOnlyInput.checked && candidateSeeds.length) {
        let index = candidateSeeds.indexOf(currentThrowSeed);
        if (index < 0) index = direction > 0 ? -1 : 0;
        index = (index + direction + candidateSeeds.length) % candidateSeeds.length;
        return selectSeed(candidateSeeds[index]);
      }
      return selectSeed(currentThrowSeed + direction);
    }

    function updateCandidateControls(matches, from, to) {
      candidateSeeds = matches.slice();
      matchSelect.replaceChildren();
      if (!matches.length) {
        const option = document.createElement("option");
        option.textContent = "No matches";
        matchSelect.append(option);
        matchSelect.disabled = true;
        matchingOnlyInput.checked = false;
        matchingOnlyInput.disabled = true;
      } else {
        matches.forEach((seed) => {
          const option = document.createElement("option");
          option.value = String(seed);
          option.textContent = "Seed " + seed;
          matchSelect.append(option);
        });
        matchSelect.disabled = false;
        matchingOnlyInput.disabled = false;
        matchingOnlyInput.checked = true;
        const currentIndex = matches.indexOf(currentThrowSeed);
        if (currentIndex >= 0) {
          matchSelect.value = String(currentThrowSeed);
        } else {
          const prompt = document.createElement("option");
          prompt.value = "";
          prompt.textContent = "Choose a matching seed";
          prompt.selected = true;
          matchSelect.prepend(prompt);
        }
      }
      scanStatus.textContent = matches.length + " matching seed" + (matches.length === 1 ? "" : "s") + " from " + from + " through " + to + ".";
    }

    async function findMatchingSeeds(fromValue, toValue) {
      if (!debugEnabled) return [];
      const from = clamp(Math.trunc(finiteNumber(fromValue, 0)), 0, 1000000);
      const requestedTo = clamp(Math.trunc(finiteNumber(toValue, 1000)), 0, 1000000);
      const to = Math.max(from, Math.min(requestedTo, from + 4999));
      scanFromInput.value = String(from);
      scanToInput.value = String(to);
      const generation = ++scanGeneration;
      const restoreSeed = currentThrowSeed;
      const matches = [];
      animator.stop();
      scanButton.disabled = true;
      scanStatus.textContent = "Scanning…";
      for (let seed = from; seed <= to; seed += 1) {
        const result = physics.simulateSeed(seed);
        const matchesForward = result[0] === outcomes[0] && result[1] === outcomes[1];
        const matchesReverse = result[0] === outcomes[1] && result[1] === outcomes[0];
        if (matchesForward || matchesReverse) matches.push(seed);
        if ((seed - from) % 25 === 24) {
          if (generation !== scanGeneration) {
            scanButton.disabled = false;
            return [];
          }
          scanStatus.textContent = "Scanning… " + seed + " / " + to;
          await new Promise((resolve) => global.setTimeout(resolve, 0));
        }
      }
      if (generation !== scanGeneration) {
        scanButton.disabled = false;
        return [];
      }
      currentThrowSeed = restoreSeed;
      const restoredOutcomes = physics.simulateSeed(currentThrowSeed);
      animator.render();
      commitSettledOutcome(restoredOutcomes, false);
      renderer.releaseShadowMap();
      updateCandidateControls(matches, from, to);
      scanButton.disabled = false;
      return matches.slice();
    }

    if (debugEnabled) {
      previousSeedButton.addEventListener("click", () => selectAdjacentSeed(-1));
      trySeedButton.addEventListener("click", () => selectSeed(seedInput.value));
      nextSeedButton.addEventListener("click", () => selectAdjacentSeed(1));
      seedInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") selectSeed(seedInput.value);
      });
      fastForwardInput.addEventListener("change", () => {
        debugFastForward = fastForwardInput.checked;
      });
      scanButton.addEventListener("click", () => {
        findMatchingSeeds(scanFromInput.value, scanToInput.value).catch((error) => {
          console.warn("The cover seed scan failed.", error);
          scanStatus.textContent = "Seed scan failed.";
          scanButton.disabled = false;
        });
      });
      matchSelect.addEventListener("change", () => selectSeed(matchSelect.value));
      trajectoryInputs.forEach((control, key) => {
        control.input.addEventListener("input", () => {
          const value = finiteNumber(control.input.value, 0);
          control.output.textContent = String(value);
          if (key === "gravity" || key === "spinStrength") {
            physics.setTuning({ [key]: value });
          } else {
            physics.setThrowSettings({ [key]: value });
          }
          invalidateCandidates("Trajectory changed; scan again.");
        });
      });
      cameraInputs.forEach((control) => {
        control.input.addEventListener("input", () => {
          control.output.textContent = control.input.value;
          renderer.setCameraOptions({
            position: [
              finiteNumber(cameraInputs.get("cameraX").input.value, 0),
              finiteNumber(cameraInputs.get("cameraY").input.value, 5.3),
              finiteNumber(cameraInputs.get("cameraZ").input.value, 8.6)
            ],
            target: [
              finiteNumber(cameraInputs.get("targetX").input.value, 0),
              finiteNumber(cameraInputs.get("targetY").input.value, 0.65),
              finiteNumber(cameraInputs.get("targetZ").input.value, 0.25)
            ],
            fieldOfView: finiteNumber(cameraInputs.get("fieldOfView").input.value, 34)
          });
          animator.render();
          if (root.value.settled) renderer.releaseShadowMap();
        });
      });
    }
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(function() {
          renderer.resize();
          animator.render();
          if (root.value.settled) renderer.releaseShadowMap();
        })
      : null;
    if (resizeObserver) resizeObserver.observe(stage);

    physics.throwWithSeed(currentThrowSeed);
    animator.render();

    root.destroy = function() {
      if (resizeObserver) resizeObserver.disconnect();
      animator.destroy();
      physics.destroy();
      renderer.destroy();
    };
    root.setShadowMode = function(mode) {
      const activeMode = renderer.setShadowMode(mode);
      animator.render();
      if (root.value.settled) renderer.releaseShadowMap();
      return activeMode;
    };
    root.hasShadowMapResources = function() {
      return renderer.hasShadowMapResources();
    };
    if (debugEnabled) {
      root.diceCoverDebug = {
        get: function() {
          return {
            seed: currentThrowSeed,
            value: Object.assign({}, root.value),
            fastForward: debugFastForward,
            candidates: candidateSeeds.slice(),
            throwSettings: physics.getThrowSettings(),
            physics: physics.getTuning(),
            camera: renderer.getCameraOptions()
          };
        },
        setSeed: selectSeed,
        previous: function() {
          return selectAdjacentSeed(-1);
        },
        next: function() {
          return selectAdjacentSeed(1);
        },
        replay: play,
        setFastForward: function(value) {
          debugFastForward = Boolean(value);
          fastForwardInput.checked = debugFastForward;
          return debugFastForward;
        },
        findMatchingSeeds,
        setThrowSettings: function(values) {
          const next = values || {};
          Object.keys(next).forEach((key) => {
            const control = trajectoryInputs.get(key);
            if (control) {
              control.input.value = String(next[key]);
              control.output.textContent = control.input.value;
            }
          });
          if (next.gravity !== undefined || next.spinStrength !== undefined) physics.setTuning(next);
          physics.setThrowSettings(next);
          invalidateCandidates("Trajectory changed; scan again.");
          return physics.getThrowSettings();
        },
        setCamera: function(values) {
          const next = values || {};
          const applied = renderer.setCameraOptions(next);
          const mappedValues = {
            cameraX: applied.position[0], cameraY: applied.position[1], cameraZ: applied.position[2],
            targetX: applied.target[0], targetY: applied.target[1], targetZ: applied.target[2],
            fieldOfView: applied.fieldOfView
          };
          Object.keys(mappedValues).forEach((key) => {
            const control = cameraInputs.get(key);
            control.input.value = String(mappedValues[key]);
            control.output.textContent = control.input.value;
          });
          animator.render();
          if (root.value.settled) renderer.releaseShadowMap();
          return applied;
        }
      };
    }
    return root;
  };

  global.makeDiceRoller = function(options) {
    const opts = options || {};
    const debugEnabled = diceDebugEnabled(opts);
    let numberOfDice = clamp(Math.round(finiteNumber(opts.numberOfDice, 2)), 1, 5);
    const debugDefaults = {
      // Like-for-like values from the original cannon-es implementation.
      gravity: 55,
      mass: 1,
      floorFriction: 0.08,
      wallFriction: 0.05,
      diceFriction: 0.02,
      restitution: 0.3,
      linearDamping: 0.01,
      angularDamping: 0.01,
      sleepSpeed: 0.1,
      throwStrength: 1,
      spinStrength: 1.35,
      releaseSpeedScale: 1.7,
      releaseMinSpeed: 3.5,
      releaseMaxSpeed: 40,
      releaseLift: 6.3,
      releaseSpinBoost: 1.6,
      cameraHeight: ROLLER_CAMERA[1],
      cameraFov: ROLLER_FIELD_OF_VIEW,
      shadowOpacity: 0.08,
      shadowOffsetX: -0.22,
      shadowOffsetZ: 0,
      arenaWidth: 12.4,
      arenaDepth: 7.2,
      wallOpacity: 0.1
    };
    const debugValues = Object.assign({}, debugDefaults);
    ensureStyles();
    const root = document.createElement("div");
    root.className = "dice-roller bc-figure";
    const controls = document.createElement("div");
    controls.className = "dice-roller-controls";
    // The buttons live in their own row so the outer element can become the
    // shared drawer inside a callout: .bc-if-controls paints its vertical
    // padding with block pseudo-rows, which a flex container would collapse.
    const actionRow = document.createElement("div");
    actionRow.className = "dice-roller-actions bc-action-row";
    controls.append(actionRow);
    const rollButton = createButton("Roll dice");
    const add100Button = createButton("+100 rolls");
    const add1000Button = createButton("+1,000 rolls");
    const resetButton = createButton("Reset");
    const diceCountLabel = document.createElement("label");
    diceCountLabel.className = "dice-count-control";
    diceCountLabel.append(document.createTextNode("Dice "));
    const diceCountSelect = document.createElement("select");
    diceCountSelect.setAttribute("aria-label", "Number of dice");
    for (let count = 1; count <= 5; count += 1) {
      const option = document.createElement("option");
      option.value = String(count);
      option.textContent = String(count);
      option.selected = count === numberOfDice;
      diceCountSelect.append(option);
    }
    diceCountLabel.append(diceCountSelect);
    actionRow.append(rollButton, add100Button, add1000Button, diceCountLabel, resetButton);

    const stage = document.createElement("div");
    stage.className = "dice-roller-stage bc-chart-wrap";
    const canvas = document.createElement("canvas");
    canvas.className = "dice-roller-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", numberOfDice + (numberOfDice === 1 ? " physically simulated die" : " physically simulated dice") + " viewed from above.");
    let grabHandles = [];
    const wallDebug = debugEnabled ? document.createElement("div") : null;
    if (wallDebug) {
      wallDebug.className = "dice-wall-debug";
      wallDebug.dataset.testid = "dice-wall-debug";
      wallDebug.setAttribute("aria-hidden", "true");
      wallDebug.hidden = true;
      wallDebug.style.opacity = String(debugValues.wallOpacity);
      stage.append(canvas, wallDebug);
    } else {
      stage.append(canvas);
    }

    const readout = document.createElement("div");
    readout.className = "dice-roller-readout";
    const resultNode = document.createElement("span");
    resultNode.className = "dice-roller-result";
    resultNode.setAttribute("aria-live", "polite");
    resultNode.textContent = "Ready to roll";
    const countNode = document.createElement("span");
    countNode.textContent = "Rolls: 0";
    readout.append(resultNode, countNode);

    let histogram = createHistogram(numberOfDice);
    const histogramWrap = document.createElement("div");
    histogramWrap.className = "dice-histogram-wrap bc-chart-wrap";
    histogramWrap.append(histogram.svg);
    // The overlay's key is HTML rather than SVG text so it holds the book's
    // figure-note size on a phone instead of being scaled by the viewBox.
    const expectedLegend = document.createElement("p");
    expectedLegend.className = "dice-histogram-legend";
    const expectedSwatch = document.createElement("span");
    expectedSwatch.className = "dice-histogram-legend-swatch";
    expectedSwatch.setAttribute("aria-hidden", "true");
    const expectedLegendText = document.createElement("span");
    expectedLegend.append(expectedSwatch, expectedLegendText);
    expectedLegend.hidden = true;
    let tuningPanel = null;
    if (debugEnabled) {
      tuningPanel = createDiceTuningPanel(debugDefaults, applyTuningChange);
      root.append(controls, tuningPanel.element, stage, readout, histogramWrap, expectedLegend);
    } else {
      root.append(controls, stage, readout, histogramWrap, expectedLegend);
    }

    let counts = Array(numberOfDice * 6 + 1).fill(0);
    const seed = opts.seed || "probability-dice-v1";
    const physicsRandom = seededRandom(seed + "-physics");
    let bulkRandom = seededRandom(seed + "-bulk");
    const batchPoseRandom = seededRandom(seed + "-batch-poses");
    // Rolls drawn from the current bulk stream, in order. While it equals the
    // total, the histogram *is* the first `totalRolls` draws of the seed, so
    // an absolute "rolls" step can top it up; once anything else has landed
    // in the counts the stream is reseeded and the whole picture rebuilt.
    let bulkDrawn = 0;
    let streamPure = true;
    let showExpected = opts.showExpected === true;
    let animateBulkLimit = Math.max(0, finiteNumber(opts.animateBulkLimit, 1000));
    let forceImmediateRoll = false;
    let totalRolls = 0;
    let lastOutcomes = [];
    let currentSum = null;
    // Which bar wears the "just rolled" accent. It tracks currentSum only
    // while the dice are actually showing that roll: after an unwatched bulk
    // fill nothing on screen corresponds to it, and a red bar in the middle
    // of a converged histogram is a distraction, not a reading.
    let highlightSum = null;
    let renderer = null;
    let physics = null;
    let animator = null;
    let resizeObserver = null;
    let initialized = false;
    let initializationFailed = false;
    let activeGrab = null;
    let batchAnimation = null;
    let arenaMaximums = {
      width: ROLLER_ARENA_BOUNDS.width,
      depth: ROLLER_ARENA_BOUNDS.depth
    };

    function rebuildGrabHandles() {
      grabHandles.forEach((handle) => handle.remove());
      grabHandles = Array.from({ length: numberOfDice }, (_, index) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "dice-grab-handle";
        handle.dataset.dieIndex = String(index);
        handle.setAttribute("aria-label", "Pick up and throw die " + (index + 1));
        handle.title = "Drag to pick up and throw all dice";
        handle.addEventListener("pointerdown", (event) => beginPointerGrab(index, event));
        handle.addEventListener("lostpointercapture", endPointerGrab);
        handle.addEventListener("dragstart", (event) => event.preventDefault());
        handle.addEventListener("click", (event) => {
          event.preventDefault();
          if (event.detail === 0) roll();
        });
        stage.append(handle);
        return handle;
      });
    }

    function updateWallDebug() {
      if (!wallDebug || !renderer || !physics) return;
      const bounds = physics.getBounds();
      const corners = [
        renderer.projectPoint([-bounds.halfWidth, 0, -bounds.halfDepth]),
        renderer.projectPoint([bounds.halfWidth, 0, -bounds.halfDepth]),
        renderer.projectPoint([bounds.halfWidth, 0, bounds.halfDepth]),
        renderer.projectPoint([-bounds.halfWidth, 0, bounds.halfDepth])
      ];
      if (corners.some((corner) => !corner)) {
        wallDebug.hidden = true;
        return;
      }
      const xs = corners.map((corner) => corner.x);
      const ys = corners.map((corner) => corner.y);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      wallDebug.hidden = false;
      wallDebug.style.left = left + "px";
      wallDebug.style.top = top + "px";
      wallDebug.style.width = Math.max(1, Math.max(...xs) - left) + "px";
      wallDebug.style.height = Math.max(1, Math.max(...ys) - top) + "px";
      wallDebug.style.opacity = String(debugValues.wallOpacity);
    }

    function applyTuningChange(key, value) {
      debugValues[key] = value;
      if (key === "cameraHeight" || key === "cameraFov") {
        const widthFraction = clamp(debugValues.arenaWidth / arenaMaximums.width, 0, 1);
        const depthFraction = clamp(debugValues.arenaDepth / arenaMaximums.depth, 0, 1);
        if (renderer) {
          renderer.setCameraOptions({
            position: [ROLLER_CAMERA[0], debugValues.cameraHeight, ROLLER_CAMERA[2]],
            fieldOfView: debugValues.cameraFov
          });
        }
        const nextBounds = renderer
          ? renderer.planeBoundsAtInset(ROLLER_BORDER_INSET, 0)
          : planeBoundsForCamera(
              [ROLLER_CAMERA[0], debugValues.cameraHeight, ROLLER_CAMERA[2]],
              ROLLER_CAMERA_TARGET,
              ROLLER_CAMERA_UP,
              debugValues.cameraFov,
              ROLLER_ASPECT_RATIO,
              ROLLER_BORDER_INSET,
              0
            );
        arenaMaximums = nextBounds;
        if (tuningPanel) {
          tuningPanel.setLimit("arenaWidth", nextBounds.width, nextBounds.width * widthFraction, true);
          tuningPanel.setLimit("arenaDepth", nextBounds.depth, nextBounds.depth * depthFraction, true);
        }
      } else if (key === "shadowOpacity" || key === "shadowOffsetX" || key === "shadowOffsetZ") {
        if (renderer) {
          renderer.setShadowOptions({
            opacity: debugValues.shadowOpacity,
            offsetX: debugValues.shadowOffsetX,
            offsetZ: debugValues.shadowOffsetZ
          });
        }
      } else if (physics && key !== "wallOpacity") {
        physics.setTuning({ [key]: value });
      }
      updateWallDebug();
      if (animator) animator.render();
    }

    function setValue(rolling) {
      const expected = expectedCountsFor(numberOfDice, totalRolls);
      let worstSum = null;
      let worstGap = 0;
      for (let sum = numberOfDice; sum <= numberOfDice * 6; sum += 1) {
        const gap = (counts[sum] || 0) - expected[sum];
        if (worstSum === null || Math.abs(gap) > Math.abs(worstGap)) {
          worstSum = sum;
          worstGap = gap;
        }
      }
      root.value = {
        numberOfDice,
        counts: counts.slice(),
        rolls: totalRolls,
        outcomes: lastOutcomes.slice(),
        sum: currentSum,
        rolling: Boolean(rolling),
        // Added for the tutorial and prose; the fields above keep their names
        // and meanings so existing bindings are unaffected.
        minimumSum: numberOfDice,
        maximumSum: numberOfDice * 6,
        expected,
        probabilities: probabilitiesFor(numberOfDice),
        showExpected,
        worstSum,
        worstGap
      };
    }

    function updateChart() {
      histogram.update(counts, highlightSum, {
        expected: showExpected ? expectedCountsFor(numberOfDice, totalRolls) : null
      });
      countNode.textContent = "Rolls: " + totalRolls.toLocaleString();
    }

    function addOutcome(outcomesToAdd, announce) {
      const sum = outcomesToAdd.reduce((total, value) => total + value, 0);
      counts[sum] += 1;
      totalRolls += 1;
      lastOutcomes = outcomesToAdd.slice();
      currentSum = sum;
      highlightSum = sum;
      if (announce) resultNode.textContent = outcomesToAdd.join(" + ") + " = " + sum;
    }

    function updateButtons(rolling) {
      rollButton.disabled = rolling || initializationFailed;
      add100Button.disabled = rolling;
      add1000Button.disabled = rolling;
      diceCountSelect.disabled = rolling || initializationFailed;
    }

    function randomBetween(random, minimum, maximum) {
      return minimum + (maximum - minimum) * random();
    }

    function makeBatchSnapshot(outcomesToAdd) {
      if (!physics) return null;
      const dieScale = rollerDieScale(numberOfDice);
      const half = dieScale / 2;
      const bounds = physics.getBounds();
      const maximumPlacementMargin = Math.max(half * 1.08, Math.min(bounds.halfWidth, bounds.halfDepth) - 0.02);
      const placementMargin = Math.min(dieScale * 1.25, maximumPlacementMargin);
      const minimumX = -bounds.halfWidth + placementMargin;
      const maximumX = bounds.halfWidth - placementMargin;
      const minimumZ = -bounds.halfDepth + placementMargin;
      const maximumZ = bounds.halfDepth - placementMargin;
      const minimumSeparation = dieScale * 1.1;
      const positions = [];

      outcomesToAdd.forEach((value, index) => {
        let position = null;
        for (let attempt = 0; attempt < 48 && !position; attempt += 1) {
          const candidate = [
            randomBetween(batchPoseRandom, minimumX, maximumX),
            half + 0.002,
            randomBetween(batchPoseRandom, minimumZ, maximumZ)
          ];
          if (positions.every((other) => {
            return Math.hypot(candidate[0] - other[0], candidate[2] - other[2]) >= minimumSeparation;
          })) {
            position = candidate;
          }
        }
        if (!position) {
          const columns = Math.min(3, Math.ceil(Math.sqrt(outcomesToAdd.length)));
          const row = Math.floor(index / columns);
          const column = index % columns;
          const spacing = dieScale * 1.16;
          position = [
            clamp((column - (columns - 1) / 2) * spacing, minimumX, maximumX),
            half + 0.002,
            clamp((row - (Math.ceil(outcomesToAdd.length / columns) - 1) / 2) * spacing, minimumZ, maximumZ)
          ];
        }
        positions.push(position);
      });

      return outcomesToAdd.map((value, index) => {
        const position = positions[index];
        const quaternion = restingQuaternion(value, batchPoseRandom() * Math.PI * 2);
        return {
          position,
          quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
          pipColor: DICE_PIP_COLORS[index % DICE_PIP_COLORS.length]
        };
      });
    }

    function batchIsVisible() {
      if (document.hidden) return false;
      const rect = root.getBoundingClientRect();
      const height = global.innerHeight || document.documentElement.clientHeight || 0;
      const width = global.innerWidth || document.documentElement.clientWidth || 0;
      return rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
    }

    function dispatchRollerValue() {
      root.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function renderBatchSnapshot(state) {
      if (!state.lastSnapshot || !renderer || !physics) return;
      physics.setPose(state.lastSnapshot);
      renderer.render(state.lastSnapshot);
      updateGrabHandles(state.lastSnapshot);
      updateWallDebug();
    }

    function finishBatch(state, finishImmediately) {
      if (!state || batchAnimation !== state) return;
      if (state.frame !== null) global.cancelAnimationFrame(state.frame);
      state.frame = null;
      if (finishImmediately) {
        while (state.processed < state.total) {
          const outcomesToAdd = Array.from({ length: numberOfDice }, () => 1 + Math.floor(bulkRandom() * 6));
          addOutcome(outcomesToAdd, false);
          state.processed += 1;
          state.lastOutcomes = outcomesToAdd;
        }
      }
      batchAnimation = null;
      if (state.lastSnapshot && physics) {
        physics.setPose(state.lastSnapshot);
        if (!finishImmediately && renderer) renderBatchSnapshot(state);
      }
      resultNode.textContent = state.total.toLocaleString() + " simulated rolls added";
      updateButtons(false);
      updateChart();
      setValue(false);
      dispatchRollerValue();
    }

    function cancelBatch() {
      if (!batchAnimation) return false;
      const state = batchAnimation;
      finishBatch(state, false);
      return true;
    }

    function scheduleBatchFrame() {
      if (batchAnimation && batchAnimation.frame === null) {
        batchAnimation.frame = global.requestAnimationFrame(runBatchFrame);
      }
    }

    function runBatchFrame(timestamp) {
      const state = batchAnimation;
      if (!state) return;
      state.frame = null;
      if (!batchIsVisible()) {
        finishBatch(state, true);
        return;
      }
      const now = Number(timestamp) || performance.now();
      if (now - state.nextAt > state.interval * 4) state.nextAt = now;
      const maximumPerFrame = state.total <= 100 ? 1 : 8;
      let produced = 0;
      while (state.processed < state.total && now + 0.5 >= state.nextAt && produced < maximumPerFrame) {
        const outcomesToAdd = Array.from({ length: numberOfDice }, () => 1 + Math.floor(bulkRandom() * 6));
        addOutcome(outcomesToAdd, false);
        state.processed += 1;
        state.lastOutcomes = outcomesToAdd;
        state.lastSnapshot = makeBatchSnapshot(outcomesToAdd);
        state.nextAt += state.interval;
        produced += 1;
      }
      if (produced > 0) {
        renderBatchSnapshot(state);
        updateChart();
        setValue(true);
        if (state.processed === state.total || now - state.lastAnnouncement >= 400) {
          resultNode.textContent = state.processed.toLocaleString() + " / " + state.total.toLocaleString() + " rolls…";
          state.lastAnnouncement = now;
        }
        if (state.processed === state.total || now - state.lastDispatch >= 100) {
          dispatchRollerValue();
          state.lastDispatch = now;
        }
      }
      if (state.processed >= state.total) finishBatch(state, false);
      else scheduleBatchFrame();
    }

    function updateGrabHandles(dice) {
      if (!renderer || !dice) return;
      dice.forEach((die, index) => {
        const handle = grabHandles[index];
        const projected = renderer.projectPoint(die.position);
        if (!projected) {
          handle.hidden = true;
          return;
        }
        const size = renderer.projectedDieSize(die.position);
        handle.hidden = false;
        handle.style.left = projected.x + "px";
        handle.style.top = projected.y + "px";
        handle.style.width = size + "px";
        handle.style.height = size + "px";
      });
    }

    function rebuildPhysics() {
      if (!renderer) return;
      if (animator) animator.destroy();
      if (physics) physics.destroy();
      activeGrab = null;
      const activeDieScale = rollerDieScale(numberOfDice);
      renderer.setDieScale(activeDieScale);
      physics = createDicePhysics(numberOfDice, {
        dieScale: activeDieScale,
        halfWidth: debugValues.arenaWidth / 2,
        halfDepth: debugValues.arenaDepth / 2
      });
      physics.setTuning(debugValues);
      animator = createPhysicsAnimator(root, physics, renderer, {
        reduceMotion: function() {
          return forceImmediateRoll || prefersReducedMotion();
        },
        onSettle: function(actualOutcomes) {
          addOutcome(actualOutcomes, true);
          // A thrown roll is not part of the bulk stream, so the counts are
          // no longer a prefix of it.
          streamPure = false;
          updateButtons(false);
          updateChart();
          setValue(false);
          root.dispatchEvent(new Event("input", { bubbles: true }));
        },
        onFrame: function(dice) {
          updateGrabHandles(dice);
          updateWallDebug();
        }
      });
      physics.setRestingPose();
      animator.render();
      updateWallDebug();
    }

    function initialize() {
      if (initialized) return true;
      if (initializationFailed) return false;
      try {
        renderer = createRenderer(canvas, {
          dieScale: rollerDieScale(numberOfDice),
          camera: [ROLLER_CAMERA[0], debugValues.cameraHeight, ROLLER_CAMERA[2]],
          cameraTarget: ROLLER_CAMERA_TARGET,
          cameraUp: ROLLER_CAMERA_UP,
          fieldOfView: debugValues.cameraFov,
          shadowMode: opts.shadowMode || "map",
          shadowMapSize: opts.shadowMapSize,
          shadowOpacity: debugValues.shadowOpacity,
          shadowOffsetX: debugValues.shadowOffsetX,
          shadowOffsetZ: debugValues.shadowOffsetZ,
          shadowSoftness: opts.shadowSoftness,
          shadowBias: opts.shadowBias
        });
        rebuildPhysics();
        resizeObserver = typeof ResizeObserver === "function"
          ? new ResizeObserver(function() {
              renderer.resize();
              animator.render();
              updateWallDebug();
            })
          : null;
        if (resizeObserver) resizeObserver.observe(stage);
        initialized = true;
        return true;
      } catch (error) {
        console.warn(error);
        initializationFailed = true;
        resultNode.textContent = "The 3D dice are unavailable, but simulated rolls still work.";
        updateButtons(false);
        return false;
      }
    }

    function roll() {
      cancelBatch();
      if (!initialize()) return;
      physics.throwWithRandom(physicsRandom);
      resultNode.textContent = "Rolling…";
      updateButtons(true);
      setValue(true);
      animator.start();
    }

    function pointerTarget(event) {
      return renderer ? renderer.screenToWorld(event.clientX, event.clientY, 3.15) : null;
    }

    function recordGrabSample(target, timestamp) {
      if (!activeGrab || !target) return;
      const time = Number(timestamp) || performance.now();
      const previous = activeGrab.samples[activeGrab.samples.length - 1];
      if (previous) {
        const deltaX = target[0] - previous.x;
        const deltaZ = target[2] - previous.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance > 0.008) {
          activeGrab.lastDirection = [deltaX / distance, 0, deltaZ / distance];
        }
      }
      activeGrab.samples.push({ x: target[0], z: target[2], time });
      while (activeGrab.samples.length > 8 || (activeGrab.samples[0] && time - activeGrab.samples[0].time > 180)) {
        activeGrab.samples.shift();
      }
    }

    function beginPointerGrab(index, event) {
      if (activeGrab || event.button !== 0 || event.isPrimary === false || !initialize()) return;
      const target = pointerTarget(event);
      if (!target) return;
      event.preventDefault();
      activeGrab = {
        pointerId: event.pointerId,
        handle: grabHandles[index],
        samples: [],
        lastDirection: null
      };
      activeGrab.handle.classList.add("is-grabbing");
      try {
        activeGrab.handle.setPointerCapture(event.pointerId);
      } catch (error) {
        // Some embedded browsers do not expose pointer capture; window listeners still finish the gesture.
      }
      recordGrabSample(target, event.timeStamp);
      physics.beginGrab(index, target);
      resultNode.textContent = "Gathering dice…";
      updateButtons(true);
      setValue(true);
      animator.start(true);
    }

    function movePointerGrab(event) {
      if (!activeGrab || event.pointerId !== activeGrab.pointerId) return;
      const target = event.type === "pointercancel" || event.type === "lostpointercapture"
        ? null
        : pointerTarget(event);
      if (!target) return;
      event.preventDefault();
      recordGrabSample(target, event.timeStamp);
      physics.updateGrabTarget(target);
      animator.schedule();
    }

    function endPointerGrab(event) {
      if (!activeGrab || event.pointerId !== activeGrab.pointerId) return;
      event.preventDefault();
      const target = pointerTarget(event);
      if (target) {
        recordGrabSample(target, event.timeStamp);
        physics.updateGrabTarget(target);
      }
      const samples = activeGrab.samples;
      const end = samples[samples.length - 1];
      let start = samples[0];
      if (end) {
        for (let index = samples.length - 2; index >= 0; index -= 1) {
          if (end.time - samples[index].time >= 45) {
            start = samples[index];
            break;
          }
        }
      }
      const seconds = start && end ? Math.max(0.016, (end.time - start.time) / 1000) : 0;
      const velocity = seconds > 0
        ? [(end.x - start.x) / seconds, 0, (end.z - start.z) / seconds]
        : [0, 0, 0];
      const handle = activeGrab.handle;
      const lastDirection = activeGrab.lastDirection;
      handle.classList.remove("is-grabbing");
      if (typeof handle.hasPointerCapture === "function" && handle.hasPointerCapture(activeGrab.pointerId)) {
        handle.releasePointerCapture(activeGrab.pointerId);
      }
      activeGrab = null;
      physics.releaseGrab(velocity, physicsRandom, lastDirection);
      resultNode.textContent = "Rolling…";
      updateButtons(true);
      setValue(true);
      animator.start();
    }

    // The bulk path allocates nothing per roll: two integers drawn from the
    // seeded stream and one increment. That is what makes a million rolls a
    // tenth of a second rather than a million throwaway arrays.
    function addManyFast(number) {
      const rolls = Math.max(0, Math.trunc(finiteNumber(number, 0)));
      if (!rolls) return;
      const dice = numberOfDice;
      const scratch = new Array(dice);
      let sum = 0;
      for (let index = 0; index < rolls; index += 1) {
        sum = 0;
        for (let die = 0; die < dice; die += 1) {
          const face = 1 + (bulkRandom() * 6 | 0);
          scratch[die] = face;
          sum += face;
        }
        counts[sum] += 1;
      }
      totalRolls += rolls;
      bulkDrawn += rolls;
      lastOutcomes = scratch.slice();
      currentSum = sum;
      highlightSum = null;
    }

    function addManyImmediately(number) {
      addManyFast(number);
      resultNode.textContent = number.toLocaleString() + " simulated rolls added";
      updateChart();
      setValue(false);
      dispatchRollerValue();
    }

    function addMany(number, options) {
      if (batchAnimation) return;
      const settings = options || {};
      // A batch is worth watching up to about a thousand rolls; past that the
      // animation is a wait, not a lesson, so it snaps.
      if (number > animateBulkLimit || settings.animate === false ||
          prefersReducedMotion() || !initialize()) {
        addManyImmediately(number);
        return;
      }
      if (animator) animator.stop();
      const interval = number <= 100 ? 100 : 1000 / 60;
      batchAnimation = {
        total: number,
        processed: 0,
        interval,
        nextAt: performance.now(),
        frame: null,
        lastAnnouncement: -Infinity,
        lastDispatch: -Infinity,
        lastSnapshot: null,
        lastOutcomes: []
      };
      updateButtons(true);
      resultNode.textContent = "0 / " + number.toLocaleString() + " rolls…";
      setValue(true);
      dispatchRollerValue();
      scheduleBatchFrame();
    }

    function reset(options) {
      const settings = options || {};
      cancelBatch();
      if (animator) animator.stop();
      counts.fill(0);
      totalRolls = 0;
      lastOutcomes = [];
      currentSum = null;
      highlightSum = null;
      if (settings.reseed === true) {
        bulkRandom = seededRandom(seed + "-bulk");
        bulkDrawn = 0;
        streamPure = true;
      } else {
        // The counts no longer match the stream position, so a later
        // absolute fill has to rebuild rather than top up.
        streamPure = false;
      }
      resultNode.textContent = "Ready to roll";
      updateChart();
      setValue(Boolean(animator && animator.isRunning()));
      root.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function finishBatchNow() {
      if (batchAnimation) finishBatch(batchAnimation, true);
    }

    function stopPhysicalRoll() {
      if (!animator || !animator.isRunning()) return;
      // Drop the throw rather than let it land: it would add a roll after the
      // step had already fixed the total.
      animator.stop();
      if (physics) physics.setRestingPose();
      animator.render();
      updateButtons(false);
    }

    function rollPhysically(options) {
      const settings = options || {};
      forceImmediateRoll = settings.animate === false;
      try {
        roll();
      } finally {
        forceImmediateRoll = false;
      }
    }

    // Absolute: make the total exactly `target`. Tutorial steps are
    // revisitable and jumpable, so this is the only interpretation that
    // survives back and jump navigation.
    //
    // While the counts are exactly the first `totalRolls` draws of the seeded
    // stream, a larger target tops up and keeps that property. Otherwise --
    // after a physical throw, a manual reset, a dice-count change -- the
    // stream is reseeded and the whole picture rebuilt. Either way the
    // histogram at `rolls: n` is always the first n draws of the seed, so the
    // same step shows the same picture however the reader reached it.
    function setRolls(target, options) {
      const settings = options || {};
      finishBatchNow();
      const wanted = Math.max(0, Math.round(finiteNumber(target, 0)));
      if (wanted === totalRolls) return false;
      stopPhysicalRoll();

      if (wanted < totalRolls || !streamPure) {
        reset({ reseed: true });
      }
      const delta = wanted - totalRolls;
      if (delta <= 0) return true;

      // One more roll is a roll, not a simulation: the dice actually go up.
      if (delta === 1 && settings.physical !== false && initialize()) {
        rollPhysically({ animate: settings.animate });
        return true;
      }
      addMany(delta, { animate: settings.animate });
      // A snapped fill reports the state it landed on, not the size of the
      // top-up: the same step must read the same whether the reader arrived
      // from the step before it or jumped back from the end.
      if (!batchAnimation) {
        resultNode.textContent = wanted.toLocaleString() +
          (wanted === 1 ? " roll simulated" : " rolls simulated");
      }
      return true;
    }

    function expectedLegendMessage() {
      const outcomes = Math.pow(6, numberOfDice).toLocaleString();
      return "Dashed outline: the count each total should get across the " +
        outcomes + " equally likely outcomes.";
    }

    function applyExpectedVisibility(animate) {
      histogram.setExpectedInstant(!animate);
      const helper = global.interactiveFigure;
      if (helper && typeof helper.setRevealVisible === "function") {
        helper.setRevealVisible(histogram.expectedLayer, showExpected, { root, animate });
      } else {
        histogram.expectedLayer.style.opacity = showExpected ? "1" : "0";
        histogram.expectedLayer.setAttribute("aria-hidden", String(!showExpected));
      }
      expectedLegendText.textContent = expectedLegendMessage();
      expectedLegend.hidden = !showExpected;
    }

    function setShowExpected(value, options) {
      const settings = options || {};
      showExpected = Boolean(value);
      applyExpectedVisibility(settings.animate !== false);
      updateChart();
      setValue(Boolean(batchAnimation) || Boolean(animator && animator.isRunning()));
      return showExpected;
    }

    function setDiceCount(value) {
      cancelBatch();
      const nextCount = clamp(Math.round(finiteNumber(value, numberOfDice)), 1, 5);
      if (nextCount === numberOfDice) return numberOfDice;
      numberOfDice = nextCount;
      diceCountSelect.value = String(numberOfDice);
      canvas.setAttribute("aria-label", numberOfDice + (numberOfDice === 1 ? " physically simulated die" : " physically simulated dice") + " viewed from above.");
      counts = Array(numberOfDice * 6 + 1).fill(0);
      totalRolls = 0;
      lastOutcomes = [];
      currentSum = null;
      highlightSum = null;
      streamPure = false;
      histogram = createHistogram(numberOfDice);
      histogramWrap.replaceChildren(histogram.svg);
      applyExpectedVisibility(false);
      rebuildGrabHandles();
      if (initialized) rebuildPhysics();
      resultNode.textContent = "Ready to roll " + numberOfDice + (numberOfDice === 1 ? " die" : " dice");
      updateButtons(false);
      updateChart();
      setValue(false);
      root.dispatchEvent(new Event("input", { bubbles: true }));
      return numberOfDice;
    }

    // Every tutorial action is absolute: a step restates the whole state it
    // needs, so entering it from anywhere -- forwards, backwards, or by
    // clicking a stepper node -- lands on the same figure.
    function applyTutorialAction(action, context) {
      const settings = action || {};
      const animate = settings.animate !== false;
      finishBatchNow();

      if (Object.prototype.hasOwnProperty.call(settings, "dice")) {
        setDiceCount(settings.dice);
      }
      if (settings.reset === true) {
        reset({ reseed: true });
      }
      if (Object.prototype.hasOwnProperty.call(settings, "show-expected")) {
        setShowExpected(Boolean(settings["show-expected"]), { animate });
      }
      if (Object.prototype.hasOwnProperty.call(settings, "rolls")) {
        setRolls(settings.rolls, { animate });
      }
      // Belongs on data-repeat-action: throwing the dice again is an event,
      // not a state, so a plain step that carries it re-throws on every visit.
      if (settings.roll === true) {
        rollPhysically({ animate });
      }
      if (context && typeof context.setControlsOpen === "function" &&
          Object.prototype.hasOwnProperty.call(settings, "controls-open")) {
        context.setControlsOpen(Boolean(settings["controls-open"]), animate);
      }

      updateChart();
      setValue(Boolean(batchAnimation) || Boolean(animator && animator.isRunning()));
      dispatchRollerValue();
    }

    function whenSettled() {
      return new Promise(function(resolve) {
        let attempts = 0;
        function check() {
          attempts += 1;
          const busy = Boolean(batchAnimation) || Boolean(animator && animator.isRunning());
          if (!busy || attempts > 600) {
            resolve();
            return;
          }
          global.requestAnimationFrame(check);
        }
        check();
      });
    }

    let figureWrapper = null;
    let wrapAttempts = 0;
    function attachFigureWrapper() {
      if (figureWrapper) return true;
      const helper = global.interactiveFigure;
      if (!helper || typeof helper.wrap !== "function") return true;
      // The figure is built before the runtime inserts it, so the callout is
      // only visible from a later frame.
      if (!root.isConnected) return false;
      // Standalone, the visible action row is the right control surface and
      // must stay exactly as it is; wrap() would put a toggle above the
      // figure and fold the row away. Inside a callout the shared drawer
      // takes over, and the footer -- if there is one -- becomes a tutorial.
      if (!root.closest(".callout")) return true;
      figureWrapper = helper.wrap({
        root,
        controls,
        label: "dice roller controls",
        startOpen: opts.controlsOpen === true,
        applyAction: applyTutorialAction,
        whenReady: whenSettled
      });
      return true;
    }

    if (!attachFigureWrapper()) {
      const retryWrap = function() {
        wrapAttempts += 1;
        if (attachFigureWrapper() || wrapAttempts >= 60) return;
        global.requestAnimationFrame(retryWrap);
      };
      global.requestAnimationFrame(retryWrap);
    }

    function handleCancelTransitions() {
      // A step is about to be applied: land the rolls already promised
      // instead of abandoning them part-way through the batch.
      finishBatchNow();
    }
    root.addEventListener("bc-if:cancel-transitions", handleCancelTransitions);

    root.diceApi = {
      roll(options) {
        rollPhysically(options);
      },
      add(number, options) {
        addMany(Math.max(0, Math.round(finiteNumber(number, 0))), options);
      },
      setRolls(target, options) {
        return setRolls(target, options);
      },
      reset(options) {
        reset(options);
      },
      setDiceCount(value) {
        return setDiceCount(value);
      },
      setShowExpected(value, options) {
        return setShowExpected(value, options);
      },
      setControlsOpen(value, animate) {
        if (!figureWrapper) return false;
        figureWrapper.setOpen(Boolean(value), animate);
        return figureWrapper.isOpen();
      },
      applyAction(action) {
        applyTutorialAction(action, figureWrapper
          ? { setControlsOpen: (value, animate) => figureWrapper.setOpen(value, animate) }
          : null);
      },
      expectedCounts(rolls, diceCount) {
        return expectedCountsFor(
          diceCount === undefined ? numberOfDice : diceCount,
          rolls === undefined ? totalRolls : rolls
        );
      },
      isBusy() {
        return Boolean(batchAnimation) || Boolean(animator && animator.isRunning());
      },
      whenSettled,
      getState() {
        return {
          numberOfDice,
          rolls: totalRolls,
          counts: counts.slice(),
          showExpected,
          streamPure,
          bulkDrawn,
          batching: Boolean(batchAnimation),
          rolling: Boolean(animator && animator.isRunning())
        };
      }
    };

    rollButton.addEventListener("click", () => roll());
    add100Button.addEventListener("click", () => addMany(100));
    add1000Button.addEventListener("click", () => addMany(1000));
    diceCountSelect.addEventListener("change", () => setDiceCount(diceCountSelect.value));
    resetButton.addEventListener("click", () => reset());
    function handleBatchVisibility() {
      if (!batchAnimation) return;
      if (document.hidden) finishBatch(batchAnimation, true);
      else scheduleBatchFrame();
    }
    rebuildGrabHandles();
    global.addEventListener("pointermove", movePointerGrab, { passive: false });
    global.addEventListener("pointerup", endPointerGrab, { passive: false });
    global.addEventListener("pointercancel", endPointerGrab, { passive: false });
    document.addEventListener("visibilitychange", handleBatchVisibility);
    updateButtons(false);
    applyExpectedVisibility(false);
    updateChart();
    setValue(false);

    if (debugEnabled) {
      root.diceDebug = {
        get: function() {
          return Object.assign({ numberOfDice }, debugValues);
        },
        set: function(values) {
          const next = values || {};
          if (next.numberOfDice !== undefined) setDiceCount(next.numberOfDice);
          tuningPanel.setValues(next, true);
          return Object.assign({ numberOfDice }, debugValues);
        },
        reset: function() {
          setDiceCount(clamp(Math.round(finiteNumber(opts.numberOfDice, 2)), 1, 5));
          tuningPanel.setValues(debugDefaults, true);
          return Object.assign({ numberOfDice }, debugValues);
        }
      };
    }

    const initializeObserver = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          if (entries[0] && entries[0].isIntersecting) {
            initializeObserver.disconnect();
            initialize();
          }
        }, { rootMargin: "220px 0px", threshold: 0 })
      : null;
    if (initializeObserver) initializeObserver.observe(root);
    else global.requestAnimationFrame(initialize);

    root.destroy = function() {
      cancelBatch();
      global.removeEventListener("pointermove", movePointerGrab);
      global.removeEventListener("pointerup", endPointerGrab);
      global.removeEventListener("pointercancel", endPointerGrab);
      document.removeEventListener("visibilitychange", handleBatchVisibility);
      root.removeEventListener("bc-if:cancel-transitions", handleCancelTransitions);
      if (resizeObserver) resizeObserver.disconnect();
      if (initializeObserver) initializeObserver.disconnect();
      if (animator) animator.destroy();
      if (physics) physics.destroy();
      if (renderer) renderer.destroy();
    };

    // Adopted here rather than left to wrap(): the runtime reads the
    // readiness contract in the same tick it mounts the figure, and wrap()
    // cannot run until a later frame (and does not run at all standalone).
    if (global.interactiveFigure && typeof global.interactiveFigure.adopt === "function") {
      global.interactiveFigure.adopt(root, {
        whenReady: whenSettled,
        cancelMotion: function() {
          finishBatchNow();
        },
        dispose: function() {
          root.destroy();
        }
      });
    }
    root.setShadowMode = function(mode) {
      if (!initialize()) return null;
      const activeMode = renderer.setShadowMode(mode);
      animator.render();
      return activeMode;
    };
    return root;
  };
}(window));
