/**
 * CurationAI answers, behind one interface.
 *
 * WP0 serves answers from data/diginex.json, an array of records captured
 * from the live CurationAI. A streaming endpoint later satisfies the same
 * `getAnswer(question)` contract without changing callers.
 *
 * Tessera is a bridge, not a brain: nothing here invents an answer. A
 * question with no captured record returns `null` and the UI says so.
 */

import fixture from "@/data/diginex.json";

export type RecordKind = "answer" | "deflection";

export interface CurationRecord {
  question: string;
  answer: string;
  /** Ticker card values when the platform returned them; null in WP0. */
  card: Record<string, unknown> | null;
  followups: string[];
  no_suggestions_returned?: boolean;
  kind: RecordKind;
  /** Deflection records carry the showcase link. */
  link?: string;
}

export interface Answer {
  /** The question as captured (may differ from what was typed). */
  question: string;
  answer: string;
  kind: RecordKind;
  link: string | null;
  card: Record<string, unknown> | null;
  /** Follow-up questions to suggest. Already falls back to the spine. */
  followups: string[];
  /** True when the platform returned no suggestions and the spine is used. */
  fromSpine: boolean;
  /** The answer split into indexed sentences: what `beat.source` points at. */
  sentences: string[];
}

interface Fixture {
  company: string;
  ticker: string;
  captured: string;
  source: string;
  records: CurationRecord[];
}

const DATA = fixture as unknown as Fixture;
export const COMPANY = DATA.company;
export const TICKER = DATA.ticker;
export const RECORDS: CurationRecord[] = DATA.records;

/**
 * The spine: the core questions a programme about the company is built
 * from. Used as suggestions when a record returns none. Every entry has a
 * captured answer, so auto-continue never lands on an unanswerable line.
 */
export const SPINE_QUESTIONS: string[] = [
  "What is Diginex",
  "What is the cash position and runway?",
  "What are the key catalysts for Diginex?",
  "What are the key risks for Diginex?",
  "What should someone watch for in the next twelve months?",
];

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9$%.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalise(text).split(" ").filter((t) => t.length > 2));
}

/** Jaccard overlap of word sets: enough for twelve fixture questions. */
function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

/** Below this the question is not one we have an answer for. */
const MATCH_THRESHOLD = 0.34;

/** Find the captured record closest to the typed question, or null. */
export function findRecord(question: string): CurationRecord | null {
  const wanted = normalise(question);
  if (!wanted) return null;
  const exact = RECORDS.find((r) => normalise(r.question) === wanted);
  if (exact) return exact;
  let best: CurationRecord | null = null;
  let bestScore = 0;
  for (const record of RECORDS) {
    const score = similarity(question, record.question);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

/**
 * Split an answer into the sentences a beat's `source` indexes. Paragraph
 * breaks and list markers are boundaries too, so a bullet is one sentence
 * and a heading is its own (harmless) entry. Deterministic: the translator,
 * the checker and the recorder all see the same numbering.
 */
export function splitSentences(answer: string): string[] {
  const out: string[] = [];
  for (const rawPara of answer.split(/\r?\n+/)) {
    const para = rawPara.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim();
    if (!para) continue;
    const parts = para
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(\[$])/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...parts);
  }
  return out;
}

/**
 * The captured answer text carries the platform's own ticker card as
 * boilerplate ("$1.38 USD", "+1.47% today", "$37.83 m USD", "Market Cap")
 * ahead of the actual content; the translator is told to skip it (rule 3)
 * but nothing ever extracted it into `record.card`, so it was captured as
 * null and the strip never showed it (WP3 §1). Parsed here, once, rather
 * than dropping it: same boilerplate shape the translator already skips,
 * keyed off the fixture's own ticker so this has no dependency on wording
 * that would change per company.
 */
const CARD_RE = /\$([0-9.]+)\s*USD\s*\n\s*\n\s*([+-][0-9.]+)%\s*today\s*\n\s*\n\s*\$([0-9.]+)\s*m\s*USD\s*\n\s*\nMarket Cap/;

export function extractCard(answer: string): Record<string, unknown> | null {
  const m = CARD_RE.exec(answer);
  if (!m) return null;
  return {
    ticker: TICKER,
    price: Number(m[1]),
    changePercent: Number(m[2]),
    marketCap: Number(m[3]),
  };
}

function toAnswer(record: CurationRecord): Answer {
  const platformFollowups = Array.isArray(record.followups)
    ? record.followups.filter((f) => typeof f === "string" && f.trim())
    : [];
  const fromSpine =
    record.no_suggestions_returned === true || platformFollowups.length === 0;
  return {
    question: record.question,
    answer: record.answer,
    kind: record.kind === "deflection" ? "deflection" : "answer",
    link: record.link ?? null,
    card: record.card ?? extractCard(record.answer),
    followups: fromSpine
      ? SPINE_QUESTIONS.filter((q) => normalise(q) !== normalise(record.question))
      : platformFollowups,
    fromSpine,
    sentences: splitSentences(record.answer),
  };
}

/**
 * The interface the rest of Tessera talks to. Async so a live endpoint can
 * replace the fixture without touching callers. Resolves null when there is
 * no captured answer for the question.
 */
export async function getAnswer(question: string): Promise<Answer | null> {
  const record = findRecord(question);
  return record ? toAnswer(record) : null;
}

/** Every captured question, for the opening suggestions. */
export function allQuestions(): string[] {
  return RECORDS.map((r) => r.question);
}
