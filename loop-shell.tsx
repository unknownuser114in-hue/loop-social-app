"use client";

import Link from "next/link";
import { ArrowUpRight, Bell, Bookmark, ChevronDown, Compass, Ellipsis, House, LogOut, MessageCircle, Plus, Search, TrendingUp, UserRound, UserRoundPlus, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Place, Profile } from "@/lib/social";
import { Avatar, FollowButton, Logo } from "./loop-ui";

const nav = [
  { label: "Home", view: "home", icon: House },
  { label: "Explore", view: "explore", icon: Compass },
  { label: "Messages", view: "messages", icon: MessageCircle },
  { label: "Notifications", view: "notifications", icon: Bell },
  { label: "Bookmarks", view: "bookmarks", icon: Bookmark },
  { label: "My profile", view: "profile", icon: UserRound },
] as const;

type Common = { person: Profile; demo: boolean; go: (place: Place) => void; logout: () => void };
function AccountMenu({ person, demo, go, logout, variant }: Common & { variant: "side" | "header" }) {
  const [open, setOpen] = useState(false);
  return <div className={`menu-anchor account-anchor ${variant}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button className={variant === "side" ? "side-account identity" : "top-account"} type="button" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}>
      <Avatar person={person} size={variant === "side" ? 37 : 34} />
      {variant === "side" ? <><span className="side-account-name"><strong>{person.name}</strong><span className="side-user-meta"><span>@{person.handle}</span>{demo && <span className="side-demo">Demo</span>}</span></span><Ellipsis className="account-chevron" size={19} /></> : <ChevronDown className="account-chevron" size={14} />}
    </button>
    {open && <div className="dropdown account-dropdown">
      {demo && <p className="dropdown-caption">You’re in demo mode</p>}
      <button type="button" onClick={() => { go({ view: "profile" }); setOpen(false); }}><UserRound size={17} /> My profile</button>
      <button type="button" onClick={() => { go({ view: "bookmarks" }); setOpen(false); }}><Bookmark size={17} /> Bookmarks</button>
      {demo ? <Link href="/signup"><UserRoundPlus size={17} /> Create an account</Link> : <button type="button" onClick={() => { logout(); setOpen(false); }}><LogOut size={17} /> Sign out</button>}
      {demo && <Link href="/login"><ArrowUpRight size={17} /> Sign in</Link>}
    </div>}
  </div>;
}

export function Header({ person, demo, go, logout, people, unread }: Common & { people: Profile[]; unread: number }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(false);
  const [mobile, setMobile] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setMobile(true); requestAnimationFrame(() => input.current?.focus());
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const cleaned = query.toLowerCase().trim().replace(/^@/, "");
  const results = cleaned && !cleaned.startsWith("#") ? people.filter((row) => row.name.toLowerCase().includes(cleaned) || row.handle.includes(cleaned)).slice(0, 3) : [];
  function submit(event: FormEvent) {
    event.preventDefault(); go({ view: "explore", q: query.trim() }); setActive(false); setMobile(false); input.current?.blur();
  }
  return <header className="top-bar"><div className="top-inner">
    <Logo onClick={() => go({ view: "home" })} />
    <div className={`search-wrap${mobile ? " mobile-search-open" : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(false); }}>
      <form className="header-search" role="search" onSubmit={submit}>
        <Search size={19} /><input aria-label="Search people and posts" ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setActive(true); }} onFocus={() => setActive(true)} onKeyDown={(event) => { if (event.key === "Escape") { setActive(false); setMobile(false); input.current?.blur(); } }} placeholder="Search people, posts…" maxLength={120} />
        {query ? <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search"><X size={16} /></button> : <kbd>⌘ K</kbd>}
      </form>
      {active && query.trim() && <div className="dropdown search-results"><p className="dropdown-caption">Quick search</p>{results.map((result) => <button key={result.id} type="button" onClick={() => { go({ view: "profile", id: result.id }); setActive(false); setMobile(false); }}><Avatar person={result} size={32} /><span className="identity-text"><strong>{result.name}</strong><small>@{result.handle}</small></span><ArrowUpRight size={15} className="search-arrow" /></button>)}<button type="button" onClick={submit}><Search size={17} /><span className="search-query">Search for “{query.trim()}”</span></button></div>}
    </div>
    <div className="top-actions">
      <button type="button" className="icon-button mobile-search-toggle" aria-label={mobile ? "Close search" : "Open search"} onClick={() => { setMobile(!mobile); if (!mobile) requestAnimationFrame(() => input.current?.focus()); }}>{mobile ? <X size={20} /> : <Search size={20} />}</button>
      <button type="button" className="icon-button top-bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => go({ view: "notifications" })}><Bell size={21} />{unread > 0 && <i />}</button>
      <span className="top-divider" />
      {demo && <Link href="/login" className="header-sign-in">Sign in</Link>}
      <AccountMenu person={person} demo={demo} go={go} logout={logout} variant="header" />
    </div>
  </div></header>;
}

