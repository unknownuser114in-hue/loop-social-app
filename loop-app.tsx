"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, Check, ChevronRight, Compass, Flag, Hash, House, Link2, MessageSquarePlus, Plus, Search, Sparkles, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AVATAR_IDS, DEMO_VIEWER, FEATURED_POST, TRENDS, parsePlace, type Activity, type Conversation, type DirectMessage, type Place, type Post, type Profile, type Reply, type SocialData, type Story } from "@/lib/social";
import { Header, LeftRail, MobileDock, RightRail, type InfoPage, type Trend } from "./loop-shell";
import { Avatar, Composer, CreateDialog, Empty, Modal, PageIntro, PostCard, ProfileEditor, StoryRail, StoryViewer, type ComposeStart } from "./loop-ui";
import { ActivityList, Messenger, NoPeople, PeopleRows, ProfilePanel, RepliesPanel } from "./loop-views";

type Demo = {
  liked: string[]; saved: string[]; follows: string[]; shared: string[]; posts: Post[]; stories: Story[]; replies: Record<string, Reply[]>;
  messages: DirectMessage[]; readChats: string[]; readActivity: boolean; profile?: Profile;
};
const EMPTY_DEMO: Demo = { liked: [], saved: [], follows: [], shared: [], posts: [], stories: [], replies: {}, messages: [], readChats: [], readActivity: false };
const DEMO_STORAGE = "loop-local-preview-v1";
const sampleIndex = [AVATAR_IDS.jordan, AVATAR_IDS.sofia, AVATAR_IDS.noah, AVATAR_IDS.maya];
const containsChange = (values: string[], id: string, value: boolean) => value ? [...new Set([...values, id])] : values.filter((item) => item !== id);
const timestamp = () => new Date().toISOString();
const localId = () => `demo-${crypto.randomUUID()}`;
const before = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
function demoMessages(): DirectMessage[] {
  return [
    { id: "sample-chat-1", senderId: AVATAR_IDS.alex, recipientId: AVATAR_IDS.jordan, body: "I’m trying to find that little camera shop again. Do you remember the name?", createdAt: before(152), readAt: before(129) },
    { id: "sample-chat-2", senderId: AVATAR_IDS.jordan, recipientId: AVATAR_IDS.alex, body: "Yes! I’ll send you the address. They had some great film cameras in the window 📷", createdAt: before(42), readAt: null },
    { id: "sample-chat-3", senderId: AVATAR_IDS.sofia, recipientId: AVATAR_IDS.alex, body: "Hey Alex, thanks for the book recommendation! 🤍", createdAt: before(154), readAt: null },
  ];
}
function demoActivity(): Activity[] {
  return [
    { id: "sample-event-1", actorId: AVATAR_IDS.sofia, kind: "follow", postId: null, createdAt: before(65), readAt: null },
    { id: "sample-event-2", actorId: AVATAR_IDS.noah, kind: "like", postId: FEATURED_POST, createdAt: before(210), readAt: before(150) },
  ];
}
const help: Record<InfoPage, { label: string; text: string }> = {
  About: { label: "A little closer, every day.", text: "Loop is a place to share everyday moments and keep in touch with your people. You can try the feed without an account. Demo changes stay in your browser; create an account to post publicly and chat with other members." },
  Guidelines: { label: "Make space for good conversations.", text: "Be respectful, get permission before sharing someone else’s stories, and don’t post personal information without consent. If a post crosses a line, use its options menu to report it." },
  Privacy: { label: "Know what you’re sharing.", text: "Profiles, posts, and active stories on Loop are public. Direct messages are available to the sender and recipient. Your email is not shown on your profile. Demo actions are stored only in the browser you’re using." },
};

type Overlay = { type: "create"; start: ComposeStart } | { type: "story"; id: string } | { type: "edit" } | { type: "info"; key: InfoPage } | { type: "new-chat" } | { type: "share"; url: string }
  | { type: "moderate"; postId: string; mode: "delete" | "report" }
  | { type: "network"; personId: string; mode: "followers" | "following"; people: Profile[] | null; error?: string };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data as T;
}
const api = <T,>(kind: string, id?: string) => json<T>(`/api/social?${new URLSearchParams({ kind, ...(id ? { id } : {}) })}`);
const change = <T = Record<string, unknown>,>(body: Record<string, unknown>) => json<T>("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function saveFile(action: string, fields: Record<string, string>, file: File | null) {
  const form = new FormData(); form.set("action", action);
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  if (file) form.set("file", file);
  await json("/api/social", { method: "POST", body: form });
}
function asDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Couldn’t read that attachment.")); reader.readAsDataURL(file);
  });
}
function placeSearch(place: Place) {
  const params = new URLSearchParams();
  if (place.view === "post" && place.id) params.set("post", place.id);
  else if (place.view !== "home") params.set("view", place.view);
  if (place.view === "profile" && place.id) params.set("user", place.id);
  if (place.view === "messages" && place.id) params.set("chat", place.id);
  if (place.view === "explore" && place.q) params.set("q", place.q);
  return params.size ? `?${params}` : "";
}

