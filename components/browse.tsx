"use client";

import { useEffect, useState } from "react";
import { Billboard } from "./billboard";
import { Nav } from "./nav";
import { Row } from "./row";
import { TitleSheet } from "./title-sheet";
import {
  featuredTitle,
  loadManifest,
  ROWS,
  titleById,
  type Manifest,
  type Title,
} from "@/lib/catalog";
import { POWERED_BY } from "@/lib/brand";

/** The browse page: billboard + rows, Netflix-shaped, all generated. */
export function Browse() {
  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined);
  const [sheet, setSheet] = useState<Title | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadManifest().then((loaded) => {
      if (!cancelled) setManifest(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes the sheet.
  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const assets = manifest?.titles ?? {};
  const featured = featuredTitle();

  return (
    <div className="browse">
      <Nav />
      <Billboard
        title={featured}
        asset={assets[featured.id] ?? null}
        onInfo={() => setSheet(featured)}
      />
      <div className="rows">
        {ROWS.map((row) => (
          <Row
            key={row.id}
            row={row}
            titles={row.ids
              .map((id) => titleById(id))
              .filter((title): title is Title => Boolean(title))}
            assets={assets}
            onInfo={setSheet}
          />
        ))}
      </div>
      <footer className="foot">
        <span>{POWERED_BY}</span>
        <span className="foot-dim">
          Every cover was painted by Nano Banana 2. Every clip is rendered
          live, faster than it plays.
        </span>
      </footer>
      {sheet && (
        <TitleSheet
          title={sheet}
          asset={assets[sheet.id] ?? null}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
