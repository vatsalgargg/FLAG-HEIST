import { get, list } from "@vercel/blob";
import { connection, NextResponse } from "next/server";
import { teamCredentials } from "@/data/credentials";
import type { HintRecord, HintTotalsResponse, TeamHintTotal } from "@/data/hints";

const HINT_PREFIX = "hints/";
const BATCH_SIZE = 20;

async function readRecords(pathnames: string[]) {
  return Promise.all(
    pathnames.map(async (pathname) => {
      const response = await get(pathname, { access: "private" });
      if (!response) return null;
      return JSON.parse(await new Response(response.stream).text()) as HintRecord;
    }),
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Competition has ended. Final leaderboard is locked." },
    { status: 403 },
  );
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
