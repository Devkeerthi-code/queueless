"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

type CameraState = "idle" | "starting" | "live" | "denied" | "unavailable";
type Decoder = (data: Uint8ClampedArray, width: number, height: number, opts: { inversionAttempts: "dontInvert" }) => { data: string } | null;

const SCAN_EVERY_MS = 180;
const SAME_CODE_COOLDOWN_MS = 3000;
const SCAN_WIDTH = 480;

/** Camera QR scanning with jsQR on a downscaled canvas. The camera only starts after a tap. */
export function QrScanner({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [state, setState] = useState<CameraState>("idle");

  useEffect(() => {
    pausedRef.current = paused;
    onCodeRef.current = onCode;
  }, [paused, onCode]);

  useEffect(() => () => stopStream(streamRef, frameRef), []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return setState("unavailable");
    setState("starting");
    try {
      const [stream, decoder] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        import("jsqr").then((m) => m.default as Decoder),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setState("live");
      scanLoop(decoder);
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setState(denied ? "denied" : "unavailable");
    }
  }

  function scanLoop(decode: Decoder) {
    let last = 0;
    let lastCode = "";
    let lastCodeAt = 0;
    const tick = (t: number) => {
      frameRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (pausedRef.current || !video || !canvas || t - last < SCAN_EVERY_MS || video.readyState < 2) return;
      last = t;
      const scale = Math.min(1, SCAN_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const found = decode(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
      if (!found?.data) return;
      if (found.data === lastCode && t - lastCodeAt < SAME_CODE_COOLDOWN_MS) return;
      lastCode = found.data;
      lastCodeAt = t;
      if ("vibrate" in navigator) navigator.vibrate(30);
      onCodeRef.current(found.data);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function stop() {
    stopStream(streamRef, frameRef);
    setState("idle");
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-slip border border-line bg-ink">
      <video ref={videoRef} className={state === "live" ? "size-full object-cover" : "hidden"} playsInline muted aria-label="Camera preview for scanning pickup QR codes" />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {state === "live" ? (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-slip border-2 border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-white/90">{paused ? "Paused while an order is open" : "Point at the student's QR"}</p>
          <button type="button" onClick={stop} className="press absolute right-2 top-2 rounded-slip bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
            Stop camera
          </button>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-paper">
          <p className="text-sm text-paper/80">{MESSAGE[state]}</p>
          {(state === "idle" || state === "denied" || state === "unavailable") && (
            <Button variant="accent" onClick={start}>
              {state === "idle" ? "Scan QR with camera" : "Try camera again"}
            </Button>
          )}
          {state === "starting" && <p className="text-sm font-semibold">Starting camera…</p>}
        </div>
      )}
    </div>
  );
}

const MESSAGE: Record<CameraState, string> = {
  idle: "Scanning uses the back camera. Nothing is recorded.",
  starting: "Allow camera access when the browser asks.",
  live: "",
  denied: "Camera access was blocked. Allow it in the browser's site settings, or type the token below.",
  unavailable: "No camera available here. Type the token below instead.",
};

function stopStream(stream: React.RefObject<MediaStream | null>, frame: React.RefObject<number>) {
  cancelAnimationFrame(frame.current);
  stream.current?.getTracks().forEach((t) => t.stop());
  stream.current = null;
}
