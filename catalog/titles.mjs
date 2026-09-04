// The Tessera catalog: one title. Its premise is data/diginex.json, an
// array of { question, answer, followups } records captured from the live
// CurationAI and served through lib/curation.ts. There is no cover and no
// pre-generated preview: the first beat of every answer is the cold open.

/** @type {import("../lib/catalog").Title[]} */
export const TITLES = [
  {
    id: "diginex",
    title: "diginex",
    company: "Diginex",
    ticker: "DGNX",
    premise: "data/diginex.json",
    featured: true,
  },
];