export function LeftRail({ person, demo, go, logout, place, unread, notices, onCreate }: Common & { place: Place; unread: number; notices: number; onCreate: () => void }) {
  return <aside className="left-rail"><div className="left-inner">
    <div><p className="rail-caption">MENU</p>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(({ label, view, icon: Icon }) => {
        const current = place.view === view && (view !== "profile" || !place.id || place.id === person.id);
        return <button key={view} type="button" className={current ? "active" : ""} aria-current={current ? "page" : undefined} onClick={() => go({ view })}><Icon size={21} strokeWidth={1.85} /><span>{label}</span>{view === "messages" && unread > 0 && <b className="nav-count">{unread > 9 ? "9+" : unread}</b>}{view === "notifications" && notices > 0 && <i className="nav-dot" />}</button>;
      })}</nav>
      <div className="left-create"><button type="button" className="primary-button" onClick={onCreate}><Plus size={20} strokeWidth={2.4} /> Create post</button></div>
    </div>
    <AccountMenu person={person} demo={demo} go={go} logout={logout} variant="side" />
  </div></aside>;
}

export function MobileDock({ place, go, onCreate, unread }: { place: Place; go: (place: Place) => void; onCreate: () => void; unread: number }) {
  return <nav className="mobile-dock" aria-label="Mobile navigation">
    {[nav[0], nav[1]].map(({ icon: Icon, view, label }) => <button type="button" key={view} className={place.view === view ? "active" : ""} aria-current={place.view === view ? "page" : undefined} onClick={() => go({ view })}><Icon size={22} /><span>{label}</span></button>)}
    <button type="button" className="mobile-create" onClick={onCreate} aria-label="Create post"><Plus size={24} /></button>
    {[nav[2], nav[5]].map(({ icon: Icon, view, label }) => <button type="button" key={view} className={place.view === view ? "active" : ""} aria-current={place.view === view ? "page" : undefined} onClick={() => go({ view })}><span className="mobile-icon"><Icon size={22}/>{view === "messages" && unread > 0 && <i />}</span><span>{view === "profile" ? "Profile" : label}</span></button>)}
  </nav>;
}

export type Trend = { category: string; tag: string; count: string };
export type InfoPage = "About" | "Guidelines" | "Privacy";
export function RightRail({ trends, suggestions, go, onFollow, onInfo }: { trends: readonly Trend[]; suggestions: Profile[]; go: (place: Place) => void; onFollow: (profile: Profile) => void; onInfo: (info: InfoPage) => void }) {
  return <aside className="right-rail" aria-label="Discover on Loop">
    <section className="panel discovery-panel">
      <div className="discovery-title"><h2><TrendingUp className="heading-icon" size={19} /> Trending now</h2></div>
      {trends.length ? <div className="trend-list">{trends.slice(0, 3).map(({ category, tag, count }) => <button type="button" className="trend-row" key={tag} onClick={() => go({ view: "explore", q: tag })}><span><small>{category} <i /> Trending</small><strong>{tag}</strong><span>{count}</span></span><ArrowUpRight size={16} className="trend-arrow" /></button>)}</div> : <p className="discovery-empty">Hashtags from new posts will show up here.</p>}
      <button type="button" className="discovery-link" onClick={() => go({ view: "explore" })}>Explore trends <ArrowUpRight size={14} /></button>
    </section>
    <section className="panel discovery-panel follow-panel">
      <div className="discovery-title"><h2><UsersRound className="heading-icon" size={19} /> Who to follow</h2><button type="button" className="text-button" onClick={() => go({ view: "explore" })}>See all</button></div>
      {suggestions.length ? <div className="suggestion-list">{suggestions.map((profile) => <div key={profile.id} className="suggestion-row"><button type="button" className="identity" onClick={() => go({ view: "profile", id: profile.id })}><Avatar person={profile} size={38} /><span className="identity-text"><strong>{profile.name}</strong><small>@{profile.handle}</small></span></button><FollowButton following={profile.followed} onClick={() => onFollow(profile)} /></div>)}</div> : <p className="discovery-empty">New people to follow will appear here.</p>}
    </section>
    <footer className="rail-footer"><div>{(["About", "Guidelines", "Privacy"] as const).map((info) => <button type="button" key={info} onClick={() => onInfo(info)}>{info}</button>)}</div><p>© {new Date().getFullYear()} Loop Social</p></footer>
  </aside>;
}
