"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "../lib/supabase/client";
import { resendSignupConfirmation, signInWithPassword, signOut, signUpWithPassword } from "../lib/supabase/auth";

type Excerpt = { id: number; title: string; measures: string; file?: string; fileUrl?: string; fileType?: string };
type SessionResult = { id: number; name: string; date: string; instrument: string; score: number; reflection: string; audioUrl?: string };
type RubricCategory = { id: string; name: string; description: string; weight: number };
type SightNote = { midi: number; duration: number; staffStep: number };

const keyRoots: Record<string, number> = { C: 60, G: 67, D: 62, F: 65, Bb: 58 };
const keyStaffRoots: Record<string, number> = { C: 0, G: 4, D: 1, F: 3, Bb: -1 };
const keySignatures: Record<string, { symbol: string; treble: number[]; bass: number[] }> = {
  C: { symbol: "", treble: [], bass: [] },
  G: { symbol: "♯", treble: [80], bass: [90] },
  D: { symbol: "♯", treble: [80, 95], bass: [90, 105] },
  F: { symbol: "♭", treble: [100], bass: [110] },
  Bb: { symbol: "♭", treble: [100, 85], bass: [110, 95] },
};

function makeSightReadingNotes(key: string, measures: number, beats: number, difficulty: string, clef: string, allowedDurations: number[]) {
  const scale = [0, 2, 4, 5, 7, 9, 11, 12];
  const maxStep = difficulty === "Beginner" ? 1 : difficulty === "Intermediate" ? 2 : 4;
  let scaleIndex = 3;
  const notes: SightNote[] = [];
  const totalBeats = measures * beats;
  let elapsed = 0;
  while (elapsed < totalBeats) {
    const remainingInMeasure = beats - (elapsed % beats || 0);
    const choices = allowedDurations.filter((duration) => duration <= remainingInMeasure && duration <= totalBeats - elapsed);
    const duration = choices[Math.floor(Math.random() * choices.length)] || Math.min(1, totalBeats - elapsed);
    const direction = Math.floor(Math.random() * (maxStep * 2 + 1)) - maxStep;
    scaleIndex = Math.max(0, Math.min(scale.length - 1, scaleIndex + direction));
    if (elapsed + duration >= totalBeats) scaleIndex = 0;
    notes.push({
      midi: keyRoots[key] + scale[scaleIndex] + (clef === "Bass" ? -12 : 0),
      duration,
      staffStep: keyStaffRoots[key] + scaleIndex + (clef === "Bass" ? -7 : 0),
    });
    elapsed += duration;
  }
  return notes;
}

