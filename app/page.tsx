"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "../lib/supabase/client";
import { resendSignupConfirmation, signInWithPassword, signOut, signUpWithPassword } from "../lib/supabase/auth";

type Excerpt = { id: number; title: string; measures: string; file?: string; fileUrl?: string; fileType?: string };
type SessionResult = { id: number; name: string; date: string; instrument: string; score: number; reflection: string; audioUrl?: string };

const starterExcerpts: Excerpt[] = [
  { id: 1, title: "Mozart — Exposition", measures: "mm. 1–42" },
  { id: 2, title: "Brahms — Symphony No. 2", measures: "mm. 17–48" },
  { id: 3, title: "Mendelssohn — Scherzo", measures: "mm. 49–99" },
];

const focusItems = [
  ["Tone", "Centered and resonant"],
  ["Rhythm", "Steady and precise"],
  ["Intonation", "Consistent across registers"],
];

export default function Home() {
  const [sessionName, setSessionName] = useState("Fall Orchestra Audition");
  const [instrument, setInstrument] = useState("Violin");
  const [date, setDate] = useState("2026-09-12");
  const [prepTime, setPrepTime] = useState(30);
  const [playTime, setPlayTime] = useState(120);
  const [randomize, setRandomize] = useState(true);
  const [oneTake, setOneTake] = useState(true);
  const [excerpts, setExcerpts] = useState(starterExcerpts);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<"prep" | "perform">("prep");
  const [seconds, setSeconds] = useState(prepTime);
  const [current, setCurrent] = useState(0);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"practice" | "history" | "progress" | "reflection">("practice");
  const [ratings, setRatings] = useState<Record<string, number>>({ Tone: 3, Rhythm: 3, Intonation: 3 });
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

  const ordered = useMemo(() => excerpts, [excerpts]);
  const supabase = useMemo(() => createSupabaseClient(), []);

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
    setRatings({ Tone: 3, Rhythm: 3, Intonation: 3 });
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
    const score = Math.round(Object.values(ratings).reduce((sum, rating) => sum + rating, 0) / 15 * 100);
    setHistory((items) => [{ id: Date.now(), name: sessionName, date, instrument, score, reflection, audioUrl: audioUrl || undefined }, ...items]);
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
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
          <button className={view === "progress" ? "active" : ""} onClick={() => setView("progress")}>Progress</button>
        </nav>
        <div className="accountArea">
          <button className={`iconButton ${userEmail ? "signedIn" : ""}`} aria-label={userEmail ? "Open account menu" : "Sign in"} onClick={() => userEmail ? setAccountOpen((open) => !open) : setAuthOpen(true)}>{userEmail ? userEmail.slice(0, 2).toUpperCase() : "IN"}</button>
          {accountOpen && userEmail && <div className="accountMenu"><span>SIGNED IN AS</span><strong>{userEmail}</strong><button onClick={handleSignOut}>Sign out</button></div>}
        </div>
      </header>

      {view === "practice" && <><section className="hero" id="top">
        <div className="eyebrow"><span>●</span> MOCK AUDITION STUDIO</div>
        <h1>Practice the pressure.<br/><em>Trust the performance.</em></h1>
        <p>Build a realistic audition, remove the do-overs, and learn exactly what to work on next.</p>
        <div className="confidence"><span>Today’s focus</span><strong>Consistency over perfection</strong><div><i/></div></div>
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
          <div className="excerptHeader"><span>{excerpts.length} excerpts</span><span>Drag to reorder · PDF or image</span></div>
          {ordered.map((item, index) => (
            <article className="excerpt" key={item.id}>
              <span className="grip">⠿</span><span className="number">{String(index + 1).padStart(2, "0")}</span>
              <div className="scoreThumb"><span>𝄞</span></div>
              <div className="excerptName"><input aria-label="Excerpt name" value={item.title} onChange={(e) => setExcerpts((list) => list.map(x => x.id === item.id ? {...x, title: e.target.value} : x))}/><input aria-label="Measures" value={item.measures} onChange={(e) => setExcerpts((list) => list.map(x => x.id === item.id ? {...x, measures: e.target.value} : x))}/></div>
              <button className="remove" aria-label={`Remove ${item.title}`} onClick={() => removeExcerpt(item.id)}>×</button>
            </article>
          ))}
          <button className="dropzone" onClick={() => fileRef.current?.click()}><span>＋</span><strong>Drop another score here</strong><small>or click to browse</small></button>
        </section>

        <section className="readyCard">
          <div><span className="signal">●</span><p>YOUR ROOM IS READY</p><h2>{sessionName || "Untitled audition"}</h2><span>{excerpts.length} excerpts · {instrument} · {oneTake ? "One take" : "Retries allowed"}</span></div>
          <button className="startButton" onClick={startAudition} disabled={!excerpts.length}>Begin mock audition <span>→</span></button>
        </section>
      </section></>}

      {view === "progress" && <section className="reviewPreview viewPage" id="progress">
        <div className="reviewCopy"><span className="step light">03</span><p>LISTEN. NOTICE. GROW.</p><h2>Feedback that makes<br/>the next take better.</h2><p className="muted">After your session, replay each excerpt and score what matters—without judging what doesn’t.</p></div>
        <div className="rubricCard">
          <div className="wave"><b>0:42</b><div className="bars">▂▅▃▇▄▆▂▅▇▃▆▄▂▇▅▃▆▂▅▇▃▅▂</div><button aria-label="Play recording">▶</button></div>
          <h3>How did it feel?</h3>
          {focusItems.map(([name, detail], index) => <div className="rubric" key={name}><div><strong>{name}</strong><span>{detail}</span></div><div className="rating" aria-label={`${name} sample rating`}>{[1,2,3,4,5].map(n => <i className={n <= 4-index%2 ? "filled" : ""} key={n}/>)}</div></div>)}
          <div className="readiness"><span>{history.length ? "Latest readiness" : "Sample readiness"}</span><strong>{history[0]?.score ?? 82}<small>/100</small></strong></div>
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
            <div className="bigScore"><strong>{Math.round(Object.values(ratings).reduce((sum, rating) => sum + rating, 0) / 15 * 100)}</strong><span>/100<br/>READINESS</span></div></div>
          <div className="reflectionForm"><h2>How did it feel?</h2>
            {focusItems.map(([name, detail]) => <div className="reflectionRating" key={name}><div><strong>{name}</strong><span>{detail}</span></div><div>{[1,2,3,4,5].map((value) => <button key={value} aria-label={`${name}: ${value} out of 5`} className={value <= ratings[name] ? "selected" : ""} onClick={() => setRatings((items) => ({...items, [name]: value}))}/>)}</div></div>)}
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
