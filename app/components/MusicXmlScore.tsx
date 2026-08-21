"use client";

import { useEffect, useRef, useState } from "react";

type Player = {
  loadScore: (score: unknown) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => Promise<void>;
};

export default function MusicXmlScore({ musicXml }: { musicXml: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "playing" | "paused" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!containerRef.current) return;
      setStatus("loading");
      setError("");
      containerRef.current.innerHTML = "";
      try {
        const [{ OpenSheetMusicDisplay }, { default: PlaybackEngine }] = await Promise.all([
          import("opensheetmusicdisplay"),
          import("osmd-audio-player"),
        ]);
        if (cancelled || !containerRef.current) return;
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawingParameters: "compacttight",
          drawTitle: true,
        });
        await osmd.load(musicXml);
        osmd.render();
        osmd.cursor.hide();
        const player = new PlaybackEngine() as Player;
        await player.loadScore(osmd);
        if (cancelled) {
          await player.stop();
          return;
        }
        playerRef.current = player;
        setStatus("ready");
      } catch (reason) {
        if (!cancelled) {
          setStatus("error");
          setError(reason instanceof Error ? reason.message : "The MusicXML score could not be loaded.");
        }
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      if (playerRef.current) void playerRef.current.stop();
      playerRef.current = null;
    };
  }, [musicXml]);

  async function play() {
    if (!playerRef.current) return;
    try {
      await playerRef.current.play();
      setStatus("playing");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Playback could not start.");
      setStatus("error");
    }
  }

  function pause() {
    playerRef.current?.pause();
    setStatus("paused");
  }

  async function stop() {
    if (!playerRef.current) return;
    await playerRef.current.stop();
    setStatus("ready");
  }

  return <div className="musicXmlExperience">
    <div className="musicXmlToolbar">
      <span>{status === "loading" ? "Preparing score and instruments…" : status === "error" ? "Playback unavailable" : "MusicXML score ready"}</span>
      <div>
        <button onClick={play} disabled={status === "loading" || status === "playing" || status === "error"}>▶ Play</button>
        <button onClick={pause} disabled={status !== "playing"}>Ⅱ Pause</button>
        <button onClick={stop} disabled={status === "loading" || status === "ready" || status === "error"}>■ Stop</button>
      </div>
    </div>
    {error && <p className="musicXmlError">{error}</p>}
    <div className="musicXmlCanvas" ref={containerRef}/>
  </div>;
}