function sightReadingSvg(notes: SightNote[], key: string, meter: number, tempo: number, clef: string) {
  const shortestDuration = Math.min(...notes.map((note) => note.duration));
  const measuresPerSystem = shortestDuration <= .25 ? 2 : shortestDuration <= .5 ? 3 : 4;
  const perSystem = meter * measuresPerSystem;
  const totalBeats = notes.reduce((sum, note) => sum + note.duration, 0);
  const systems = Math.ceil(totalBeats / perSystem);
  const height = 150 + systems * 150;
  let elapsedBeats = 0;
  const noteMarkup = notes.map((note) => {
    const system = Math.floor(elapsedBeats / perSystem);
    const within = elapsedBeats % perSystem;
    const measureIndex = Math.floor(within / meter);
    const beatInMeasure = within % meter;
    const measureWidth = 750 / measuresPerSystem;
    const x = 190 + measureIndex * measureWidth + 20 + beatInMeasure * ((measureWidth - 32) / meter);
    const middleLineStep = clef === "Bass" ? -6 : 6;
    const y = 100 + system * 150 - (note.staffStep - middleLineStep) * 5;
    const staffTop = 80 + system * 150;
    const staffBottom = 120 + system * 150;
    const ledgerYs: number[] = [];
    if (y >= staffBottom + 10) for (let ledgerY = staffBottom + 10; ledgerY <= y; ledgerY += 10) ledgerYs.push(ledgerY);
    if (y <= staffTop - 10) for (let ledgerY = staffTop - 10; ledgerY >= y; ledgerY -= 10) ledgerYs.push(ledgerY);
    const ledgers = ledgerYs.map((ledgerY) => `<line x1="${x - 13}" y1="${ledgerY}" x2="${x + 13}" y2="${ledgerY}" stroke="#17332d" stroke-width="1.5"/>`).join("");
    const filled = note.duration < 2;
    const flagCount = note.duration === .5 ? 1 : note.duration === .25 ? 2 : 0;
    const flags = Array.from({ length: flagCount }, (_, flag) => `<path d="M ${x + 8} ${y - 34 + flag * 8} q 16 7 9 20" fill="none" stroke="#17332d" stroke-width="2.5"/>`).join("");
    const markup = `${ledgers}<ellipse cx="${x}" cy="${y}" rx="9" ry="6" transform="rotate(-18 ${x} ${y})" fill="${filled ? "#17332d" : "#fffdf7"}" stroke="#17332d" stroke-width="2"/><line x1="${x + 8}" y1="${y}" x2="${x + 8}" y2="${y - 34}" stroke="#17332d" stroke-width="2"/>${flags}`;
    elapsedBeats += note.duration;
    return markup;
  }).join("");
  const staffs = Array.from({ length: systems }, (_, system) => Array.from({ length: 5 }, (__, line) => `<line x1="60" y1="${80 + system * 150 + line * 10}" x2="960" y2="${80 + system * 150 + line * 10}" stroke="#718078" stroke-width="1"/>`).join("")).join("");
  const barlines = Array.from({ length: systems }, (_, system) => Array.from({ length: measuresPerSystem + 1 }, (__, bar) => `<line x1="${190 + bar * (750 / measuresPerSystem)}" y1="${80 + system * 150}" x2="${190 + bar * (750 / measuresPerSystem)}" y2="${120 + system * 150}" stroke="#718078" stroke-width="${bar === measuresPerSystem ? 2 : 1}"/>`).join("")).join("");
  const signature = keySignatures[key];
  const signatureYs = clef === "Bass" ? signature.bass : signature.treble;
  const musicStart = Array.from({length: systems},(_,s) => {
    const keyMarks = signatureYs.map((y, index) => `<text x="${108 + index * 18}" y="${y + s * 150 + 7}" font-family="Georgia" font-size="25" fill="#17332d">${signature.symbol}</text>`).join("");
    const timeX = 118 + signatureYs.length * 18;
    return `<text x="64" y="${clef === "Bass" ? 116+s*150 : 124+s*150}" font-family="Bravura, 'Noto Music', serif" font-size="${clef === "Bass" ? 48 : 68}" fill="#17332d">${clef === "Bass" ? "𝄢" : "𝄞"}</text>${keyMarks}<text x="${timeX}" y="${98+s*150}" text-anchor="middle" font-family="Georgia" font-size="24" font-weight="700" fill="#17332d">${meter}</text><text x="${timeX}" y="${120+s*150}" text-anchor="middle" font-family="Georgia" font-size="24" font-weight="700" fill="#17332d">4</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}"><rect width="100%" height="100%" fill="#fffdf7"/><text x="60" y="42" font-family="Georgia" font-size="24" fill="#17332d">StageReady Sight-Reading Study</text><text x="940" y="42" text-anchor="end" font-family="Arial" font-size="14" fill="#718078">${clef} clef · ${key} major · ${meter}/4 · ♩=${tempo}</text><g transform="translate(0 42)">${staffs}${barlines}${musicStart}${noteMarkup}</g></svg>`;
}

const defaultRubric: RubricCategory[] = [
  { id: "tone", name: "Tone", description: "Centered and resonant", weight: 3 },
  { id: "rhythm", name: "Rhythm", description: "Steady and precise", weight: 3 },
  { id: "intonation", name: "Intonation", description: "Consistent across registers", weight: 3 },
];

export default function Home() {
  const [sessionName, setSessionName] = useState("Fall Orchestra Audition");
  const [instrument, setInstrument] = useState("Violin");
  const [date, setDate] = useState("2026-09-12");
  const [prepTime, setPrepTime] = useState(30);
  const [playTime, setPlayTime] = useState(120);
  const [randomize, setRandomize] = useState(true);
  const [oneTake, setOneTake] = useState(true);
  const [excerpts, setExcerpts] = useState<Excerpt[]>([]);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<"prep" | "perform">("prep");
  const [seconds, setSeconds] = useState(prepTime);
  const [current, setCurrent] = useState(0);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"practice" | "sightreading" | "history" | "settings" | "reflection">("practice");
  const [sightKey, setSightKey] = useState("C");
  const [sightMeter, setSightMeter] = useState(4);
  const [sightMeasures, setSightMeasures] = useState(8);
  const [sightTempo, setSightTempo] = useState(80);
  const [sightDifficulty, setSightDifficulty] = useState("Beginner");
  const [sightClef, setSightClef] = useState("Treble");
  const [useEighthNotes, setUseEighthNotes] = useState(false);
  const [useSixteenthNotes, setUseSixteenthNotes] = useState(false);
  const [useHalfNotes, setUseHalfNotes] = useState(false);
  const [sightNotes, setSightNotes] = useState<SightNote[]>([]);
  const [referencePlaying, setReferencePlaying] = useState(false);
  const [rubric, setRubric] = useState<RubricCategory[]>(defaultRubric);
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(defaultRubric.map((item) => [item.id, 3])));
  const [reflection, setReflection] = useState("");
  const [history, setHistory] = useState<SessionResult[]>([]);
  const [audioUrl, setAudioUrl] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [confirmationExpired, setConfirmationExpired] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const rubricLoadedRef = useRef(false);
  const referenceTimeoutRef = useRef<number | null>(null);
  const referenceAudioRef = useRef<AudioContext | null>(null);

  const ordered = useMemo(() => excerpts, [excerpts]);
  const supabase = useMemo(() => createSupabaseClient(), []);
  const readinessScore = useMemo(() => {
    const totalWeight = rubric.reduce((sum, item) => sum + item.weight, 0);
    if (!totalWeight) return 0;
    const weightedRatings = rubric.reduce((sum, item) => sum + (ratings[item.id] ?? 3) * item.weight, 0);
    return Math.round(weightedRatings / (5 * totalWeight) * 100);
  }, [ratings, rubric]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email || "");
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = query.get("error_code") || hash.get("error_code");
    if (errorCode === "otp_expired") {
      window.history.replaceState({}, "", window.location.pathname);
      queueMicrotask(() => {
        setAuthMode("signup");
        setAuthStatus("That confirmation link has expired or was already used. Enter your email below and request a new link.");
        setConfirmationExpired(true);
        setAuthOpen(true);
      });
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => () => {
    if (referenceTimeoutRef.current) window.clearTimeout(referenceTimeoutRef.current);
    void referenceAudioRef.current?.close();
  }, []);

  useEffect(() => {
    const savedRubric = window.localStorage.getItem("stageready-rubric");
    if (!savedRubric) {
      window.localStorage.setItem("stageready-rubric", JSON.stringify(defaultRubric));
      rubricLoadedRef.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(savedRubric) as RubricCategory[];
      if (Array.isArray(parsed) && parsed.length && parsed.every((item) => item.id && item.name && item.weight > 0)) {
        queueMicrotask(() => setRubric(parsed));
      }
    } catch {
      window.localStorage.setItem("stageready-rubric", JSON.stringify(defaultRubric));
    }
    rubricLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!rubricLoadedRef.current) return;
    window.localStorage.setItem("stageready-rubric", JSON.stringify(rubric));
  }, [rubric]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value > 1) return value - 1;
        if (phase === "prep") {
          setPhase("perform");
          return playTime;
        }
        stopRecording();
        setActive(false);
        setNotice("Take complete — your reflection is ready.");
        setView("reflection");
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, phase, playTime]);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const additions = files.map((file, index) => ({
      id: Date.now() + index,
      title: file.name.replace(/\.[^.]+$/, ""),
      measures: "Add measures",
      file: file.name,
      fileUrl: URL.createObjectURL(file),
      fileType: file.type,
    }));
    setExcerpts((items) => [...items, ...additions]);
    setNotice(`${files.length} excerpt${files.length > 1 ? "s" : ""} added.`);
  }

  async function startAudition() {
    if (!excerpts.length) return;
    setExcerpts((items) => {
      if (!randomize) return items;
      return [...items].sort(() => Math.random() - 0.5);
    });
    setCurrent(0);
    setPhase("prep");
    setSeconds(prepTime);
    setNotice("");
    setRatings(Object.fromEntries(rubric.map((item) => [item.id, 3])));
    setReflection("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setRecordingError("");
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const recording = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (recording.size) setAudioUrl(URL.createObjectURL(recording));
        microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
        microphoneStreamRef.current = null;
      };
      recorder.start();
    } catch {
      setRecordingError("Microphone access was unavailable. You can still complete the audition and reflection.");
    }
    setActive(true);
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    else microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
  }

  function cancelSession() {
    stopRecording();
    setActive(false);
  }

  function endPerformanceEarly() {
    stopRecording();
    setActive(false);
    setNotice("Performance ended early — your reflection is ready.");
    setView("reflection");
  }

  function saveReflection() {
    setHistory((items) => [{ id: Date.now(), name: sessionName, date, instrument, score: readinessScore, reflection, audioUrl: audioUrl || undefined }, ...items]);
    setNotice("Reflection saved to your audition history.");
    setView("history");
  }

  function removeExcerpt(id: number) {
    setExcerpts((list) => {
      const removed = list.find((item) => item.id === id);
      if (removed?.fileUrl) URL.revokeObjectURL(removed.fileUrl);
      return list.filter((item) => item.id !== id);
    });
  }

  function updateRubricCategory(id: string, updates: Partial<RubricCategory>) {
    setRubric((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  function addRubricCategory() {
    const id = `category-${Date.now()}`;
    setRubric((items) => [...items, { id, name: "New category", description: "Describe what good sounds like", weight: 3 }]);
    setRatings((items) => ({ ...items, [id]: 3 }));
    setNotice("New rubric category added.");
  }

  function removeRubricCategory(id: string) {
    const categoryName = rubric.find((item) => item.id === id)?.name || "Rubric category";
    setRubric((items) => items.length > 1 ? items.filter((item) => item.id !== id) : items);
    setRatings((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
    setNotice(`${categoryName} removed from your rubric.`);
  }

  function generateSightReading() {
    stopSightReading();
    const durations = [1, ...(useEighthNotes ? [.5] : []), ...(useSixteenthNotes ? [.25] : []), ...(useHalfNotes ? [2] : [])];
    setSightNotes(makeSightReadingNotes(sightKey, sightMeasures, sightMeter, sightDifficulty, sightClef, durations));
    setNotice("A new sight-reading excerpt is ready.");
  }

  function playSightReading() {
    if (!sightNotes.length) return;
    if (referencePlaying) {
      stopSightReading();
      return;
    }
    setReferencePlaying(true);
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    referenceAudioRef.current = context;
    const beatSeconds = 60 / sightTempo;
    let playbackBeats = 0;
    sightNotes.forEach((note) => {
      const fundamental = context.createOscillator();
      const harmonic = context.createOscillator();
      const harmonicGain = context.createGain();
      const vibrato = context.createOscillator();
      const vibratoDepth = context.createGain();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime + .08 + playbackBeats * beatSeconds;
      const end = start + beatSeconds * note.duration * 1.12;
      const frequency = 440 * Math.pow(2, (note.midi - 69) / 12);
      const bowedWave = context.createPeriodicWave(
        new Float32Array([0, 0, 0, 0, 0, 0, 0]),
        new Float32Array([0, 1, .42, .24, .14, .08, .045]),
        { disableNormalization: false },
      );
      fundamental.setPeriodicWave(bowedWave);
      fundamental.frequency.value = frequency;
      harmonic.type = "sine";
      harmonic.frequency.value = frequency * 2;
      harmonic.detune.value = 2;
      harmonicGain.gain.value = .055;
      vibrato.type = "sine";
      vibrato.frequency.value = 5.1;
      vibratoDepth.gain.value = 4.5;
      vibrato.connect(vibratoDepth);
      vibratoDepth.connect(fundamental.detune);
      vibratoDepth.connect(harmonic.detune);
      filter.type = "lowpass";
      filter.frequency.value = Math.min(2100, frequency * 5.5);
      filter.Q.value = .7;
      const noteLength = end - start;
      const attackEnd = start + Math.min(.14, noteLength * .25);
      const releaseStart = start + noteLength * .72;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(.068, attackEnd);
      gain.gain.setValueAtTime(.064, releaseStart);
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      fundamental.connect(filter);
      harmonic.connect(harmonicGain).connect(filter);
      filter.connect(gain).connect(context.destination);
      fundamental.start(start);
      harmonic.start(start);
      vibrato.start(start + Math.min(.08, beatSeconds * .15));
      fundamental.stop(end + .02);
      harmonic.stop(end + .02);
      vibrato.stop(end + .02);
      playbackBeats += note.duration;
    });
    if (referenceTimeoutRef.current) window.clearTimeout(referenceTimeoutRef.current);
    const totalDuration = sightNotes.reduce((sum, note) => sum + note.duration, 0);
    referenceTimeoutRef.current = window.setTimeout(() => {
      setReferencePlaying(false);
      referenceAudioRef.current = null;
      void context.close();
    }, totalDuration * beatSeconds * 1000 + 1000);
  }

  function stopSightReading() {
    if (referenceTimeoutRef.current) {
      window.clearTimeout(referenceTimeoutRef.current);
      referenceTimeoutRef.current = null;
    }
    if (referenceAudioRef.current) {
      void referenceAudioRef.current.close();
      referenceAudioRef.current = null;
    }
    setReferencePlaying(false);
  }

  function addSightReadingToAudition() {
    if (!sightNotes.length) return;
    const svg = sightReadingSvg(sightNotes, sightKey, sightMeter, sightTempo, sightClef);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    setExcerpts((items) => [...items, { id: Date.now(), title: `${sightDifficulty} sight-reading study`, measures: `mm. 1–${sightMeasures} · ${sightClef} clef · ${sightKey} major`, file: "generated-sight-reading.svg", fileUrl: url, fileType: "image/svg+xml" }]);
    setNotice("Sight-reading excerpt added to your audition.");
    setView("practice");
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthStatus("");
    const result = authMode === "login"
      ? await signInWithPassword(supabase, authEmail, authPassword)
      : await signUpWithPassword(supabase, authEmail, authPassword, window.location.origin);
    setAuthBusy(false);
    if (result.error) {
      setAuthStatus(result.error.message);
      return;
    }
    if (authMode === "signup" && !result.data.session) {
      setAuthStatus("Check your email to confirm your StageReady account.");
      setConfirmationExpired(false);
      return;
    }
    setAuthOpen(false);
    setAuthPassword("");
    setNotice("You’re signed in. Welcome to StageReady.");
  }

  async function handleResendConfirmation() {
    if (!authEmail) {
      setAuthStatus("Enter the email address you used to create your account.");
      return;
    }
    setAuthBusy(true);
    const { error } = await resendSignupConfirmation(supabase, authEmail, window.location.origin);
    setAuthBusy(false);
    if (error) {
      setAuthStatus(error.message);
      return;
    }
    setConfirmationExpired(false);
    setAuthStatus("A new confirmation link was sent. Use the newest email only.");
  }

  async function handleSignOut() {
    await signOut(supabase);
    setAccountOpen(false);
    setNotice("You’ve been signed out.");
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="StageReady home" onClick={() => setView("practice")}>
          <span className="brandMark">S</span><span>StageReady</span>
        </a>
        <nav aria-label="Primary navigation">
          <button className={view === "practice" ? "active" : ""} onClick={() => setView("practice")}>Practice</button>
          <button className={view === "sightreading" ? "active" : ""} onClick={() => setView("sightreading")}>Sight-reading</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</button>
        </nav>
        <div className="accountArea">
          <button className={`iconButton ${userEmail ? "signedIn" : ""}`} aria-label={userEmail ? "Open account menu" : "Sign in"} onClick={() => userEmail ? setAccountOpen((open) => !open) : setAuthOpen(true)}>{userEmail ? userEmail.slice(0, 2).toUpperCase() : "IN"}</button>
          {accountOpen && userEmail && <div className="accountMenu"><span>SIGNED IN AS</span><strong>{userEmail}</strong><button onClick={handleSignOut}>Sign out</button></div>}
        </div>
      </header>

      {view === "practice" && <><section className="hero" id="top">
        <div className="eyebrow"><span>●</span> MOCK AUDITION STUDIO</div>
        <h1>Practice the pressure.</h1>
        <p>Build a realistic audition, remove the do-overs, and learn exactly what to work on next.</p>
      </section>

      <section className="workspace" id="practice">
        <div className="sectionIntro">
          <div><span className="step">01</span><p>SET THE STAGE</p><h2>Create your mock audition</h2></div>
          <p className="sectionNote">A few details help us make the session feel real.</p>
        </div>

        <div className="setupGrid">
          <section className="card detailsCard">
            <div className="cardTitle"><span className="roundIcon">✦</span><div><h3>Audition details</h3><p>Name the moment you’re preparing for.</p></div></div>
            <label>Audition name<input value={sessionName} onChange={(e) => setSessionName(e.target.value)} /></label>
            <div className="twoCol">
              <label>Instrument<select value={instrument} onChange={(e) => setInstrument(e.target.value)}><option>Violin</option><option>Viola</option><option>Cello</option><option>Flute</option><option>Clarinet</option><option>Trumpet</option></select></label>
              <label>Audition date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            </div>
          </section>

          <section className="card rulesCard">
            <div className="cardTitle"><span className="roundIcon">◷</span><div><h3>Session rules</h3><p>Set boundaries that sharpen your focus.</p></div></div>
            <div className="timeRow">
              <label>Preparation<select value={prepTime} onChange={(e) => setPrepTime(Number(e.target.value))}><option value="15">0:15</option><option value="30">0:30</option><option value="60">1:00</option></select></label>
              <span className="arrow">→</span>
              <label>Performance<select value={playTime} onChange={(e) => setPlayTime(Number(e.target.value))}><option value="60">1:00</option><option value="120">2:00</option><option value="180">3:00</option></select></label>
            </div>
            <Toggle checked={randomize} onChange={setRandomize} title="Shuffle excerpt order" detail="Reveal each excerpt only when it’s time." />
            <Toggle checked={oneTake} onChange={setOneTake} title="One-take mode" detail="No restarts. Just like the room." />
          </section>
        </div>

        <div className="sectionIntro excerptsIntro">
          <div><span className="step">02</span><p>BUILD YOUR LIST</p><h2>Add your excerpts</h2></div>
          <button className="uploadButton" onClick={() => fileRef.current?.click()}>＋ Upload scores</button>
          <input ref={fileRef} hidden type="file" accept="image/*,.pdf" multiple onChange={addFiles}/>
        </div>

        <section className="excerptPanel">
          <div className="excerptHeader"><span>{excerpts.length} {excerpts.length === 1 ? "excerpt" : "excerpts"}</span><span>Drag to reorder · PDF or image</span></div>
          {ordered.map((item, index) => (
            <article className="excerpt" key={item.id}>
              <span className="grip">⠿</span><span className="number">{String(index + 1).padStart(2, "0")}</span>
              <div className="scoreThumb"><span>𝄞</span></div>
              <div className="excerptName"><input aria-label="Excerpt name" value={item.title} onChange={(e) => setExcerpts((list) => list.map(x => x.id === item.id ? {...x, title: e.target.value} : x))}/><input aria-label="Measures" value={item.measures} onChange={(e) => setExcerpts((list) => list.map(x => x.id === item.id ? {...x, measures: e.target.value} : x))}/></div>
              <button className="remove" aria-label={`Remove ${item.title}`} onClick={() => removeExcerpt(item.id)}>×</button>
            </article>
          ))}
          <button className="dropzone" onClick={() => fileRef.current?.click()}><span>＋</span><strong>{excerpts.length ? "Drop another score here" : "Add your first score here"}</strong><small>or click to browse</small></button>
        </section>

        <section className="readyCard">
          <div><span className="signal">●</span><p>{excerpts.length ? "YOUR ROOM IS READY" : "UPLOAD A SCORE TO BEGIN"}</p><h2>{sessionName || "Untitled audition"}</h2><span>{excerpts.length} {excerpts.length === 1 ? "excerpt" : "excerpts"} · {instrument} · {oneTake ? "One take" : "Retries allowed"}</span></div>
          <button className="startButton" onClick={startAudition} disabled={!excerpts.length}>Begin mock audition <span>→</span></button>
        </section>
      </section></>}

      {view === "sightreading" && <section className="appView sightReadingView" id="sight-reading">
        <div className="viewHeading"><span className="step">SR</span><p>READ WHAT YOU HAVE NEVER SEEN</p><h1>Sight-reading studio</h1><span>Generate an original, playable excerpt and practice performing it on the first attempt.</span></div>
        <div className="sightGrid">
          <section className="sightControls card">
            <div className="cardTitle"><span className="roundIcon">𝄞</span><div><h3>Build your challenge</h3><p>Choose the musical limits, then reveal a new excerpt.</p></div></div>
            <div className="twoCol">
              <label>Difficulty<select value={sightDifficulty} onChange={(event) => setSightDifficulty(event.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
              <label>Key<select value={sightKey} onChange={(event) => setSightKey(event.target.value)}><option>C</option><option>G</option><option>D</option><option>F</option><option>Bb</option></select></label>
              <label>Clef<select value={sightClef} onChange={(event) => setSightClef(event.target.value)}><option>Treble</option><option>Bass</option></select></label>
              <label>Time signature<select value={sightMeter} onChange={(event) => setSightMeter(Number(event.target.value))}><option value="3">3/4</option><option value="4">4/4</option></select></label>
              <label>Length<select value={sightMeasures} onChange={(event) => setSightMeasures(Number(event.target.value))}><option value="4">4 measures</option><option value="8">8 measures</option><option value="12">12 measures</option></select></label>
            </div>
            <fieldset className="rhythmChoices"><legend>Include note values</legend><label><input type="checkbox" checked={useEighthNotes} onChange={(event) => setUseEighthNotes(event.target.checked)}/><span>♪</span> Eighth notes</label><label><input type="checkbox" checked={useSixteenthNotes} onChange={(event) => setUseSixteenthNotes(event.target.checked)}/><span>♬</span> Sixteenth notes</label><label><input type="checkbox" checked={useHalfNotes} onChange={(event) => setUseHalfNotes(event.target.checked)}/><span>𝅗𝅥</span> Two-beat notes</label></fieldset>
            <label>Tempo <span className="rangeValue">♩ = {sightTempo}</span><input className="tempoSlider" style={{ background: `linear-gradient(to right, var(--orange) 0%, var(--orange) ${(sightTempo - 50) / 90 * 100}%, #d4d7d2 ${(sightTempo - 50) / 90 * 100}%, #d4d7d2 100%)` }} type="range" min="50" max="140" step="5" value={sightTempo} onChange={(event) => setSightTempo(Number(event.target.value))}/></label>
            <button className="generateButton" onClick={generateSightReading}>{sightNotes.length ? "Generate another excerpt" : "Generate my excerpt"} <span>→</span></button>
          </section>
          <section className="generatedScore">
            {sightNotes.length ? <>
              <div className="generatedToolbar"><div><span>NEW · NEVER REPEATED</span><strong>{sightDifficulty} · {sightClef} clef · {sightKey} major · {sightMeter}/4</strong></div><div><button className={referencePlaying ? "stopReference" : ""} onClick={playSightReading}>{referencePlaying ? "■ Stop reference" : "▶ Hear reference"}</button><button className="useExcerpt" onClick={addSightReadingToAudition}>Use in mock audition →</button></div></div>
              <div className="generatedNotation" dangerouslySetInnerHTML={{ __html: sightReadingSvg(sightNotes, sightKey, sightMeter, sightTempo, sightClef) }}/>
              <p className="sightTip">Try it once before listening to the reference. The final note intentionally resolves to the home key.</p>
            </> : <div className="emptyScore"><span>𝄢</span><h2>Your unseen music will appear here.</h2><p>Set your challenge, then generate an original excerpt.</p></div>}
          </section>
        </div>
      </section>}

      {view === "settings" && <section className="appView settingsView" id="settings">
        <div className="viewHeading"><span className="step">03</span><p>MAKE IT YOURS</p><h1>Rubric settings</h1><span>Choose what matters and give important categories more influence on your readiness score.</span></div>
        <div className="settingsGrid">
          <div className="rubricEditor">
            <div className="settingsHeader"><div><h2>Custom rubric</h2><p>Performance categories</p></div><button className="addCategory" onClick={addRubricCategory}><span aria-hidden="true">＋</span> Add rubric category</button></div>
            {rubric.map((item) => <article className="rubricEditorRow" key={item.id}>
              <div className="rubricFields"><label>Category<input value={item.name} onChange={(event) => updateRubricCategory(item.id, { name: event.target.value })}/></label><label>What does success sound like?<input value={item.description} onChange={(event) => updateRubricCategory(item.id, { description: event.target.value })}/></label></div>
              <div className="weightControl"><label htmlFor={`weight-${item.id}`}>Importance</label><div><input id={`weight-${item.id}`} type="range" min="1" max="10" value={item.weight} onChange={(event) => updateRubricCategory(item.id, { weight: Number(event.target.value) })}/><strong>{item.weight}×</strong></div><small>{item.weight >= 8 ? "Major impact" : item.weight >= 5 ? "High impact" : item.weight >= 3 ? "Standard impact" : "Light impact"}</small></div>
              <button className="removeCategory" aria-label={`Remove ${item.name}`} disabled={rubric.length === 1} onClick={() => removeRubricCategory(item.id)}><span aria-hidden="true">×</span><span>Remove</span></button>
            </article>)}
          </div>
          <aside className="scorePreview"><p>LIVE SCORE PREVIEW</p><h2>How weighting works</h2><span>Your ratings are multiplied by each category’s importance. A low rating in a heavily weighted category lowers readiness more.</span><div className="previewScore"><strong>{readinessScore}</strong><span>/100<br/>READINESS</span></div><div className="weightSummary">{rubric.map((item) => <div key={item.id}><span>{item.name || "Untitled category"}</span><strong>{Math.round(item.weight / rubric.reduce((sum, category) => sum + category.weight, 0) * 100)}%</strong></div>)}</div></aside>
        </div>
      </section>}

      {view === "history" && <section className="appView" id="history">
        <div className="viewHeading"><span className="step">02</span><p>YOUR AUDITION JOURNAL</p><h1>Practice history</h1><span>Every honest take is evidence of progress.</span></div>
        {history.length ? <div className="historyList">{history.map((session) => <article className="historyCard" key={session.id}>
          <div className="historyDate"><strong>{new Date(`${session.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}</strong><span>{new Date(`${session.date}T12:00:00`).getFullYear()}</span></div>
          <div><p>{session.instrument.toUpperCase()} · MOCK AUDITION</p><h2>{session.name}</h2><span>{session.reflection || "Reflection completed."}</span>{session.audioUrl && <audio className="historyAudio" controls src={session.audioUrl}>Your browser does not support audio playback.</audio>}</div>
          <div className="historyScore"><strong>{session.score}</strong><span>READINESS</span></div>
        </article>)}</div> : <div className="emptyHistory"><span>◷</span><h2>No completed auditions yet</h2><p>Finish a mock audition and your reflection will appear here.</p><button className="startButton" onClick={() => setView("practice")}>Start practicing →</button></div>}
      </section>}

      {view === "reflection" && <section className="appView reflectionView">
        <div className="viewHeading"><span className="step">03</span><p>TAKE A MOMENT</p><h1>Reflect on your performance</h1><span>Be specific, be kind, and choose one thing to carry forward.</span></div>
        <div className="reflectionGrid">
          <div className="reflectionSummary"><span>SESSION COMPLETE</span><h2>{sessionName}</h2><p>{excerpts.length} excerpts · {instrument} · {oneTake ? "One take" : "Open attempts"}</p>
            <div className="takePlayback"><span>YOUR PERFORMANCE</span>{audioUrl ? <audio controls src={audioUrl}>Your browser does not support audio playback.</audio> : <p>{recordingError || "Finalizing your recording…"}</p>}</div>
            <div className="bigScore"><strong>{readinessScore}</strong><span>/100<br/>READINESS</span></div></div>
          <div className="reflectionForm"><h2>How did it feel?</h2>
            {rubric.map((item) => <div className="reflectionRating" key={item.id}><div><strong>{item.name || "Untitled category"}</strong><span>{item.description} · {item.weight}× importance</span></div><div>{[1,2,3,4,5].map((value) => <button key={value} aria-label={`${item.name}: ${value} out of 5`} className={value <= (ratings[item.id] ?? 3) ? "selected" : ""} onClick={() => setRatings((items) => ({...items, [item.id]: value}))}/>)}</div></div>)}
            <label className="reflectionLabel">What will you focus on next?<textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Write a note to your future self…" /></label>
            <button className="startButton saveReflection" onClick={saveReflection}>Save reflection <span>→</span></button>
          </div>
        </div>
      </section>}

      {notice && <div className="toast" role="status">{notice}</div>}

      {authOpen && <div className="authOverlay" role="dialog" aria-modal="true" aria-label={authMode === "login" ? "Sign in to StageReady" : "Create a StageReady account"}>
        <div className="authCard">
          <div className="authBrand"><span className="brandMark">S</span><button onClick={() => setAuthOpen(false)} aria-label="Close sign in">×</button></div>
          <p>{authMode === "login" ? "WELCOME BACK" : "JOIN STAGEREADY"}</p>
          <h2>{authMode === "login" ? "Sign in to keep your progress." : "Create your practice account."}</h2>
          <span className="authIntro">Your audition history and reflections will stay connected to your email.</span>
          <form onSubmit={handleAuthSubmit}>
            <label>Email address<input type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="musician@example.com" /></label>
            <label>Password<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={6} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" /></label>
            {authStatus && <div className="authStatus" role="status">{authStatus}</div>}
            {confirmationExpired && <button type="button" className="resendButton" disabled={authBusy} onClick={handleResendConfirmation}>Resend confirmation email</button>}
            <button className="authSubmit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <button className="authSwitch" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthStatus(""); setConfirmationExpired(false); }}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        </div>
      </div>}

      {active && <div className="modal" role="dialog" aria-modal="true" aria-label="Mock audition in progress">
        <div className="liveCard">
          <div className="liveTop"><span><i/> {phase === "prep" ? "PREPARE" : "RECORDING"}</span><button onClick={cancelSession} aria-label="Cancel session">×</button></div>
          <div className="liveBody">
            <div className="scoreViewer">
              {excerpts[current]?.fileUrl ? (
                excerpts[current]?.fileType === "application/pdf" || excerpts[current]?.file?.toLowerCase().endsWith(".pdf")
                  ? <object data={excerpts[current].fileUrl} type="application/pdf" aria-label={`${excerpts[current].title} score`}><a href={excerpts[current].fileUrl} target="_blank" rel="noreferrer">Open score PDF</a></object>
                  : <img src={excerpts[current].fileUrl} alt={`${excerpts[current].title} score`} />
              ) : <div className="scorePlaceholder"><span>𝄞</span><strong>No score uploaded</strong><small>Upload a PDF or image when building your excerpt list.</small></div>}
            </div>
            <div className="liveControls">
              <p>EXCERPT {current + 1} OF {excerpts.length}</p><h2>{excerpts[current]?.title}</h2><span className="measures">{excerpts[current]?.measures}</span>
              <div className="timer">{clock}</div><p className="timerLabel">{phase === "prep" ? "Preparation time" : "Performance time"}</p>
              {phase === "perform" && <div className="performanceActions">
                {current < excerpts.length - 1 && <button className="nextButton" onClick={() => { setCurrent(current + 1); setPhase("prep"); setSeconds(prepTime); }}>Complete excerpt →</button>}
                <button className="endPerformanceButton" onClick={endPerformanceEarly}>End performance early</button>
              </div>}
              <p className="keepGoing">Take a breath. You’ve done the work.</p>
            </div>
          </div>
        </div>
      </div>}

      <footer id="history"><span>StageReady</span><p>Practice with intention. Perform with trust.</p><small>Built for musicians, by musicians.</small></footer>
    </main>
  );
}

function Toggle({checked, onChange, title, detail}: {checked: boolean; onChange: (v: boolean) => void; title: string; detail: string}) {
  return <button className="toggleRow" onClick={() => onChange(!checked)} aria-pressed={checked}><span className={`toggle ${checked ? "on" : ""}`}><i/></span><span><strong>{title}</strong><small>{detail}</small></span></button>;
}
