"use client";

import { useState, type FormEvent } from "react";
import { useCTF, type TaskView } from "@/context/CTFContext";
import s from "./Room.module.css";

function StatusIcon({ state }: { state: TaskView["state"] }) {
  if (state === "solved")
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-label="Completed">
        <circle cx="10" cy="10" r="9" stroke="var(--success)" strokeWidth="1.5" />
        <path d="M6 10l3 3 5-6" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === "locked")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Locked">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  return null;
}

export function TaskItem({ task, open, onToggle }: { task: TaskView; open: boolean; onToggle: () => void }) {
  const { submitFor, revealHintFor } = useCTF();
  const ch = task.challenge;
  const locked = task.state === "locked";
  const solved = task.state === "solved";
  const bodyId = `task-${ch.id}-body`;

  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hintBusy, setHintBusy] = useState<number | null>(null);
  const [hintErr, setHintErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy || !task.available) return;
    setBusy(true);
    const r = await submitFor(ch.id, answer);
    setBusy(false);
    setFeedback({ ok: r.success, msg: r.message });
    if (r.success) setAnswer("");
  }

  return (
    <section className={`${s.task} ${solved ? s.taskSolved : ""}`}>
      <button
        type="button"
        className={s.taskHead}
        onClick={onToggle}
        disabled={locked}
        aria-expanded={open}
        aria-controls={bodyId}
        title={locked ? "Complete the previous task to unlock" : undefined}
      >
        <span className={s.taskNo}>Task {task.index + 1}</span>
        <span className={s.taskTitle}>{ch.title}</span>
        <span className={s.taskMeta}>
          <span>{ch.tier}</span>
          <span>{ch.points} pts</span>
          <StatusIcon state={task.state} />
          {!locked && (
            <svg className={`${s.chev} ${open ? s.chevOpen : ""}`} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>

      {open && !locked && (
        <div className={s.taskBody} id={bodyId}>
          <p className={s.beat}>{ch.storyBeat}</p>

          {!task.available && (
            <p role="status" className={s.notice}>
              This task is temporarily unavailable while the organisers check it.
            </p>
          )}

          <div className={s.block}>
            <p className={s.blockLabel}>Intel</p>
            <p className={s.text}>{ch.narrative}</p>
          </div>

          <div className={s.block}>
            <p className={s.blockLabel}>Briefing</p>
            <p className={s.text}>{ch.briefing}</p>
          </div>

          {(ch.providedAssets?.length || task.accessInfo || task.collabInfo) && (
            <div className={s.targetBox}>
              <p className={s.blockLabel} style={{ margin: 0 }}>Target &amp; files</p>
              {task.accessInfo && <p className={s.small}>{task.accessInfo}</p>}
              {!!ch.providedAssets?.length && (
                <div className={s.assets}>
                  {ch.providedAssets.map((a) => {
                    const isSite = a.label === "Open challenge site";
                    return (
                      <a
                        key={a.label + a.href}
                        href={a.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${s.btn} ${isSite ? s.btnPrimary : ""}`}
                      >
                        {isSite ? "Open target" : `Download ${a.label}`}
                      </a>
                    );
                  })}
                </div>
              )}
              {task.collabInfo && (
                <p className={s.small}>
                  Team callback: <code className={s.code}>{task.collabInfo.callbackUrl}</code>{" "}
                  <a href={task.collabInfo.logUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#f07878" }}>
                    View callback log
                  </a>
                </p>
              )}
            </div>
          )}

          {ch.hints.length > 0 && (
            <div className={s.hints}>
              <p className={s.blockLabel} style={{ margin: 0 }}>Hints</p>
              {hintErr && <p role="alert" className={s.feedbackBad}>{hintErr}</p>}
              {ch.hints.map((h, i) => {
                const revealed = task.revealedHints.includes(i);
                return (
                  <div className={s.hint} key={h.id ?? i}>
                    <div className={s.hintHead}>
                      <span>Hint {i + 1}</span>
                      <span className={s.hintCost}>−{h.cost} pts</span>
                    </div>
                    {revealed ? (
                      <p className={s.text}>{h.text}</p>
                    ) : (
                      <button
                        type="button"
                        className={s.linkBtn}
                        disabled={solved || !task.available || hintBusy !== null}
                        onClick={async () => {
                          if (!window.confirm(`Reveal this hint for ${h.cost} points? The deduction is permanent.`)) return;
                          setHintBusy(i);
                          setHintErr("");
                          try {
                            await revealHintFor(ch.id, i);
                          } catch (err) {
                            setHintErr(err instanceof Error ? err.message : "Unable to reveal hint.");
                          } finally {
                            setHintBusy(null);
                          }
                        }}
                      >
                        {hintBusy === i ? "Revealing…" : "Reveal hint"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={s.questions}>
            <p className={s.qHeading}>Answer the questions below</p>
            <p className={s.question}>What is the flag for this task?</p>
            {process.env.NEXT_PUBLIC_THM_MODE === "1" ? (
              <p className={s.small}>
                Submit this task&apos;s flag in the matching question on TryHackMe. The flag format is <code>ROOT{"{...}"}</code>.
              </p>
            ) : solved ? (
              <div className={s.answerCorrect} role="status">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Correct answer submitted
              </div>
            ) : (
              <form onSubmit={onSubmit} className={s.answerRow}>
                <input
                  className={s.answerInput}
                  aria-label={`Flag for task ${task.index + 1}`}
                  placeholder="Answer format: ROOT{...}"
                  maxLength={256}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={busy || !task.available}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy || !task.available || !answer.trim()}>
                  {busy ? "Checking…" : "Submit"}
                </button>
              </form>
            )}
            {feedback && !solved && (
              <p role="status" className={feedback.ok ? s.feedbackOk : s.feedbackBad}>{feedback.msg}</p>
            )}
            {task.stat && (
              <p className={s.small}>
                {task.stat.solve_count} {task.stat.solve_count === 1 ? "team has" : "teams have"} solved this
                {task.stat.first_blood ? ` · First blood: ${task.stat.first_blood.team_name}` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
