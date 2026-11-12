import { createHash } from "node:crypto";
import {
  BlobError,
  BlobPreconditionFailedError,
  get,
  list,
  put,
} from "@vercel/blob";
import { connection, NextResponse } from "next/server";
import { challenges } from "@/data/challenges";
import { teamCredentials } from "@/data/credentials";
import type { HintRecord, HintTotalsResponse, TeamHintTotal } from "@/data/hints";

const HINT_PREFIX = "hints/";
const BATCH_SIZE = 20;

function getTeamHash(team: string) {
  return createHash("sha256").update(team).digest("hex");
}

function isKnownTeam(team: string) {
  return teamCredentials.some((entry) => entry.username === team);
}

async function readRecords(pathnames: string[]) {
  return Promise.all(
    pathnames.map(async (pathname) => {
      const response = await get(pathname, { access: "private" });
      if (!response) return null;
      return JSON.parse(await new Response(response.stream).text()) as HintRecord;
    }),
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { team, challengeId, hintIndex } = (body ?? {}) as {
    team?: unknown;
    challengeId?: unknown;
    hintIndex?: unknown;
  };

  if (typeof team !== "string" || !isKnownTeam(team)) {
    return NextResponse.json({ error: "Unknown team." }, { status: 400 });
  }

  if (
    typeof challengeId !== "number" ||
    !Number.isInteger(challengeId) ||
    typeof hintIndex !== "number" ||
    !Number.isInteger(hintIndex)
  ) {
    return NextResponse.json({ error: "Invalid hint." }, { status: 400 });
  }

  const challenge = challenges.find((entry) => entry.id === challengeId);
  const hint = challenge?.hints[hintIndex];
  if (!challenge || !hint) {
    return NextResponse.json({ error: "Invalid hint." }, { status: 400 });
  }

  const record: HintRecord = {
    team,
    challengeId,
    hintIndex,
    cost: hint.cost,
    createdAt: new Date().toISOString(),
  };
  const pathname = `${HINT_PREFIX}${getTeamHash(team)}/${challengeId}-${hintIndex}.json`;

  try {
    await put(pathname, JSON.stringify(record), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
    });
    return NextResponse.json({ success: true, already: false, cost: hint.cost });
  } catch (error) {
    if (
      error instanceof BlobPreconditionFailedError ||
      (error instanceof BlobError && error.message.includes("already exists"))
    ) {
      return NextResponse.json({ success: true, already: true, cost: hint.cost });
    }
    console.error("Failed to record hint", error);
    return NextResponse.json(
      { error: "Unable to record hint." },
      { status: 500 },
    );
  }
}

export async function GET() {
  await connection();

  const totals = new Map<string, TeamHintTotal>();
  for (const { username } of teamCredentials) {
    totals.set(username, { team: username, total: 0, hints: 0, details: [] });
  }

  try {
    let cursor: string | undefined;
    do {
      const result = await list({ prefix: HINT_PREFIX, limit: 1000, cursor });

      for (let index = 0; index < result.blobs.length; index += BATCH_SIZE) {
        const batch = result.blobs.slice(index, index + BATCH_SIZE);
        const records = await readRecords(batch.map((blob) => blob.pathname));

        for (const record of records) {
          if (!record) continue;
          const entry = totals.get(record.team);
          if (!entry) continue;
          entry.total += record.cost;
          entry.hints += 1;
          entry.details.push({
            challengeId: record.challengeId,
            hintIndex: record.hintIndex,
            cost: record.cost,
            createdAt: record.createdAt,
          });
        }
      }

      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("Failed to load hint totals", error);
    return NextResponse.json(
      { error: "Unable to load hint totals." },
      { status: 500 },
    );
  }

  const response: HintTotalsResponse = {
    teams: Array.from(totals.values()).sort(
      (a, b) => b.total - a.total || a.team.localeCompare(b.team),
    ),
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
