import http from "node:http";
import { EventEmitter } from "node:events";
import type { DockerLogEntry } from "../../../shared/types.js";

const DOCKER_SOCKET = "/var/run/docker.sock";
const CONTAINER_NAME = "arena-copy-trader";
const MAX_BUFFER = 500;
const RETRY_INTERVAL = 10_000;

const buffer: DockerLogEntry[] = [];
const emitter = new EventEmitter();

let streaming = false;

function pushLine(entry: DockerLogEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  emitter.emit("line", entry);
}

/**
 * Parse Docker multiplexed stream frames.
 * Each frame: 8-byte header [streamType(1), 0, 0, 0, size(4 BE)] + payload
 */
function parseDockerStream(chunk: Buffer, pending: Buffer): { entries: DockerLogEntry[]; remainder: Buffer } {
  const entries: DockerLogEntry[] = [];
  let data = Buffer.concat([pending, chunk]);

  while (data.length >= 8) {
    const streamType = data[0]; // 1=stdout, 2=stderr
    const payloadLen = data.readUInt32BE(4);

    if (data.length < 8 + payloadLen) break; // incomplete frame

    const payload = data.subarray(8, 8 + payloadLen).toString("utf-8").trimEnd();
    data = data.subarray(8 + payloadLen);

    if (!payload) continue;

    // Docker --timestamps prefix: "2025-12-07T18:43:34.123456789Z "
    const tsMatch = payload.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s(.*)$/s);
    const time = tsMatch ? tsMatch[1] : new Date().toISOString();
    const text = tsMatch ? tsMatch[2] : payload;

    for (const line of text.split("\n")) {
      if (!line) continue;
      entries.push({
        time,
        text: line,
        stream: streamType === 2 ? "stderr" : "stdout",
      });
    }
  }

  return { entries, remainder: data };
}

function connectToContainer() {
  if (streaming) return;
  streaming = true;

  const options: http.RequestOptions = {
    socketPath: DOCKER_SOCKET,
    path: `/containers/${CONTAINER_NAME}/logs?stdout=1&stderr=1&timestamps=1&tail=${MAX_BUFFER}&follow=1`,
    method: "GET",
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 404) {
      console.log(`[docker-logs] Container "${CONTAINER_NAME}" not found, retrying in ${RETRY_INTERVAL / 1000}s`);
      streaming = false;
      setTimeout(connectToContainer, RETRY_INTERVAL);
      return;
    }

    if (res.statusCode !== 200) {
      console.log(`[docker-logs] Unexpected status ${res.statusCode}, retrying in ${RETRY_INTERVAL / 1000}s`);
      streaming = false;
      setTimeout(connectToContainer, RETRY_INTERVAL);
      return;
    }

    let pending = Buffer.alloc(0);

    res.on("data", (chunk: Buffer) => {
      const { entries, remainder } = parseDockerStream(chunk, pending);
      pending = remainder;
      for (const entry of entries) {
        pushLine(entry);
      }
    });

    res.on("end", () => {
      console.log("[docker-logs] Stream ended, reconnecting...");
      streaming = false;
      setTimeout(connectToContainer, RETRY_INTERVAL);
    });

    res.on("error", (err) => {
      console.error("[docker-logs] Stream error:", err.message);
      streaming = false;
      setTimeout(connectToContainer, RETRY_INTERVAL);
    });
  });

  req.on("error", (err) => {
    // Docker socket not available (e.g. not mounted, not running locally)
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("[docker-logs] Docker socket not found, retrying in 30s");
      streaming = false;
      setTimeout(connectToContainer, 30_000);
    } else {
      console.error("[docker-logs] Connection error:", err.message);
      streaming = false;
      setTimeout(connectToContainer, RETRY_INTERVAL);
    }
  });

  req.end();
}

export function startLogStream() {
  connectToContainer();
}

export function getLogBuffer(): DockerLogEntry[] {
  return [...buffer];
}

export function onLine(cb: (entry: DockerLogEntry) => void) {
  emitter.on("line", cb);
}

export function offLine(cb: (entry: DockerLogEntry) => void) {
  emitter.off("line", cb);
}
