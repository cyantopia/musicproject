"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Excerpt = { id: number; title: string; measures: string; file?: string; fileUrl?: string; fileType?: string };

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
  const fileRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(() => excerpts, [excerpts]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value > 1) return value - 1;
        if (phase === "prep") {
          setPhase("perform");
          return playTime;
        }
        setActive(false);
        setNotice("Take complete — your reflection is ready.");
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

  function startAudition() {
    if (!excerpts.length) return;
    setExcerpts((items) => {
      if (!randomize) return items;
      return [...items].sort(() => Math.random() - 0.5);
    });
    setCurrent(0);
    setPhase("prep");
    setSeconds(prepTime);
    setNotice("");
    setActive(true);
  }

  function endPerformanceEarly() {
    setActive(false);
    setNotice("Performance ended early — your reflection is ready.");
  }

  function removeExcerpt(id: number) {
    setExcerpts((list) => {
      const removed = list.find((item) => item.id === id);
      if (removed?.fileUrl) URL.revokeObjectURL(removed.fileUrl);
      return list.filter((item) => item.id !== id);
    });
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="StageReady home">
          <span className="brandMark">S</span><span>StageReady</span>
        </a>
        <nav aria-label="Primary navigation">
          <a className="active" href="#practice">Practice</a>
          <a href="#history">History</a>
          <a href="#progress">Progress</a>
        </nav>
        <button className="iconButton" aria-label="Open profile">AR</button>
      </header>

      <section className="hero" id="top">
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
        {notice && <div className="toast" role="status">{notice}</div>}
      </section>

      <section className="reviewPreview" id="progress">
        <div className="reviewCopy"><span className="step light">03</span><p>LISTEN. NOTICE. GROW.</p><h2>Feedback that makes<br/>the next take better.</h2><p className="muted">After your session, replay each excerpt and score what matters—without judging what doesn’t.</p></div>
        <div className="rubricCard">
          <div className="wave"><b>0:42</b><div className="bars">▂▅▃▇▄▆▂▅▇▃▆▄▂▇▅▃▆▂▅▇▃▅▂</div><button aria-label="Play recording">▶</button></div>
          <h3>How did it feel?</h3>
          {focusItems.map(([name, detail], index) => <div className="rubric" key={name}><div><strong>{name}</strong><span>{detail}</span></div><div className="rating" aria-label={`${name} sample rating`}>{[1,2,3,4,5].map(n => <i className={n <= 4-index%2 ? "filled" : ""} key={n}/>)}</div></div>)}
          <div className="readiness"><span>Readiness score</span><strong>82<small>/100</small></strong></div>
        </div>
      </section>

      {active && <div className="modal" role="dialog" aria-modal="true" aria-label="Mock audition in progress">
        <div className="liveCard">
          <div className="liveTop"><span><i/> {phase === "prep" ? "PREPARE" : "RECORDING"}</span><button onClick={() => setActive(false)} aria-label="End session">×</button></div>
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
