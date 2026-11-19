"use client";

import { ArrowLeft, Bell, Check, ChevronRight, CircleCheck, Heart, MessageCircle, MessageSquarePlus, Pencil, Send, UsersRound, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { compactCount, relativeTime, type Activity, type Conversation, type DirectMessage, type Profile, type Reply } from "@/lib/social";
import { Avatar, Empty, FollowButton } from "./loop-ui";

export function PeopleRows({ people, viewer, onProfile, onFollow }: { people: Profile[]; viewer: Profile; onProfile: (id: string) => void; onFollow: (profile: Profile) => void }) {
  return <div className="people-list">{people.map((person) => <div className="people-row" key={person.id}>
    <button type="button" className="identity" onClick={() => onProfile(person.id)}><Avatar size={43} person={person} /><span className="identity-text"><strong>{person.name}{person.id === viewer.id && <span className="you-label"> · You</span>}</strong><small>@{person.handle}</small></span></button>
    {person.id !== viewer.id && <FollowButton following={person.followed} onClick={() => onFollow(person)} />}
  </div>)}</div>;
}

export function ProfilePanel({ profile, viewer, postCount, onFollow, onEdit, onSend, onNetwork, demo }: { profile: Profile; viewer: Profile; postCount: number; onFollow: () => void; onEdit: () => void; onSend: () => void; onNetwork: (mode: "followers" | "following") => void; demo: boolean }) {
  const own = profile.id === viewer.id;
  return <section className="panel profile-panel">
    <div className="profile-cover"><span>@{profile.handle}</span></div>
    <div className="profile-main"><div className="profile-top"><span className="profile-avatar"><Avatar size={83} person={profile} /></span><div className="profile-buttons">
      {own ? <button className="secondary-button" type="button" onClick={onEdit}><Pencil size={16} /> Edit profile</button> : <>{(!profile.sample || demo) && <button className="secondary-button" type="button" onClick={onSend}><MessageCircle size={17} /> <span>Message</span></button>}<FollowButton following={profile.followed} onClick={onFollow} /></>}
    </div></div>
    <div className="profile-name"><h2>{profile.name}</h2>{profile.sample && <span className="tiny-badge">{own ? "Demo" : "Sample"}</span>}</div><p className="profile-handle">@{profile.handle}</p>
    {profile.bio && <p className="profile-bio">{profile.bio}</p>}
    <div className="profile-stats"><span><strong>{compactCount(postCount)}</strong> Posts</span><button onClick={() => onNetwork("followers")} type="button"><strong>{compactCount(profile.followers)}</strong> Followers</button><button onClick={() => onNetwork("following")} type="button"><strong>{compactCount(profile.following)}</strong> Following</button></div>
    </div>
  </section>;
}

export function RepliesPanel({ viewer, replies, people, loading, error, onRetry, onProfile, onSend }: { viewer: Profile; replies: Reply[]; people: Map<string, Profile>; loading: boolean; error?: string; onRetry: () => void; onProfile: (id: string) => void; onSend: (value: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!body.trim() || busy) return; setBusy(true);
    try { await onSend(body.trim()); setBody(""); } catch { /* the parent shows the error */ } finally { setBusy(false); }
  }
  return <div className="reply-panel">
    {loading && <p className="muted small">Loading comments…</p>}
    {error && <p className="muted small">{error} <button type="button" className="text-button" onClick={onRetry}>Try again</button></p>}
    {!error && !loading && !replies.length && <p className="muted small">No comments yet. Start the conversation.</p>}
    <div className="reply-list">{replies.map((reply) => <div className="reply-row" key={reply.id}><button type="button" className="avatar-button" onClick={() => onProfile(reply.authorId)} aria-label={`View ${people.get(reply.authorId)?.name || "profile"}`}><Avatar person={people.get(reply.authorId)} size={32} /></button><div className="reply-content"><strong>{people.get(reply.authorId)?.name || "Loop member"} <time suppressHydrationWarning dateTime={reply.createdAt}>{relativeTime(reply.createdAt)}</time></strong><p>{reply.body}</p></div></div>)}</div>
    <form className="reply-form" onSubmit={submit}><Avatar person={viewer} size={33} /><input aria-label="Write a comment" maxLength={500} placeholder="Write a comment…" value={body} onChange={(event) => setBody(event.target.value)} /><button className="icon-button" aria-label="Send comment" type="submit" disabled={!body.trim() || busy}><Send size={18} /></button></form>
  </div>;
}

export function ActivityList({ events, people, onOpen, loading, error, onRetry }: { events: Activity[]; people: Map<string, Profile>; onOpen: (event: Activity) => void; loading: boolean; error?: string; onRetry: () => void }) {
  if (loading && !events.length) return <p className="panel state-status">Loading activity…</p>;
  if (error) return <div className="panel state-status">{error} <button className="text-button" type="button" onClick={onRetry}>Try again</button></div>;
  if (!events.length) return <Empty icon={Bell} title="You’re all caught up" text="When someone likes or comments on your post, or follows you, it’ll show up here." />;
  return <div className="panel activities">{events.map((event) => {
    const person = people.get(event.actorId), Icon = event.kind === "like" ? Heart : event.kind === "reply" ? MessageCircle : UserRound;
    const verb = event.kind === "like" ? "liked your post" : event.kind === "reply" ? "commented on your post" : "started following you";
    return <button type="button" className={`activity-row${event.readAt ? "" : " unread"}`} key={event.id} onClick={() => onOpen(event)}><span className="activity-avatar"><Avatar person={person} size={42} /><span><Icon size={12} /></span></span><span><p><strong>{person?.name || "Someone"}</strong> {verb}.</p><small suppressHydrationWarning>{relativeTime(event.createdAt)}</small></span><ChevronRight size={17} className="activity-arrow" /></button>;
  })}</div>;
}

function ChatThread({ person, thread, viewer, onSend, onProfile, onBack, loading }: { person: Profile; thread: DirectMessage[]; viewer: Profile; onSend: (value: string) => Promise<void>; onProfile: () => void; onBack: () => void; loading: boolean }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [thread.length]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!body.trim() || busy) return; setBusy(true);
    try { await onSend(body.trim()); setBody(""); } catch { /* handled by parent */ } finally { setBusy(false); }
  }
  return <section className="thread">
    <div className="thread-head"><button type="button" className="icon-button chat-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={18}/></button><button type="button" className="identity" onClick={onProfile}><Avatar person={person} size={36} /><span className="identity-text"><strong>{person.name}</strong><small>@{person.handle}</small></span></button></div>
    <div className="thread-scroll" ref={scroll} aria-live="polite">
      {loading && !thread.length ? <p className="thread-note">Loading messages…</p> : !thread.length && <p className="thread-note">This is the beginning of your conversation with {person.name.split(" ")[0]}.</p>}
      {thread.map((msg, index) => {
        const own = msg.senderId === viewer.id, prev = thread[index - 1];
        const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
        return <div key={msg.id}>{newDay && <p className="thread-date" suppressHydrationWarning>{new Date(msg.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>}<div className={`message-row${own ? " outgoing" : ""}`}>{!own && <Avatar size={25} person={person} />}<div><p>{msg.body}</p><span suppressHydrationWarning>{new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{own && (msg.readAt ? <CircleCheck size={12} /> : <Check size={12} />)}</span></div></div></div>;
      })}
    </div>
    <form className="message-form" onSubmit={submit}><input value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder="Write a message…" aria-label="Write a message" /><button type="submit" className="primary-button" disabled={!body.trim() || busy} aria-label="Send message"><Send size={18} /></button></form>
  </section>;
}

export function Messenger({ conversations, people, viewer, personId, thread, loading, error, onRetry, onChoose, onNew, onProfile, onSend }: {
  conversations: Conversation[]; people: Map<string, Profile>; viewer: Profile; personId?: string; thread: DirectMessage[]; loading: boolean; error?: string; onRetry: () => void;
  onChoose: (id?: string) => void; onNew: () => void; onProfile: (id: string) => void; onSend: (value: string) => Promise<void>;
}) {
  const chosen = personId ? people.get(personId) : undefined;
  return <><div className={`panel messenger${chosen ? " has-thread" : ""}`}>
    <section className="conversation-list" aria-label="Conversations"><div className="conversation-head"><strong>Inbox</strong><button type="button" className="icon-button" aria-label="New message" onClick={onNew}><MessageSquarePlus size={19} /></button></div>
      {loading && !conversations.length && <p className="conversation-empty">Loading inbox…</p>}
      {!loading && !conversations.length && <p className="conversation-empty">No conversations yet.</p>}
      {conversations.map((item) => {
        const person = people.get(item.personId);
        return <button key={item.personId} className={`conversation-item${personId === item.personId ? " active" : ""}`} onClick={() => onChoose(item.personId)} type="button"><Avatar person={person} size={36} /><span className="conversation-name"><strong>{person?.name || "Loop member"}</strong><span>{item.snippet}</span></span>{item.unread > 0 && <i aria-label="Unread" />}</button>;
      })}
    </section>
    {chosen ? <ChatThread key={chosen.id} person={chosen} thread={thread} viewer={viewer} onSend={onSend} onProfile={() => onProfile(chosen.id)} onBack={() => onChoose()} loading={loading} /> : <div className="thread-empty"><span className="empty-icon"><MessageCircle size={27} /></span><h2>Say hello</h2><p>Select a conversation or start a new one.</p><button type="button" className="secondary-button" onClick={onNew}><MessageSquarePlus size={17} /> New message</button></div>}
  </div>{error && <div className="panel state-status">{error} <button type="button" className="text-button" onClick={onRetry}>Try again</button></div>}</>;
}

export function NoPeople({ text }: { text: string }) {
  return <div className="no-people"><UsersRound size={23} /><p>{text}</p></div>;
}
