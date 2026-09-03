"use client";

import Link from "next/link";
import { mediaUrl, type ManifestEntry, type Title } from "@/lib/catalog";
import { Meta } from "./meta";

/** The hero: the featured title's preview clip looping under its pitch. */
export function Billboard({
  title,
  asset,
  onInfo,
}: {
  title: Title;
  asset: ManifestEntry | null;
  onInfo: () => void;
}) {
  return (
    <section className="billboard">
      <div className="billboard-media">
        {asset ? (
          <video
            key={asset.preview}
            src={mediaUrl(asset.preview)}
            poster={asset.cover}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div className="billboard-fallback" />
        )}
        <div className="billboard-shade" />
        <div className="billboard-fade" />
      </div>
      <div className="billboard-content">
        <span className="billboard-kicker">
          <span className="kicker-dot" aria-hidden="true" />
          {title.mode === "chaos" ? "Live channel" : "Original film · rendered live"}
        </span>
        <h1 className="billboard-title">{title.title}</h1>
        <Meta title={title} />
        <p className="billboard-logline">{title.logline}</p>
        <div className="billboard-actions">
          <Link href={`/watch/${title.id}`} className="btn btn-play">
            <PlayIcon /> Play
          </Link>
          <button type="button" className="btn btn-info" onClick={onInfo}>
            <InfoIcon /> More Info
          </button>
        </div>
      </div>
    </section>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M6 4l14 8-14 8z" fill="currentColor" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.5v6M12 7.2v1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