function ExploreSearch({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  const [input, setInput] = useState(query);
  return <form className="panel explore-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(input.trim()); }}><Search size={20} /><input aria-label="Search on Explore" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search people, posts, or #hashtags" maxLength={120} />{input && <button className="icon-button" type="button" aria-label="Clear filters" onClick={() => { setInput(""); onSearch(""); }}><X size={17} /></button>}<button className="primary-button" type="submit">Search</button></form>;
}

function Moderate({ report, onSubmit, onClose }: { report: boolean; onSubmit: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handle(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSubmit(reason); } catch (err) { setError(err instanceof Error ? err.message : "Try again in a moment."); setBusy(false); }
  }
  return <Modal title={report ? "Report post" : "Delete this post?"} onClose={() => { if (!busy) onClose(); }}><form className="modal-body confirm-form" onSubmit={handle}>
    <p>{report ? "Tell us why you’re reporting this post. The author won’t see who reported it." : "The post and its comments will be removed. This can’t be undone."}</p>
    {report && <label className="stack-label">Reason<textarea placeholder="Describe what happened" maxLength={250} rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="confirm-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className={report ? "primary-button" : "danger-button"} type="submit" disabled={busy || (report && !reason.trim())}>{busy ? "One moment…" : report ? "Send report" : "Delete post"}</button></div>
  </form></Modal>;
}

export default function LoopApp({ initial, initialPlace }: { initial: SocialData; initialPlace: Place }) {
  const [data, setData] = useState(initial);
  const [demo, setDemo] = useState(EMPTY_DEMO);
  const [demoReady, setDemoReady] = useState(false);
  const [place, setPlace] = useState(initialPlace);
  const placeRef = useRef(place);
  const [tab, setTab] = useState<"for-you" | "following">("for-you");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefresh = useRef(0), revision = useRef(0);
  const inFlight = useRef(new Set<string>());
  const [commentId, setCommentId] = useState("");
  const [replyCache, setReplyCache] = useState<Record<string, Reply[]>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threads, setThreads] = useState<Record<string, DirectMessage[]>>({});
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [chatVersion, setChatVersion] = useState(0);
  const [events, setEvents] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [sampleMessages] = useState(demoMessages);
  const [sampleActivity] = useState(demoActivity);

  const guest = !data.viewer;
  const viewer = data.viewer || demo.profile || DEMO_VIEWER;
  const currentPersonId = place.view === "messages" ? place.id : undefined;
  const hasSample = data.people.some((person) => person.sample);
  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message); toastTimer.current = setTimeout(() => setToast(""), 3900);
  }, []);
  const showError = useCallback((error: unknown) => notify(error instanceof Error ? error.message : "Something went wrong. Try again."), [notify]);
  const patch = useCallback((updater: (current: SocialData) => SocialData) => { revision.current++; setData(updater); }, []);

  useEffect(() => {
    const task = requestAnimationFrame(() => {
      try { const old = localStorage.getItem(DEMO_STORAGE); if (old) setDemo({ ...EMPTY_DEMO, ...JSON.parse(old) }); } catch { /* no saved demo */ }
      setDemoReady(true);
    });
    return () => cancelAnimationFrame(task);
  }, []);
  useEffect(() => {
    if (!demoReady || !guest) return;
    try { localStorage.setItem(DEMO_STORAGE, JSON.stringify(demo)); } catch { notify("Browser storage is full. New demo changes may not survive a reload."); }
  }, [demo, demoReady, guest, notify]);

  const refresh = useCallback(async (target: Place) => {
    const key = ++lastRefresh.current, before = revision.current;
    const next = await json<SocialData>(`/api/social${placeSearch(target)}`);
    if (lastRefresh.current === key && before === revision.current) setData(next);
  }, []);
  useEffect(() => {
    function popped() {
      const next = parsePlace(Object.fromEntries(new URLSearchParams(location.search)));
      setPlace(next); placeRef.current = next; setOverlay(null);
    }
    window.addEventListener("popstate", popped);
    return () => window.removeEventListener("popstate", popped);
  }, []);
  useEffect(() => {
    if (place.view === "post" && !place.id?.startsWith("demo-") || (place.view === "profile" && !guest) || (place.view === "bookmarks" && !guest) || (place.view === "messages" && !!place.id && !guest)) {
      void refresh(place).catch(showError);
    }
  }, [place, guest, refresh, showError]);
  useEffect(() => {
    const sync = () => { if (document.visibilityState === "visible") void refresh(placeRef.current).catch(() => {}); };
    const timer = setInterval(sync, 32_000);
    document.addEventListener("visibilitychange", sync);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", sync); };
  }, [refresh]);

  function go(target: Place, noScroll = false) {
    const query = placeSearch(target);
    if (location.search !== query) window.history.pushState(null, "", `/${query}`);
    placeRef.current = target; setPlace(target); setOverlay(null);
    if (!noScroll) window.scrollTo({ top: 0, behavior: "instant" });
  }
  const openPerson = (id: string) => go({ view: "profile", id });
  const openTag = (q: string) => go({ view: "explore", q });
  const openCreate = (start: ComposeStart) => setOverlay({ type: "create", start });
  const people = useMemo(() => {
    const mapped = new Map(data.people.map((person) => {
      if (!guest) return [person.id, person];
      const followed = demo.follows.includes(person.id);
      return [person.id, { ...person, followed, followers: person.followers + Number(followed) }];
    }));
    mapped.set(viewer.id, guest ? { ...viewer, following: demo.follows.length } : viewer);
    return mapped;
  }, [data.people, guest, viewer, demo.follows]);
  const currentViewer = people.get(viewer.id) || viewer;
  const roster = [...people.values()];
  const others = roster.filter((person) => person.id !== viewer.id);
  const suggestions = [...others].sort((a, b) => Number(a.sample) - Number(b.sample) || (a.sample && b.sample ? sampleIndex.indexOf(a.id) - sampleIndex.indexOf(b.id) : 0)).slice(0, 3);
  const posts = guest ? [...demo.posts, ...data.posts].map((post) => ({ ...post, liked: demo.liked.includes(post.id), saved: demo.saved.includes(post.id), likes: post.likes + Number(demo.liked.includes(post.id)), replies: post.replies + (demo.replies[post.id]?.length || 0), shares: post.shares + Number(demo.shared.includes(post.id)) })) : data.posts;
  const stories = [...(guest ? demo.stories : []), ...data.stories].filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > Date.now());
  const trends = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of data.posts) {
      if (people.get(post.authorId)?.sample) continue;
      for (const tag of new Set(post.body.match(/#[\p{L}\p{N}_]+/gu) || [])) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    const realTrends: Trend[] = [...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ category: "On Loop", tag, count: `${n} ${n === 1 ? "post" : "posts"}` }));
    return [...realTrends, ...(hasSample ? TRENDS.filter((trend) => !counts.has(trend.tag)) : [])].slice(0, 4);
  }, [data.posts, people, hasSample]);

  const localMessages = [...(hasSample ? sampleMessages : []), ...demo.messages];
  const demoInbox = new Map<string, Conversation>();
  for (const message of localMessages) {
    const personId = message.senderId === viewer.id ? message.recipientId : message.senderId;
    const previous = demoInbox.get(personId);
    const later = !previous || message.createdAt >= previous.at;
    demoInbox.set(personId, { personId, at: later ? message.createdAt : previous.at, snippet: later ? message.body : previous.snippet, unread: (previous?.unread || 0) + Number(message.senderId !== viewer.id && !message.readAt && !demo.readChats.includes(personId)) });
  }
  const inbox = guest ? [...demoInbox.values()].sort((a, b) => b.at.localeCompare(a.at)) : conversations;
  const unread = guest ? inbox.reduce((sum, item) => sum + item.unread, 0) : data.unreadMessages;
  const activity = guest && hasSample ? sampleActivity.map((event) => demo.readActivity ? { ...event, readAt: event.createdAt } : event) : guest ? [] : events;
  const notices = guest ? activity.filter((event) => !event.readAt).length : data.unreadNotifications;

  const loadReplies = useCallback(async (id: string) => {
    if (id.startsWith("demo-")) return;
    setReplyLoading((value) => ({ ...value, [id]: true })); setReplyErrors((value) => ({ ...value, [id]: "" }));
    try {
      const list = await api<Reply[]>("replies", id);
      setReplyCache((value) => ({ ...value, [id]: list }));
    } catch (error) {
      setReplyErrors((value) => ({ ...value, [id]: error instanceof Error ? error.message : "Couldn’t load comments." }));
    } finally { setReplyLoading((value) => ({ ...value, [id]: false })); }
  }, []);
  useEffect(() => {
    if (place.view === "post" && place.id) { const id = place.id; const task = requestAnimationFrame(() => void loadReplies(id)); return () => cancelAnimationFrame(task); }
  }, [place.view, place.id, loadReplies]);

  useEffect(() => {
    if (guest || place.view !== "messages") return;
    let live = true, pending = false;
    async function sync() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const [items, thread] = await Promise.all([api<Conversation[]>("inbox"), currentPersonId ? api<DirectMessage[]>("chat", currentPersonId) : Promise.resolve([])]);
        const inThread = items.find((item) => item.personId === currentPersonId)?.unread || 0;
        if (live && inThread) await change({ action: "read-chat", id: currentPersonId });
        if (!live) return;
        const seen = inThread ? items.map((item) => item.personId === currentPersonId ? { ...item, unread: 0 } : item) : items;
        if (currentPersonId) setThreads((value) => ({ ...value, [currentPersonId]: thread }));
        setConversations(seen); setChatError("");
        setData((current) => ({ ...current, unreadMessages: seen.reduce((sum, item) => sum + item.unread, 0) }));
      } catch (error) { if (live) setChatError(error instanceof Error ? error.message : "Couldn’t load messages."); }
      finally { pending = false; if (live) setChatLoading(false); }
    }
    void sync(); const timer = setInterval(sync, 4_500);
    return () => { live = false; clearInterval(timer); };
  }, [guest, place.view, currentPersonId, chatVersion]);
  useEffect(() => {
    if (!guest || !currentPersonId) return;
    const task = requestAnimationFrame(() => setDemo((value) => value.readChats.includes(currentPersonId) ? value : { ...value, readChats: [...value.readChats, currentPersonId] }));
    return () => cancelAnimationFrame(task);
  }, [guest, currentPersonId]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true); setActivityError("");
    try {
      const result = await api<Activity[]>("activity"); setEvents(result);
      setData((current) => ({ ...current, unreadNotifications: result.filter((event) => !event.readAt).length }));
    } catch (error) { setActivityError(error instanceof Error ? error.message : "Couldn’t load activity."); }
    finally { setActivityLoading(false); }
  }, []);
  useEffect(() => {
    if (guest || place.view !== "notifications") return;
    const task = requestAnimationFrame(() => void loadActivity());
    const timer = setInterval(() => { if (document.visibilityState === "visible") void loadActivity(); }, 18_000);
    return () => { cancelAnimationFrame(task); clearInterval(timer); };
  }, [guest, place.view, loadActivity]);

  async function protectedAction(key: string, work: () => Promise<void>) {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    try { await work(); } catch (error) { showError(error); } finally { inFlight.current.delete(key); }
  }
  function follow(person: Profile) {
    if (person.id === viewer.id) return;
    const next = !person.followed;
    const apply = (profile: Profile) => profile.id === person.id ? { ...profile, followed: next, followers: Math.max(0, profile.followers + (next ? 1 : -1)) } : profile;
    if (guest) setDemo((value) => ({ ...value, follows: containsChange(value.follows, person.id, !value.follows.includes(person.id)) }));
    else void protectedAction(`follow-${person.id}`, async () => {
      await change({ action: "follow", id: person.id, value: next });
      patch((value) => ({ ...value, people: value.people.map(apply), viewer: value.viewer ? { ...value.viewer, following: Math.max(0, value.viewer.following + (next ? 1 : -1)) } : null }));
      setOverlay((value) => value?.type === "network" && value.people ? { ...value, people: value.people.map(apply) } : value);
    });
  }
  function like(post: Post) {
    if (guest) { setDemo((value) => ({ ...value, liked: containsChange(value.liked, post.id, !value.liked.includes(post.id)) })); return; }
    const next = !post.liked;
    void protectedAction(`like-${post.id}`, async () => {
      await change({ action: "like", id: post.id, value: next });
      patch((value) => ({ ...value, posts: value.posts.map((item) => item.id === post.id ? { ...item, liked: next, likes: item.likes + (item.liked === next ? 0 : next ? 1 : -1) } : item) }));
    });
  }
  function bookmark(post: Post) {
    if (guest) {
      setDemo((value) => ({ ...value, saved: containsChange(value.saved, post.id, !value.saved.includes(post.id)) }));
      notify(post.saved ? "Removed from bookmarks." : "Saved to your bookmarks."); return;
    }
    void protectedAction(`save-${post.id}`, async () => {
      await change({ action: "bookmark", id: post.id, value: !post.saved });
      patch((value) => ({ ...value, posts: value.posts.map((item) => item.id === post.id ? { ...item, saved: !post.saved } : item) }));
      notify(post.saved ? "Removed from bookmarks." : "Saved to your bookmarks.");
    });
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); notify("Link copied to clipboard."); }
    catch { setOverlay({ type: "share", url }); }
  }
  function share(post: Post) {
    if (post.id.startsWith("demo-")) { notify("Demo posts stay in this browser. Create an account to share with friends."); return; }
    void copy(`${location.origin}/?post=${post.id}`);
    if (guest) setDemo((value) => ({ ...value, shared: containsChange(value.shared, post.id, true) }));
    else void change({ action: "share", id: post.id }).then(() => refresh(placeRef.current)).catch(() => {});
  }
  async function addReply(id: string, body: string) {
    try {
      if (guest) {
        const reply: Reply = { id: localId(), authorId: viewer.id, body, createdAt: timestamp() };
        setDemo((value) => ({ ...value, replies: { ...value.replies, [id]: [...(value.replies[id] || []), reply] } }));
      } else {
        const { item } = await change<{ item: Reply }>({ action: "reply", id, body });
        setReplyCache((value) => ({ ...value, [id]: [...(value[id] || []), item] }));
        patch((value) => ({ ...value, posts: value.posts.map((post) => post.id === id ? { ...post, replies: post.replies + 1 } : post) }));
      }
    } catch (error) { showError(error); throw error; }
  }
  async function publish(story: boolean, body: string, file: File | null) {
    if (guest) {
      const media = file ? await asDataURL(file) : null;
      const base = { id: localId(), authorId: viewer.id, body, createdAt: timestamp() };
      if (story && media) setDemo((value) => ({ ...value, stories: [{ ...base, media, expiresAt: new Date(Date.now() + 86400000).toISOString() }, ...value.stories] }));
      else if (!story) setDemo((value) => ({ ...value, posts: [{ ...base, media, mediaKind: file ? (file.type.startsWith("video/") ? "video" : "image") : null, likes: 0, replies: 0, shares: 0, liked: false, saved: false }, ...value.posts] }));
    } else {
      await saveFile(story ? "story" : "post", { body }, file);
      await refresh({ view: "home" });
    }
    go({ view: "home" }); setTab("for-you"); setOverlay(null);
    notify(story ? "Your story is up!" : "Your post is live!");
  }
  async function editProfile(name: string, bio: string, file: File | null) {
    if (guest) {
      if (file && !file.type.startsWith("image/")) throw new Error("Choose a supported image.");
      const avatar = file ? await asDataURL(file) : viewer.avatar;
      setDemo((value) => ({ ...value, profile: { ...viewer, name, bio, avatar } }));
    } else { await saveFile("profile", { name, bio }, file); await refresh(placeRef.current); }
    setOverlay(null); notify("Profile updated.");
  }
  async function moderation(postId: string, mode: "delete" | "report", reason: string) {
    if (mode === "delete") {
      if (guest) setDemo((value) => ({ ...value, posts: value.posts.filter((post) => post.id !== postId) }));
      else { await change({ action: "delete-post", id: postId }); patch((value) => ({ ...value, posts: value.posts.filter((post) => post.id !== postId) })); }
      if (place.view === "post") go({ view: "home" });
    } else { await change({ action: "report", id: postId, body: reason }); }
    setOverlay(null); notify(mode === "delete" ? "Post deleted." : "Report submitted.");
  }
  function report(post: Post) {
    if (guest) { notify("Sign in to submit a report."); return; }
    setOverlay({ type: "moderate", postId: post.id, mode: "report" });
  }
  async function seeNetwork(person: Profile, mode: "followers" | "following") {
    if (guest && person.id === viewer.id) {
      setOverlay({ type: "network", personId: person.id, mode, people: mode === "followers" ? [] : others.filter((row) => row.followed) }); return;
    }
    setOverlay({ type: "network", personId: person.id, mode, people: null });
    try {
      const rows = await json<Profile[]>(`/api/social?${new URLSearchParams({ kind: "network", id: person.id, mode })}`);
      setOverlay((value) => value?.type === "network" && value.personId === person.id && value.mode === mode ? { ...value, people: rows } : value);
    } catch (error) { setOverlay((value) => value?.type === "network" && value.personId === person.id && value.mode === mode ? { ...value, error: error instanceof Error ? error.message : "Couldn’t load people." } : value); }
  }
  function chooseChat(id?: string) {
    if (id) {
      if (guest && !people.get(id)?.sample) { notify("Sign in to message this person."); return; }
      if (!guest && people.get(id)?.sample) { notify("This is a sample profile. Invite a friend to start a real chat."); return; }
      if (!threads[id] && !guest) setChatLoading(true);
    }
    go({ view: "messages", id }, true);
  }
  async function sendMessage(body: string) {
    if (!currentPersonId) return;
    const id = currentPersonId;
    try {
      if (guest) {
        if (!people.get(id)?.sample) throw new Error("Sign in to message this person.");
        const item: DirectMessage = { id: localId(), senderId: viewer.id, recipientId: id, body, createdAt: timestamp(), readAt: null };
        setDemo((value) => ({ ...value, messages: [...value.messages, item] }));
      } else {
        const { item } = await change<{ item: DirectMessage }>({ action: "send", id, body });
        setThreads((value) => ({ ...value, [id]: [...(value[id] || []), item] })); setChatVersion((value) => value + 1);
      }
    } catch (error) { showError(error); throw error; }
  }
  function markActivity() {
    if (guest) { setDemo((value) => ({ ...value, readActivity: true })); return; }
    void protectedAction("read-notifications", async () => {
      await change({ action: "read-notifications" });
      setEvents((value) => value.map((event) => ({ ...event, readAt: event.readAt || timestamp() })));
      patch((current) => ({ ...current, unreadNotifications: 0 }));
    });
  }
  function signOut() {
    void protectedAction("logout", async () => {
      await json("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      // Drop the previous account’s client state and router cache on sign-out.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  }

  const close = () => setOverlay(null);
  const storyIndex = overlay?.type === "story" ? stories.findIndex((story) => story.id === overlay.id) : -1;
  const story = storyIndex >= 0 ? stories[storyIndex] : undefined;
  const selectedProfile = place.view === "profile" ? people.get(place.id || viewer.id) : undefined;
  const chosenPost = place.view === "post" ? posts.find((post) => post.id === place.id) : undefined;
  const followingPosts = posts.filter((post) => post.authorId === viewer.id || people.get(post.authorId)?.followed);
  const q = place.q?.trim() || "", query = q.toLowerCase(), peopleQuery = query.replace(/^@/, "");
  const discoverPeople = q ? others.filter((person) => !query.startsWith("#") && (person.name.toLowerCase().includes(peopleQuery) || person.handle.includes(peopleQuery))) : others;
  const discoverPosts = q ? posts.filter((post) => post.body.toLowerCase().includes(query) || people.get(post.authorId)?.name.toLowerCase().includes(peopleQuery) || people.get(post.authorId)?.handle.includes(peopleQuery)) : posts;

  function renderPost(post: Post) {
    const sharedOpen = place.view === "post" && place.id === post.id;
    const repliesOpen = commentId === post.id || (sharedOpen && commentId !== `closed-${post.id}`);
    return <PostCard post={post} key={post.id} author={people.get(post.authorId)} own={post.authorId === viewer.id} onProfile={() => openPerson(post.authorId)} onTag={openTag} onLike={() => like(post)} onReply={() => {
      setCommentId(repliesOpen ? (sharedOpen ? `closed-${post.id}` : "") : post.id);
      if (!repliesOpen) void loadReplies(post.id);
    }} onShare={() => share(post)} onSave={() => bookmark(post)} onDelete={() => setOverlay({ type: "moderate", postId: post.id, mode: "delete" })} onReport={() => report(post)}>
      {repliesOpen && <RepliesPanel viewer={currentViewer} people={people} replies={[...(replyCache[post.id] || []), ...(guest ? demo.replies[post.id] || [] : [])]} loading={!!replyLoading[post.id]} error={replyErrors[post.id]} onRetry={() => void loadReplies(post.id)} onProfile={openPerson} onSend={(value) => addReply(post.id, value)} />}
    </PostCard>;
  }

  return <>
    <a className="skip-link" href="#main-content">Skip to feed</a>
    <Header person={currentViewer} demo={guest} go={go} logout={signOut} people={roster} unread={notices} />
    <div className="app-grid">
      <LeftRail person={currentViewer} demo={guest} go={go} logout={signOut} place={place} unread={unread} notices={notices} onCreate={() => openCreate("text")} />
      <main className="center-column" id="main-content">
        {place.view === "home" && <>
          <PageIntro title="Your feed" subtitle="See what’s happening in your circle."><div className="feed-tabs" aria-label="Feed filter"><button type="button" className={tab === "for-you" ? "active" : ""} aria-pressed={tab === "for-you"} onClick={() => setTab("for-you")}>For you</button><button type="button" className={tab === "following" ? "active" : ""} aria-pressed={tab === "following"} onClick={() => setTab("following")}>Following</button></div></PageIntro>
          <StoryRail stories={stories} people={people} viewer={currentViewer} onCreate={() => openCreate("story")} onOpen={(id) => setOverlay({ type: "story", id })} />
          <Composer viewer={currentViewer} open={openCreate} />
          <div className="post-stack">{(tab === "for-you" ? posts : followingPosts).map(renderPost)}
            {tab === "following" && !followingPosts.length && <Empty icon={UsersRound} title="Build your circle" text="Follow people to see their newest posts in this feed."><button className="secondary-button" type="button" onClick={() => go({ view: "explore" })}>Find people <ArrowRight size={16} /></button></Empty>}
            {tab === "for-you" && !posts.length && <Empty icon={House} title="The feed starts with you" text="Share your first post, or invite a friend to get the conversation going."><button type="button" className="secondary-button" onClick={() => openCreate("text")}><Plus size={17} /> Create a post</button></Empty>}
          </div>
        </>}
        {place.view === "explore" && <>
          <PageIntro title="Explore" subtitle="Find new people, ideas, and conversations." />
          <ExploreSearch key={q} query={q} onSearch={openTag} />
          {trends.length > 0 && <div className="explore-tags">{trends.map((trend) => <button type="button" key={trend.tag} aria-pressed={query === trend.tag.toLowerCase()} onClick={() => openTag(query === trend.tag.toLowerCase() ? "" : trend.tag)}><Hash size={15} />{trend.tag.slice(1)}</button>)}</div>}
          {!!discoverPeople.length && <section className="panel explore-people"><h2>{q ? "People" : "Discover people"}</h2><PeopleRows people={discoverPeople.slice(0, 20)} viewer={currentViewer} onProfile={openPerson} onFollow={follow} /></section>}
          {!!discoverPosts.length && <div className="post-stack"><h2 className="section-label">{q ? `Posts for “${q}”` : "Recent posts"}</h2>{discoverPosts.map(renderPost)}</div>}
          {!discoverPosts.length && !discoverPeople.length && <Empty icon={Compass} title={q ? "No matches found" : "Nothing to discover yet"} text={q ? "Try a different name, keyword, or hashtag." : "New people and popular topics will appear here."} />}
        </>}
        {place.view === "bookmarks" && <>
          <PageIntro title="Bookmarks" subtitle="Keep the good stuff to come back to later." />
          <div className="post-stack">{posts.filter((post) => post.saved).map(renderPost)}</div>
          {!posts.some((post) => post.saved) && <Empty icon={Bookmark} title="No bookmarks yet" text="Tap the bookmark icon on a post to save it here."><button className="secondary-button" type="button" onClick={() => go({ view: "home" })}>Back to feed <ArrowRight size={16} /></button></Empty>}
        </>}
        {place.view === "profile" && <>
          <PageIntro title={selectedProfile?.id === viewer.id ? "My profile" : "Profile"} back={() => go({ view: "home" })} />
          {selectedProfile ? <><ProfilePanel profile={selectedProfile} viewer={currentViewer} demo={guest} postCount={posts.filter((post) => post.authorId === selectedProfile.id).length} onFollow={() => follow(selectedProfile)} onEdit={() => setOverlay({ type: "edit" })} onSend={() => chooseChat(selectedProfile.id)} onNetwork={(mode) => void seeNetwork(selectedProfile, mode)} />
            <div className="post-stack"><h2 className="section-label">{selectedProfile.id === viewer.id ? "Your posts" : `${selectedProfile.name.split(" ")[0]}’s posts`}</h2>{posts.filter((post) => post.authorId === selectedProfile.id).map(renderPost)}{!posts.some((post) => post.authorId === selectedProfile.id) && <Empty icon={House} title="No posts yet" text={selectedProfile.id === viewer.id ? "Your first post will show up here." : "Check back for new posts."}>{selectedProfile.id === viewer.id && <button className="secondary-button" type="button" onClick={() => openCreate("text")}>Write your first post</button>}</Empty>}</div>
          </> : <Empty icon={UsersRound} title="Profile not found" text="This profile may no longer be available." />}
        </>}
        {place.view === "post" && <>
          <PageIntro title="Post" back={() => go({ view: "home" })} />
          {chosenPost ? renderPost(chosenPost) : <Empty icon={Flag} title="Post unavailable" text="This post may have been removed or the link may be incomplete." />}
        </>}
        {place.view === "messages" && <>
          <PageIntro title="Messages" subtitle="Keep the conversation going."><button className="secondary-button intro-action" type="button" onClick={() => setOverlay({ type: "new-chat" })}><MessageSquarePlus size={17} /> New message</button></PageIntro>
          {guest && <div className="demo-note"><Sparkles size={17} /><span>Demo inbox. Messages stay in this browser.</span><Link href="/signup">Create an account <ChevronRight size={15} /></Link></div>}
          <Messenger viewer={currentViewer} people={people} conversations={inbox} personId={currentPersonId} loading={!guest && chatLoading} error={guest ? "" : chatError} onRetry={() => { setChatLoading(true); setChatVersion((value) => value + 1); }} onChoose={chooseChat} onNew={() => setOverlay({ type: "new-chat" })} onProfile={openPerson} onSend={sendMessage} thread={currentPersonId ? guest ? localMessages.filter((message) => message.senderId === currentPersonId || message.recipientId === currentPersonId) : threads[currentPersonId] || [] : []} />
        </>}
        {place.view === "notifications" && <>
          <PageIntro title="Notifications" subtitle="See what you’ve missed.">{notices > 0 && <button type="button" className="secondary-button intro-action" onClick={markActivity}><Check size={17} /> Mark all read</button>}</PageIntro>
          <ActivityList events={activity} people={people} loading={!guest && activityLoading} error={guest ? "" : activityError} onRetry={() => void loadActivity()} onOpen={(event) => { markActivity(); if (event.postId) go({ view: "post", id: event.postId }); else openPerson(event.actorId); }} />
        </>}
      </main>
      <RightRail trends={trends} suggestions={suggestions} go={go} onFollow={follow} onInfo={(key) => setOverlay({ type: "info", key })} />
    </div>
    <MobileDock place={place} go={go} onCreate={() => openCreate("text")} unread={unread} />
    {overlay?.type === "create" && <CreateDialog key={overlay.start} start={overlay.start} viewer={currentViewer} demo={guest} close={close} submit={(body, file) => publish(overlay.start === "story", body, file)} />}
    {story && <StoryViewer story={story} person={people.get(story.authorId)} index={storyIndex} total={stories.length} close={close} step={(direction) => {
      const i = storyIndex + direction;
      if (i >= stories.length) close(); else if (i >= 0) setOverlay({ type: "story", id: stories[i].id });
    }} />}
    {overlay?.type === "edit" && <ProfileEditor viewer={currentViewer} demo={guest} close={close} submit={editProfile} />}
    {overlay?.type === "moderate" && <Moderate report={overlay.mode === "report"} onClose={close} onSubmit={(reason) => moderation(overlay.postId, overlay.mode, reason)} />}
    {overlay?.type === "info" && <Modal title={overlay.key === "Guidelines" ? "Community guidelines" : overlay.key === "About" ? "About Loop" : "Privacy"} onClose={close}><div className="modal-body info-body"><h3>{help[overlay.key].label}</h3><p>{help[overlay.key].text}</p>{guest && overlay.key === "About" && <Link className="primary-button" href="/signup">Create an account <ArrowRight size={16} /></Link>}</div></Modal>}
    {overlay?.type === "share" && <Modal title="Share link" onClose={close}><div className="modal-body info-body"><p>Copy this link to share it with someone.</p><label className="stack-label">Link<input readOnly value={overlay.url} onFocus={(event) => event.target.select()} /></label></div></Modal>}
    {overlay?.type === "network" && <Modal title={overlay.mode === "followers" ? "Followers" : "Following"} onClose={close}><div className="modal-body list-modal">
      {overlay.error ? <p className="muted">{overlay.error}</p> : overlay.people ? (overlay.people.length ? <PeopleRows people={overlay.people.map((person) => people.get(person.id) || person)} viewer={currentViewer} onProfile={openPerson} onFollow={follow} /> : <NoPeople text={overlay.mode === "followers" ? "No followers yet." : "No followed accounts yet."} />) : <p className="muted">Loading people…</p>}
    </div></Modal>}
    {overlay?.type === "new-chat" && <Modal title="New message" onClose={close}><div className="modal-body list-modal new-chat-list">
      {others.filter((profile) => guest ? profile.sample : !profile.sample).map((profile) => <button key={profile.id} type="button" className="new-chat-row" onClick={() => chooseChat(profile.id)}><Avatar person={profile} size={41} /><span className="identity-text"><strong>{profile.name}</strong><small>@{profile.handle}</small></span><ChevronRight size={18} /></button>)}
      {!others.some((profile) => guest ? profile.sample : !profile.sample) && <><NoPeople text="No other members to message yet. Invite a friend to join you on Loop." /><button type="button" className="secondary-button" onClick={() => void copy(`${location.origin}/signup`)}><Link2 size={16} /> Copy invite link</button></>}
    </div></Modal>}
    {toast && <div className="toast" role="status"><span className="toast-mark"><Check size={15} /></span><span>{toast}</span><button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={16} /></button></div>}
  </>;
}
