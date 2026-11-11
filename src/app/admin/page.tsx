"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { PlatformShell } from "@/components/PlatformShell";
type Team = {
  id: string;
  team_name: string;
  score: number;
  solved_count: number;
};
type Challenge = { id: number; name: string; is_active: boolean };
type Announcement = {
  id: string;
  message: string;
  severity: string;
  is_active: boolean;
};
type History = {
  team_name: string;
  current_score: number;
  history: {
    id: string;
    delta: number;
    reason: string;
    actor: string;
    created_at: string;
  }[];
};
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Team | null>(null);
  const load = useCallback(async (teamPage: number, query: string) => {
    const [directory, challengeList, announcementList, mode, freeze] =
      await Promise.all([
        api<{ teams: Team[]; pagination: { total_pages: number } }>(
          `/admin/teams?page=${teamPage}&limit=20&search=${encodeURIComponent(query)}`,
        ),
        api<{ challenges: Challenge[] }>("/admin/challenges"),
        api<{ announcements: Announcement[] }>("/admin/announcements"),
        api<{ maintenance: boolean }>("/admin/maintenance-mode"),
        api<{ frozen: boolean }>("/admin/leaderboard/status"),
      ]);
    setTeams(directory.teams);
    setPages(directory.pagination.total_pages);
    setPage(teamPage);
    setChallenges(challengeList.challenges);
    setAnnouncements(announcementList.announcements);
    setMaintenance(mode.maintenance);
    setFrozen(freeze.frozen);
  }, []);
  useEffect(() => {
    api("/admin/me")
      .then(() => {
        setAuthenticated(true);
        return load(1, "");
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401))
          setMessage(err.message);
      })
      .finally(() => setChecking(false));
  }, [load]);
  async function run(action: () => Promise<unknown>, refresh = true) {
    setBusy(true);
    setMessage("");
    try {
      const result = (await action()) as { message?: string };
      setMessage(result?.message || "Done.");
      if (refresh) await load(page, search);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed.");
      if (err instanceof ApiError && err.status === 401)
        setAuthenticated(false);
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(async () => {
      await api("/admin/login", {
        username: data.get("username"),
        password: data.get("password"),
      });
      setAuthenticated(true);
      await load(page, search);
    }, false);
  }
  return (
    <PlatformShell title="Organiser controls">
      <p role="status" aria-live="polite">
        {message}
      </p>
      {checking ? (
        <p>Checking admin session…</p>
      ) : !authenticated ? (
        <form className="arena-panel arena-form" onSubmit={login}>
          <label>
            Admin username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>Admin login</button>
        </form>
      ) : (
        <>
          <div className="arena-actions">
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/admin/logout", {});
                  setAuthenticated(false);
                }, false)
              }
            >
              Log out
            </button>
            <a href="/api/admin/export/results?format=csv" download>
              Export final CSV
            </a>
            <a href="/api/admin/export/results" download>
              Export JSON
            </a>
          </div>
          <section className="arena-panel">
            <h2>Event controls</h2>
            <p>
              Maintenance: {maintenance ? "on" : "off"} · Scoreboard:{" "}
              {frozen ? "frozen" : "live"}
            </p>
            <div className="arena-actions">
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      maintenance
                        ? "Resume scoring?"
                        : "Pause all scoring and hint reveals?",
                    )
                  )
                    void run(() =>
                      api(
                        `/admin/maintenance-mode/${maintenance ? "off" : "on"}`,
                        {},
                      ),
                    );
                }}
              >
                {maintenance ? "Resume scoring" : "Pause scoring"}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    api(
                      `/admin/leaderboard/${frozen ? "unfreeze" : "freeze"}`,
                      {},
                    ),
                  )
                }
              >
                {frozen ? "Reveal standings" : "Freeze scoreboard"}
              </button>
            </div>
          </section>
          <section className="arena-panel">
            <h2>Teams</h2>
            <form
              className="arena-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => load(1, search));
              }}
            >
              <label>
                Search teams
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button disabled={busy}>Search</button>
            </form>
            <div className="arena-table arena-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th className="number">Score</th>
                    <th className="number">Solves</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <td>{team.team_name}</td>
                      <td className="number">{team.score}</td>
                      <td className="number">{team.solved_count}</td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() => setSelected(team)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="arena-actions">
              <button
                disabled={busy || page <= 1}
                onClick={() => run(() => load(page - 1, search), false)}
              >
                Previous
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button
                disabled={busy || page >= pages}
                onClick={() => run(() => load(page + 1, search), false)}
              >
                Next
              </button>
            </div>
            {selected && (
              <div className="arena-panel">
                <h3>{selected.team_name}</h3>
                <div className="arena-actions">
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        async () =>
                          setHistory(
                            await api<History>(
                              `/admin/teams/${selected.id}/history`,
                            ),
                          ),
                        false,
                      )
                    }
                  >
                    Score history
                  </button>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setHistory(null);
                    }}
                  >
                    Close team
                  </button>
                </div>
                <form
                  className="arena-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void run(() =>
                      api(`/admin/teams/${selected.id}/adjust-score`, {
                        delta: Number(form.get("delta")),
                        reason: form.get("reason"),
                      }),
                    );
                  }}
                >
                  <label>
                    Point adjustment
                    <input name="delta" type="number" step={1} required />
                  </label>
                  <label>
                    Reason
                    <input name="reason" minLength={5} required />
                  </label>
                  <button disabled={busy}>Apply adjustment</button>
                </form>
                <form
                  className="arena-form mt-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void run(() =>
                      api(`/admin/teams/${selected.id}/reset-password`, {
                        password: form.get("password"),
                        reason: form.get("reason"),
                      }),
                    );
                  }}
                >
                  <label>
                    New team password
                    <input
                      type="password"
                      name="password"
                      minLength={8}
                      maxLength={72}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Reset reason
                    <input name="reason" minLength={5} required />
                  </label>
                  <button disabled={busy}>Reset credentials</button>
                </form>
                {history && (
                  <div className="arena-table arena-admin-table">
                    <h3>
                      {history.team_name}: {history.current_score} points
                    </h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Change</th>
                          <th>Reason / actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.history.map((row) => (
                          <tr key={row.id}>
                            <td>{new Date(row.created_at).toLocaleString()}</td>
                            <td>{row.delta}</td>
                            <td>
                              {row.reason} · {row.actor}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="arena-panel">
            <h2>Challenge operations</h2>
            <div className="arena-table arena-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Availability</th>
                    <th>Reset</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((ch) => (
                    <tr key={ch.id}>
                      <td>{ch.name}</td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              api(
                                `/admin/challenges/${ch.id}/toggle-active`,
                                {},
                              ),
                            )
                          }
                        >
                          {ch.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Reset ${ch.name}? Active challenge work may be interrupted. Team scores are retained.`,
                              )
                            )
                              void run(() =>
                                api(
                                  `/admin/challenges/${ch.id}/force-reset`,
                                  {},
                                ),
                              );
                          }}
                        >
                          Force reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="arena-panel">
            <h2>Announcements</h2>
            <form
              className="arena-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void run(() =>
                  api("/admin/announcements", {
                    message: form.get("message"),
                    severity: form.get("severity"),
                  }),
                );
              }}
            >
              <label>
                Message
                <textarea name="message" maxLength={2000} required />
              </label>
              <label>
                Severity
                <select name="severity">
                  <option>info</option>
                  <option>warning</option>
                  <option>critical</option>
                </select>
              </label>
              <button disabled={busy}>Post announcement</button>
            </form>
            {announcements.map((item) => (
              <div className="arena-actions" key={item.id}>
                <p>
                  {item.severity}: {item.message}
                </p>
                {item.is_active ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api(`/admin/announcements/${item.id}/deactivate`, {}),
                      )
                    }
                  >
                    Withdraw
                  </button>
                ) : (
                  <span>Withdrawn</span>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </PlatformShell>
  );
}
