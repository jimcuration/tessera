"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND, POWERED_BY } from "@/lib/brand";
import { ProfileMenu } from "./profile-menu";

/** Top navigation: transparent over the billboard, solid once you scroll. */
export function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav${solid ? " solid" : ""}`}>
      <div className="nav-left">
        <Link href="/" className="wordmark" aria-label={`${BRAND} home`}>
          {BRAND}
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <a className="active" href="#">
            Home
          </a>
          <a href="#films">Films</a>
          <a href="#chaos">Live</a>
          <a href="#">My List</a>
        </nav>
      </div>
      <div className="nav-right">
        <span className="powered">{POWERED_BY}</span>
        <ProfileMenu />
      </div>
    </header>
  );
}
