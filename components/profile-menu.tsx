"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";

/**
 * The profile menu. Purely for show, but it works: switch profiles, rename
 * them inline, add or remove one, and the choice sticks in this browser.
 */

export interface Profile {
  id: string;
  name: string;
  /** Tile color. */
  hue: string;
  kids?: boolean;
}

const PALETTE = ["#8b5cf6", "#ff4d8d", "#22c55e", "#f59e0b", "#0ea5e9"];

const DEFAULT_PROFILES: Profile[] = [
  { id: "p1", name: "You", hue: PALETTE[0] },
  { id: "p2", name: "Guest", hue: PALETTE[1] },
  { id: "p3", name: "Kids", hue: PALETTE[2], kids: true },
];

const STORAGE_KEY = "unreel.profiles";

interface Saved {
  profiles: Profile[];
  activeId: string;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Saved;
      if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) return parsed;
    }
  } catch {
    /* fall through to defaults */
  }
  return { profiles: DEFAULT_PROFILES, activeId: DEFAULT_PROFILES[0].id };
}

function save(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* private mode; the session still works */
  }
}

export function Avatar({ profile, size = 34 }: { profile: Profile; size?: number }) {
  return (
    <svg viewBox="0 0 34 34" width={size} height={size} aria-hidden="true">
      <rect width="34" height="34" rx="6" fill={profile.hue} />
      {profile.kids ? (
        <>
          <circle cx="12" cy="14" r="2.4" fill="#f5f0ff" />
          <circle cx="22" cy="14" r="2.4" fill="#f5f0ff" />
          <path
            d="M10 21c2 3.6 12 3.6 14 0"
            fill="none"
            stroke="#f5f0ff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="17" cy="13" r="5.6" fill="#f5f0ff" />
          <path d="M6.5 30.5c1.4-6 5.4-9 10.5-9s9.1 3 10.5 9v3.5h-21z" fill="#f5f0ff" />
        </>
      )}
    </svg>
  );
}

export function ProfileMenu() {
  const [saved, setSaved] = useState<Saved>({
    profiles: DEFAULT_PROFILES,
    activeId: DEFAULT_PROFILES[0].id,
  });
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSaved(load());
  }, []);

  // Click outside or Escape closes the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setManaging(false);
    setEditingId(null);
  };

  const commit = (next: Saved) => {
    setSaved(next);
    save(next);
  };

  const active =
    saved.profiles.find((profile) => profile.id === saved.activeId) ?? saved.profiles[0];
  const others = saved.profiles.filter((profile) => profile.id !== active.id);

  const switchTo = (id: string) => {
    commit({ ...saved, activeId: id });
    close();
  };

  const rename = (id: string, name: string) => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    commit({
      ...saved,
      profiles: saved.profiles.map((profile) =>
        profile.id === id ? { ...profile, name: trimmed } : profile
      ),
    });
  };

  const recolor = (id: string) => {
    commit({
      ...saved,
      profiles: saved.profiles.map((profile) => {
        if (profile.id !== id) return profile;
        const index = PALETTE.indexOf(profile.hue);
        return { ...profile, hue: PALETTE[(index + 1) % PALETTE.length] };
      }),
    });
  };

  const add = () => {
    if (saved.profiles.length >= 5) return;
    const id = `p${Date.now().toString(36)}`;
    const hue = PALETTE[saved.profiles.length % PALETTE.length];
    commit({
      ...saved,
      profiles: [...saved.profiles, { id, name: "New profile", hue }],
    });
    setEditingId(id);
  };

  const remove = (id: string) => {
    if (saved.profiles.length <= 1) return;
    const profiles = saved.profiles.filter((profile) => profile.id !== id);
    commit({
      profiles,
      activeId: saved.activeId === id ? profiles[0].id : saved.activeId,
    });
  };

  return (
    <div className="profile" ref={root}>
      <button
        type="button"
        className={`avatar${open ? " open" : ""}`}
        aria-label={`Profile: ${active.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Avatar profile={active} />
        <svg className="avatar-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-caret" aria-hidden="true" />

          {managing ? (
            <div className="profile-manage">
              <div className="profile-manage-head">Manage Profiles</div>
              {saved.profiles.map((profile) => (
                <ProfileEditor
                  key={profile.id}
                  profile={profile}
                  editing={editingId === profile.id}
                  canRemove={saved.profiles.length > 1}
                  onEdit={() => setEditingId(profile.id)}
                  onDone={() => setEditingId(null)}
                  onRename={(name) => rename(profile.id, name)}
                  onRecolor={() => recolor(profile.id)}
                  onRemove={() => remove(profile.id)}
                />
              ))}
              {saved.profiles.length < 5 && (
                <button type="button" className="profile-row add" onClick={add}>
                  <span className="profile-add-tile">+</span>
                  <span>Add Profile</span>
                </button>
              )}
              <div className="profile-menu-sep" />
              <button type="button" className="profile-link" onClick={() => setManaging(false)}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="profile-list">
                {others.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className="profile-row"
                    role="menuitem"
                    onClick={() => switchTo(profile.id)}
                  >
                    <Avatar profile={profile} size={30} />
                    <span>{profile.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="profile-row dim"
                  role="menuitem"
                  onClick={() => setManaging(true)}
                >
                  <span className="profile-row-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path
                        d="M4 20l4.5-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.5 16z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>Manage Profiles</span>
                </button>
              </div>
              <div className="profile-menu-sep" />
              <div className="profile-links">
                <button type="button" className="profile-link" role="menuitem" onClick={close}>
                  Account
                </button>
                <button type="button" className="profile-link" role="menuitem" onClick={close}>
                  Help Center
                </button>
              </div>
              <div className="profile-menu-sep" />
              <button type="button" className="profile-link signout" role="menuitem" onClick={close}>
                Sign out of {BRAND}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileEditor({
  profile,
  editing,
  canRemove,
  onEdit,
  onDone,
  onRename,
  onRecolor,
  onRemove,
}: {
  profile: Profile;
  editing: boolean;
  canRemove: boolean;
  onEdit: () => void;
  onDone: () => void;
  onRename: (name: string) => void;
  onRecolor: () => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  return (
    <div className="profile-row edit">
      <button
        type="button"
        className="profile-tile-btn"
        title="Change color"
        aria-label={`Change color for ${profile.name}`}
        onClick={onRecolor}
      >
        <Avatar profile={profile} size={30} />
      </button>
      {editing ? (
        <input
          ref={input}
          className="profile-input"
          defaultValue={profile.name}
          maxLength={24}
          onBlur={(event) => {
            onRename(event.currentTarget.value);
            onDone();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") onDone();
          }}
        />
      ) : (
        <button type="button" className="profile-name-btn" onClick={onEdit} title="Rename">
          {profile.name}
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          className="profile-remove"
          aria-label={`Remove ${profile.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}
