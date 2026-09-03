import type { Title } from "@/lib/catalog";

/** Rating, year, mode, genres: the little metadata row. */
export function Meta({ title, compact = false }: { title: Title; compact?: boolean }) {
  return (
    <div className={`meta${compact ? " compact" : ""}`}>
      <span className="rating">{title.rating}</span>
      <span>{title.year}</span>
      <span className={`mode-chip ${title.mode}`}>
        {title.mode === "chaos" ? "LIVE" : "FILM"}
      </span>
      {!compact && <span className="quality">HD · endless</span>}
      <span className="genres">{title.genres.join(" · ")}</span>
    </div>
  );
}
