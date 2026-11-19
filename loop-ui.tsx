"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bookmark, ChevronLeft, ChevronRight, Ellipsis, Flag, Heart, ImagePlus, Link2, MessageCircle, Plus, Send, Smile, Trash2, Video, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { compactCount, relativeTime, type Post, type Profile, type Story } from "@/lib/social";

export function Logo({ onClick }: { onClick?: () => void }) {
  return <Link href="/" className="brand" aria-label="Loop home" onClick={onClick ? (event) => { event.preventDefault(); onClick(); } : undefined}>
    <span className="brand-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.1 13.9a3.9 3.9 0 0 0 5.5 0l3.8-3.8a3.9 3.9 0 0 0-5.5-5.5l-2.2 2.2"/><path d="M13.9 10.1a3.9 3.9 0 0 0-5.5 0l-3.8 3.8a3.9 3.9 0 0 0 5.5 5.5l2.2-2.2"/>
      </svg>
    </span><span className="brand-text">loop<span>.</span></span>
  </Link>;
}

export function Avatar({ person, size = 38 }: { person?: Pick<Profile, "name" | "avatar"> | null; size?: number }) {
  const letters = person?.name.trim().split(/\s+/).slice(0, 2).map((part) => part.substring(0, 1)).join("").toUpperCase() || "L";
  const tone = ((person?.name || "Loop").charCodeAt(0) * 19) % 360;
  return <span aria-hidden="true" className="avatar" style={{ "--avatar-size": `${size}px`, "--avatar-tone": tone } as CSSProperties}>
    {person?.avatar ? <img src={person.avatar} alt="" draggable={false} /> : letters}
  </span>;
}

export function PageIntro({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: () => void; children?: ReactNode }) {
  return <div className="page-intro">
    <div className="intro-content">{back && <button className="icon-button page-back" type="button" onClick={back} aria-label="Go back"><ArrowLeft size={20} /></button>}
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    </div>{children}
  </div>;
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return <div className="panel empty-state"><span className="empty-icon"><Icon size={25} /></span><h2>{title}</h2><p>{text}</p>{children}</div>;
}

