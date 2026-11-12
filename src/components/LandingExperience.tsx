"use client";

import { useId, useState } from "react";
import Image from "next/image";
import styles from "@/app/landing.module.css";
import { challenges } from "@/data/challenges";

const tracks = challenges.map((ch) => ({
  id: ch.id,
  title: ch.title,
  file: ch.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, ""),
  body: ch.narrative,
  clue: ch.storyBeat,
  points: ch.points,
}));

export function HackerVisual() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`${styles.hackerStage} ${paused ? styles.paused : ""}`}>
      <div className={styles.artFrame} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.orbitBack} aria-hidden="true" />
      <div className={styles.hackerFigure}>
        <Image
          src="/media/heist-hacker.png"
          alt="A red-hooded hacker wearing an ivory mask and carrying a white flag"
          width={1024}
          height={1536}
          priority
          sizes="(max-width: 600px) 95vw, (max-width: 1000px) 58vw, 660px"
        />
      </div>
      <div className={styles.orbitFront} aria-hidden="true" />
      <div className={styles.crosshair} aria-hidden="true">
        <span />
        <span />
      </div>
      <button
        className={styles.motionToggle}
        onClick={() => setPaused(!paused)}
        aria-label={paused ? "Play hero animation" : "Pause hero animation"}
        aria-pressed={paused}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          {paused ? (
            <path d="m3 1 8 5-8 5V1Z" />
          ) : (
            <>
              <path d="M2 1h3v10H2zM7 1h3v10H7z" />
            </>
          )}
        </svg>
        <span>{paused ? "PLAY MOTION" : "PAUSE MOTION"}</span>
      </button>
    </div>
  );
}

export function EvidencePreview() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const track = tracks[selected];
  return (
    <div className={styles.evidenceLayout}>
      <div
        className={`${styles.trackList} ${styles.trackListCompact}`}
        role="tablist"
        aria-label="Challenge tracks"
        aria-orientation="vertical"
      >
        {tracks.map((item, i) => (
          <button
            key={item.id}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={selected === i}
            aria-controls={`${id}-panel`}
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => {
              let next = i;
              if (event.key === "ArrowDown") next = (i + 1) % tracks.length;
              else if (event.key === "ArrowUp")
                next = (i + tracks.length - 1) % tracks.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tracks.length - 1;
              else return;
              event.preventDefault();
              setSelected(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
          >
            <span>
              {String(item.id).padStart(2, "0")} · {item.title}
            </span>
            <svg
              width="23"
              height="23"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 12h15m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        ))}
        <p>
          Start with the clues. Follow the connections.
          <br />
          Every captured flag takes you deeper.
        </p>
      </div>
      <div
        className={styles.caseFile}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${selected}`}
        tabIndex={0}
      >
        <div className={styles.fileHeader}>
          <span>{track.file}.txt</span>
          <span>
            {String(track.id).padStart(2, "0")} / {tracks.length}
          </span>
        </div>
        <div key={selected} className={styles.fileBody}>
          <div className={styles.fileIcon} aria-hidden="true">
            <svg width="40" height="46" viewBox="0 0 40 46" fill="none">
              <path
                d="M6 2h19l10 10v32H6V2Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M25 2v11h10M13 23h15M13 29h15M13 35h9"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <h3>{track.title}</h3>
          <p>{track.body}</p>
          <blockquote>{track.clue}</blockquote>
        </div>
        <div className={styles.fileFooter}>
          <span>BRIEFING PREVIEW</span>
          <span>{track.points} PTS</span>
        </div>
      </div>
    </div>
  );
}