export function FollowButton({ following, onClick }: { following: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={following} onClick={onClick} className={`follow-button${following ? " is-following" : ""}`}>{following ? "Following" : "Follow"}</button>;
}

export function Modal({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-label={title} className={`modal ${className}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
    {className !== "story-modal" && <div className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>}
    {children}
  </dialog>;
}

export function StoryRail({ stories, people, viewer, onCreate, onOpen }: { stories: Story[]; people: Map<string, Profile>; viewer: Profile; onCreate: () => void; onOpen: (id: string) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const row = rail.current;
    if (!row) return;
    const measure = () => {
      const next = { left: row.scrollLeft > 2, right: row.scrollWidth - row.scrollLeft - row.clientWidth > 2 };
      setEdges((value) => value.left === next.left && value.right === next.right ? value : next);
    };
    const resize = new ResizeObserver(measure);
    resize.observe(row); row.addEventListener("scroll", measure, { passive: true });
    const frame = requestAnimationFrame(measure);
    return () => { resize.disconnect(); row.removeEventListener("scroll", measure); cancelAnimationFrame(frame); };
  }, [stories.length]);
  function move(direction: number) {
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .6, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <section className="story-section" aria-label="Stories">
    <div className="story-rail" ref={rail}>
    <button type="button" className="story-tile story-add" onClick={onCreate}>
      <span className="story-self"><Avatar person={viewer} size={46} /><span className="story-plus"><Plus size={15} strokeWidth={2.6} /></span></span>
      <span className="story-label">Add story</span>
    </button>
    {stories.map((story) => {
      const person = people.get(story.authorId);
      const name = story.authorId === viewer.id ? "Your story" : person?.name.split(" ")[0] || "Story";
      return <button type="button" key={story.id} className="story-tile" onClick={() => onOpen(story.id)} aria-label={`View ${name === "Your story" ? "your story" : `${name}’s story`}`}>
        <img className="story-cover" src={story.media} alt="" loading="eager" />
        <span className="story-avatar"><Avatar person={person} size={29} /></span>
        <span className="story-label">{name}</span>
      </button>;
    })}
    </div>
    {edges.left && <button type="button" className="story-scroll left" onClick={() => move(-1)} aria-label="Scroll stories left"><ChevronLeft size={19} /></button>}
    {edges.right && <button type="button" className="story-scroll right" onClick={() => move(1)} aria-label="Scroll stories right"><ChevronRight size={19} /></button>}
  </section>;
}

export function StoryViewer({ story, person, index, total, step, close }: { story: Story; person?: Profile; index: number; total: number; step: (direction: number) => void; close: () => void }) {
  return <Modal title={`${person?.name || "Loop"}’s story`} onClose={close} className="story-modal">
    <div className="story-view" onKeyDown={(event) => { if (event.key === "ArrowLeft") step(-1); if (event.key === "ArrowRight") step(1); }}>
      <img key={story.id} src={story.media} alt={story.body || "Story photo"} />
      <div className="story-view-progress">{Array.from({ length: total }, (_, i) => <span key={i} className={i < index ? "finished" : ""}>{i === index && <i key={story.id} onAnimationEnd={() => step(1)} />}</span>)}</div>
      <div className="story-view-head"><Avatar person={person} size={36} /><strong>{person?.name || "Loop member"}</strong><small suppressHydrationWarning>{relativeTime(story.createdAt)}</small><button type="button" className="icon-button" aria-label="Close story" onClick={close}><X size={23} /></button></div>
      {index > 0 && <button type="button" className="story-view-prev" aria-label="Previous story" onClick={() => step(-1)}><ChevronLeft size={24} /></button>}
      <button type="button" className="story-view-next" aria-label={index === total - 1 ? "Finish stories" : "Next story"} onClick={() => step(1)}>{index === total - 1 ? <X size={23} /> : <ChevronRight size={24} />}</button>
      {story.body && <p>{story.body}</p>}
    </div>
  </Modal>;
}

export type ComposeStart = "text" | "photo" | "video" | "feeling" | "story";
export function Composer({ viewer, open }: { viewer: Profile; open: (focus: ComposeStart) => void }) {
  return <section className="panel composer" aria-label="Create a post">
    <div className="composer-top"><Avatar person={viewer} size={40} /><button type="button" className="composer-prompt" onClick={() => open("text")}>What’s on your mind, {viewer.name.split(" ")[0]}?</button></div>
    <div className="composer-tools"><div className="composer-options">
      <button type="button" onClick={() => open("photo")}><ImagePlus size={18} className="photo-icon"/><span>Photo</span></button>
      <button type="button" onClick={() => open("video")}><Video size={18} className="video-icon"/><span>Video</span></button>
      <button type="button" onClick={() => open("feeling")}><Smile size={18} className="feeling-icon"/><span>Feeling</span></button>
    </div><button type="button" className="primary-button composer-submit" onClick={() => open("text")}>Post</button></div>
  </section>;
}

const imageAccept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const videoAccept = "video/mp4,video/webm";

export function CreateDialog({ start, viewer, demo, close, submit }: { start: ComposeStart; viewer: Profile; demo: boolean; close: () => void; submit: (body: string, file: File | null) => Promise<void> }) {
  const story = start === "story";
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [picker, setPicker] = useState(start === "feeling");
  const [kind, setKind] = useState(start === "video" ? "video" : "image");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const limit = story ? 200 : 1000;
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    const task = requestAnimationFrame(() => setUrl(next));
    return () => { cancelAnimationFrame(task); URL.revokeObjectURL(next); };
  }, [file]);
  function choose(type: "image" | "video") {
    setKind(type);
    if (input.current) { input.current.accept = type === "image" ? imageAccept : videoAccept; input.current.value = ""; input.current.click(); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await submit(body.trim(), file); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t publish. Try again."); setBusy(false); }
  }
  return <Modal title={story ? "Create a story" : "Create a post"} onClose={() => { if (!busy) close(); }}>
    <form className="modal-body compose-form" onSubmit={send}>
      <div className="compose-author"><Avatar person={viewer} size={42} /><div><strong>{viewer.name}</strong><span>{demo ? "Demo · only in this browser" : story ? "Public · visible for 24 hours" : "Public post"}</span></div></div>
      <label className="sr-only" htmlFor="compose-body">{story ? "Story caption" : "Write your post"}</label>
      <textarea id="compose-body" className="compose-text" placeholder={story ? "Add a caption (optional)" : `What’s on your mind, ${viewer.name.split(" ")[0]}?`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={limit} rows={story ? 2 : 4} />
      {file && url && <div className="compose-preview">{file.type.startsWith("video/") ? <video src={url} controls preload="metadata" /> : <img src={url} alt="Attachment preview" />}<button type="button" className="icon-button" aria-label="Remove attachment" onClick={() => { setFile(null); setUrl(""); }}><X size={19} /></button></div>}
      {story && !file && <button type="button" className="upload-zone" onClick={() => choose("image")}><ImagePlus size={24} /><strong>Choose a story photo</strong><span>JPEG, PNG, WebP, GIF or AVIF · {demo ? "2" : "8"} MB max</span></button>}
      <input ref={input} type="file" accept={kind === "image" ? imageAccept : videoAccept} hidden onChange={(event) => {
        const next = event.target.files?.[0];
        if (!next) return;
        if (next.size > (demo ? 2 : 8) * 1024 * 1024) { setError(`Choose a file under ${demo ? "2" : "8"} MB.`); return; }
        if (![...imageAccept.split(","), ...(!story ? videoAccept.split(",") : [])].includes(next.type)) { setError("Choose a supported image or video file."); return; }
        setFile(next); setError("");
      }} />
      {!story && <div className="compose-attachments"><button type="button" onClick={() => choose("image")}><ImagePlus className="photo-icon" size={19} /> Photo</button><button type="button" onClick={() => choose("video")}><Video className="video-icon" size={19} /> Video</button><button type="button" onClick={() => setPicker(!picker)} aria-expanded={picker}><Smile className="feeling-icon" size={19} /> Feeling</button><span>{body.length}/{limit}</span></div>}
      {!story && picker && <div className="emoji-picker" aria-label="Add a feeling">{["😊", "🎉", "😎", "🤍", "☕", "✨", "🔥", "🥹"].map((emoji) => <button key={emoji} type="button" onClick={() => { setBody((value) => `${value}${value ? " " : ""}${emoji}`.slice(0, limit)); setPicker(false); }}>{emoji}</button>)}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button full-button" disabled={busy || (story ? !file : !body.trim() && !file)}>{busy ? "Publishing…" : story ? "Share story" : "Publish post"}<ArrowRight size={17} /></button>
    </form>
  </Modal>;
}

export function ProfileEditor({ viewer, demo, close, submit }: { viewer: Profile; demo: boolean; close: () => void; submit: (name: string, bio: string, file: File | null) => Promise<void> }) {
  const [name, setName] = useState(viewer.name);
  const [bio, setBio] = useState(viewer.bio);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <Modal title="Edit profile" onClose={() => { if (!busy) close(); }}><form className="modal-body compose-form" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await submit(name.trim(), bio.trim(), file); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save changes."); setBusy(false); }
  }}>
    <div className="edit-avatar"><Avatar person={viewer} size={58} /><label className="secondary-button image-label">{file ? "Photo selected" : "Change photo"}<input type="file" accept={imageAccept} hidden onChange={(event) => {
      const next = event.target.files?.[0];
      if (next && next.size > (demo ? 2 : 8) * 1024 * 1024) setError("That profile picture is too large.");
      else { setError(""); setFile(next || null); }
    }} /></label></div>
    <label className="stack-label">Display name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={48} /></label>
    <label className="stack-label">Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={3} maxLength={180} placeholder="Tell us a little about yourself." /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button full-button" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save changes"}</button>
  </form></Modal>;
}

export function PostCard({ post, author, own, onProfile, onTag, onLike, onReply, onShare, onSave, onDelete, onReport, children }: {
  post: Post; author?: Profile; own: boolean; onProfile: () => void; onTag: (tag: string) => void;
  onLike: () => void; onReply: () => void; onShare: () => void; onSave: () => void; onDelete: () => void; onReport: () => void; children?: ReactNode;
}) {
  const [more, setMore] = useState(false);
  return <article className="panel post-card" aria-label={`Post by ${author?.name || "Loop member"}`}>
    <div className="post-head">
      <button type="button" className="identity post-identity" onClick={onProfile}><Avatar person={author} size={42} /><span><strong>{author?.name || "Loop member"}</strong><span className="post-meta">@{author?.handle || "member"}<i /><time dateTime={post.createdAt} suppressHydrationWarning>{relativeTime(post.createdAt)}</time></span></span></button>
      <div className="menu-anchor" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMore(false); }}>
        <button type="button" className="icon-button" onClick={() => setMore(!more)} aria-label="Post options" aria-expanded={more}><Ellipsis size={21} /></button>
        {more && <div className="dropdown post-dropdown"><button type="button" onClick={() => { setMore(false); onShare(); }}><Link2 size={16} /> Copy link</button>{own ? <button type="button" className="danger-text" onClick={() => { setMore(false); onDelete(); }}><Trash2 size={16} /> Delete post</button> : <button type="button" onClick={() => { setMore(false); onReport(); }}><Flag size={16} /> Report post</button>}</div>}
      </div>
    </div>
    {post.body && <div className="post-caption">{post.body.split(/(#[\p{L}\p{N}_]+)/u).map((part, index) => part.startsWith("#") ? <button key={index} onClick={() => onTag(part)} type="button" className="hashtag">{part}</button> : <span key={index}>{part}</span>)}</div>}
    {post.media && (post.mediaKind === "video" ? <video className="post-media" src={post.media} controls playsInline preload="metadata" aria-label={`Video by ${author?.name || "Loop member"}`} /> : <img className="post-media" src={post.media} alt={post.body.split("\n")[0] || `Photo by ${author?.name || "Loop member"}`} loading="lazy" />)}
    <div className="post-actions">
      <button type="button" className={post.liked ? "liked" : ""} aria-label={post.liked ? "Unlike post" : "Like post"} aria-pressed={post.liked} onClick={onLike}><Heart size={20} /><span>{compactCount(post.likes)}</span></button>
      <button type="button" className={children ? "action-selected" : ""} aria-label="Comments" aria-expanded={!!children} onClick={onReply}><MessageCircle size={20} /><span>{compactCount(post.replies)}</span></button>
      <button type="button" aria-label="Share post" onClick={onShare}><Send size={19} /><span>{compactCount(post.shares)}</span></button>
      <button type="button" className={`save-action${post.saved ? " saved" : ""}`} aria-label={post.saved ? "Remove bookmark" : "Save post"} aria-pressed={post.saved} onClick={onSave}><Bookmark size={20} /></button>
    </div>
    {children}
  </article>;
}
