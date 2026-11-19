import { and, asc, desc, eq, exists, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, bookmarks, follows, likes, messages, notifications, posts, replies, reports, shares, stories, users } from "@/db/schema";
import { AppError, field, isUUID, throttle } from "@/lib/auth";
import { SEED_PEOPLE, SEED_POSTS, SEED_REPLIES, SEED_STORIES, type Activity, type Conversation, type DirectMessage, type Place, type Post, type Profile, type Reply, type SocialData } from "@/lib/social";

const minuteAgo = (minutes: number) => new Date(Date.now() - 60000 * minutes);
const newest = <T extends { createdAt: Date }>(a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime();
const withDate = <T extends { createdAt: Date }>(row: T) => ({ ...row, createdAt: row.createdAt.toISOString() });
const mustId = (id: string) => {
  if (!isUUID(id)) throw new AppError("That item wasn’t found.", 404);
  return id;
};

let seeding: Promise<void> | undefined;
function seed() {
  seeding ??= (async () => {
    if (process.env.LOOP_SAMPLE_CONTENT === "false") return;
    const [present] = await db.select({ id: users.id }).from(users).where(eq(users.id, SEED_PEOPLE[0].id)).limit(1);
    if (present) return;
    await db.transaction(async (tx) => {
      await tx.insert(users).values(SEED_PEOPLE.map((person) => ({ ...person, sample: true }))).onConflictDoNothing();
      await tx.insert(posts).values(SEED_POSTS.map(({ minutes, ...post }) => ({ ...post, mediaKind: "image" as const, createdAt: minuteAgo(minutes) }))).onConflictDoNothing();
      await tx.insert(replies).values(SEED_REPLIES.map((reply, index) => ({ ...reply, createdAt: minuteAgo(90 - index * 20) }))).onConflictDoNothing();
      await tx.insert(stories).values(SEED_STORIES.map((story, index) => ({ ...story, createdAt: minuteAgo(30 + index * 14) }))).onConflictDoNothing();
    });
  })().catch((error) => { seeding = undefined; throw error; });
  return seeding;
}

function getProfiles(viewer: string | null) {
  return db.select({
    id: users.id, handle: users.handle, name: users.name, avatar: users.avatar, bio: users.bio, sample: users.sample,
    followers: sql<number>`(select count(*) from ${follows} where ${follows.followingId} = ${users.id})::int`,
    following: sql<number>`(select count(*) from ${follows} where ${follows.followerId} = ${users.id})::int`,
    followed: viewer ? sql<boolean>`exists(select 1 from ${follows} where ${follows.followingId} = ${users.id} and ${follows.followerId} = ${viewer})` : sql<boolean>`false`,
  }).from(users);
}

function getPosts(viewer: string | null) {
  return db.select({
    id: posts.id, authorId: posts.authorId, body: posts.body, media: posts.media, mediaKind: posts.mediaKind, createdAt: posts.createdAt,
    likes: sql<number>`(${posts.sampleLikes} + (select count(*) from ${likes} where ${likes.postId} = ${posts.id}))::int`,
    replies: sql<number>`(${posts.sampleReplies} + (select count(*) from ${replies} where ${replies.postId} = ${posts.id}))::int`,
    shares: sql<number>`(${posts.sampleShares} + (select count(*) from ${shares} where ${shares.postId} = ${posts.id}))::int`,
    liked: viewer ? sql<boolean>`exists(select 1 from ${likes} where ${likes.postId} = ${posts.id} and ${likes.userId} = ${viewer})` : sql<boolean>`false`,
    saved: viewer ? sql<boolean>`exists(select 1 from ${bookmarks} where ${bookmarks.postId} = ${posts.id} and ${bookmarks.userId} = ${viewer})` : sql<boolean>`false`,
  }).from(posts);
}

export async function snapshot(viewer: string | null, place?: Place): Promise<SocialData> {
  await seed();
  const target = place?.id && isUUID(place.id) ? place.id : null;
  const [basePeople, recentPosts, liveStories, extraPosts, selected, me, unreadMessages, unreadNotifications] = await Promise.all([
    getProfiles(viewer).orderBy(asc(users.sample), desc(users.createdAt), asc(users.id)).limit(180),
    getPosts(viewer).orderBy(desc(posts.createdAt)).limit(60),
    db.select().from(stories).where(or(isNull(stories.expiresAt), gt(stories.expiresAt, new Date()))).orderBy(desc(stories.createdAt)).limit(40),
    place?.view === "post" && target ? getPosts(viewer).where(eq(posts.id, target)).limit(1)
      : place?.view === "profile" && (target || viewer) ? getPosts(viewer).where(eq(posts.authorId, target || viewer!)).orderBy(desc(posts.createdAt)).limit(60)
      : place?.view === "bookmarks" && viewer ? getPosts(viewer).where(exists(db.select({ id: bookmarks.postId }).from(bookmarks).where(and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, viewer))))).orderBy(desc(posts.createdAt)).limit(60)
      : [],
    target && (place?.view === "profile" || place?.view === "messages") ? getProfiles(viewer).where(eq(users.id, target)).limit(1) : [],
    viewer ? getProfiles(viewer).where(eq(users.id, viewer)).limit(1) : [],
    viewer ? db.$count(messages, and(eq(messages.recipientId, viewer), isNull(messages.readAt))) : 0,
    viewer ? db.$count(notifications, and(eq(notifications.recipientId, viewer), isNull(notifications.readAt))) : 0,
  ]);
  const postSet = new Map([...recentPosts, ...extraPosts].map((post) => [post.id, post]));
  const peopleSet = new Map([...basePeople, ...selected, ...me].map((person) => [person.id, person]));
  const missingIds = new Set([...postSet.values(), ...liveStories].map((item) => item.authorId).filter((id) => !peopleSet.has(id)));
  if (missingIds.size) {
    const { inArray } = await import("drizzle-orm");
    const missing = await getProfiles(viewer).where(inArray(users.id, [...missingIds]));
    for (const row of missing) peopleSet.set(row.id, row);
  }
  return {
    viewer: me[0] ?? null, people: [...peopleSet.values()], posts: [...postSet.values()].sort(newest).map(withDate) as Post[],
    stories: liveStories.map((story) => ({ ...withDate(story), expiresAt: story.expiresAt?.toISOString() ?? null })), unreadMessages, unreadNotifications,
  };
}

export async function listReplies(id: string): Promise<Reply[]> {
  const rows = await db.select({ id: replies.id, authorId: replies.authorId, body: replies.body, createdAt: replies.createdAt })
    .from(replies).where(eq(replies.postId, mustId(id))).orderBy(desc(replies.createdAt)).limit(60);
  return rows.reverse().map(withDate);
}

export async function network(viewer: string | null, id: string, mode: string): Promise<Profile[]> {
  const target = mustId(id);
  const among = mode === "following" ? and(eq(follows.followerId, target), eq(follows.followingId, users.id)) : and(eq(follows.followingId, target), eq(follows.followerId, users.id));
  return getProfiles(viewer).where(exists(db.select({ id: follows.followerId }).from(follows).where(among))).orderBy(asc(users.name)).limit(80);
}

export async function inbox(viewer: string) {
  const counterpart = sql<string>`case when ${messages.senderId} = ${viewer}::uuid then ${messages.recipientId} else ${messages.senderId} end`;
  const unreadByPerson = sql<number>`(count(*) filter (where ${messages.recipientId} = ${viewer}::uuid and ${messages.readAt} is null))::int`;
  const date = sql<Date>`max(${messages.createdAt})`.mapWith(messages.createdAt);
  const rows = await db.select({ personId: counterpart, at: date, unread: unreadByPerson, snippet: sql<string>`(array_agg(${messages.body} order by ${messages.createdAt} desc))[1]` })
    .from(messages).where(or(eq(messages.senderId, viewer), eq(messages.recipientId, viewer))).groupBy(sql`1`).orderBy(desc(date)).limit(50);
  const result: Conversation[] = rows.map((row) => ({ ...row, at: row.at.toISOString() }));
  return result;
}

export async function chat(viewer: string, other: string): Promise<DirectMessage[]> {
  const id = mustId(other);
  const rows = await db.select().from(messages).where(or(
    and(eq(messages.senderId, viewer), eq(messages.recipientId, id)),
    and(eq(messages.senderId, id), eq(messages.recipientId, viewer)),
  )).orderBy(desc(messages.createdAt)).limit(150);
  return rows.reverse().map((row) => ({ ...withDate(row), readAt: row.readAt?.toISOString() ?? null }));
}

export async function activity(viewer: string): Promise<Activity[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.recipientId, viewer)).orderBy(desc(notifications.createdAt)).limit(80);
  return rows.map(({ recipientId: _recipient, ...row }) => ({ ...withDate(row), readAt: row.readAt?.toISOString() ?? null }));
}

function bounded(raw: string, max: number, required = false) {
  const value = raw.trim();
  if ((required && !value) || value.length > max) throw new AppError(`Enter ${required ? "1–" : "no more than "}${max} characters.`);
  return value;
}

export async function mutate(viewer: string, input: Record<string, unknown>) {
  const action = input.action;
  if (action === "read-notifications") {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.recipientId, viewer), isNull(notifications.readAt)));
    return {};
  }
  const id = mustId(field(input, "id"));
  if (action === "follow" || action === "send" || action === "read-chat") {
    if (id === viewer) throw new AppError("Choose another person.");
    if (action === "read-chat") {
      await db.update(messages).set({ readAt: new Date() }).where(and(eq(messages.recipientId, viewer), eq(messages.senderId, id), isNull(messages.readAt)));
      return {};
    }
    const [person] = await db.select({ sample: users.sample }).from(users).where(eq(users.id, id)).limit(1);
    if (!person) throw new AppError("This profile isn’t available.", 404);
    if (action === "send") {
      if (person.sample) throw new AppError("This is a sample profile. Invite a friend to chat with a real account.");
      const body = bounded(field(input, "body"), 2000, true);
      await throttle(`send:${viewer}`, 45, 1);
      const [item] = await db.insert(messages).values({ senderId: viewer, recipientId: id, body }).returning();
      return { item: { ...withDate(item), readAt: null } };
    }
    await db.transaction(async (tx) => {
      if (input.value === true) {
        const added = await tx.insert(follows).values({ followerId: viewer, followingId: id }).onConflictDoNothing().returning();
        if (added.length && !person.sample) await tx.insert(notifications).values({ recipientId: id, actorId: viewer, kind: "follow" });
      } else {
        await tx.delete(follows).where(and(eq(follows.followerId, viewer), eq(follows.followingId, id)));
        await tx.delete(notifications).where(and(eq(notifications.recipientId, id), eq(notifications.actorId, viewer), eq(notifications.kind, "follow")));
      }
    });
    return {};
  }
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) throw new AppError("This post isn’t available.", 404);
  if (action === "delete-post") {
    if (post.authorId !== viewer) throw new AppError("Only the author can delete this post.", 403);
    await db.delete(posts).where(and(eq(posts.id, id), eq(posts.authorId, viewer)));
    return {};
  }
  if (action === "like") {
    await db.transaction(async (tx) => {
      if (input.value === true) {
        const added = await tx.insert(likes).values({ postId: id, userId: viewer }).onConflictDoNothing().returning();
        if (added.length && post.authorId !== viewer) await tx.insert(notifications).values({ recipientId: post.authorId, actorId: viewer, postId: id, kind: "like" });
      } else {
        await tx.delete(likes).where(and(eq(likes.postId, id), eq(likes.userId, viewer)));
        await tx.delete(notifications).where(and(eq(notifications.postId, id), eq(notifications.actorId, viewer), eq(notifications.kind, "like")));
      }
    });
  } else if (action === "bookmark") {
    if (input.value === true) await db.insert(bookmarks).values({ postId: id, userId: viewer }).onConflictDoNothing();
    else await db.delete(bookmarks).where(and(eq(bookmarks.postId, id), eq(bookmarks.userId, viewer)));
  } else if (action === "share") {
    await db.insert(shares).values({ postId: id, userId: viewer }).onConflictDoNothing();
  } else if (action === "reply") {
    const body = bounded(field(input, "body"), 500, true);
    await throttle(`reply:${viewer}`, 25, 1);
    const item = await db.transaction(async (tx) => {
      const [row] = await tx.insert(replies).values({ postId: id, authorId: viewer, body }).returning();
      if (post.authorId !== viewer) await tx.insert(notifications).values({ recipientId: post.authorId, actorId: viewer, postId: id, kind: "reply" });
      return row;
    });
    return { item: withDate(item) };
  } else if (action === "report") {
    await db.insert(reports).values({ postId: id, reporterId: viewer, reason: bounded(field(input, "body"), 250, true) }).onConflictDoNothing();
  } else {
    throw new AppError("Unknown action.");
  }
  return {};
}

const verifiedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm"];
function fileMatches(buffer: Buffer, mime: string) {
  if (buffer.length < 16) return false;
  const ascii = (start: number, end: number) => buffer.toString("ascii", start, end);
  if (mime === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (mime === "image/gif") return ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
  if (mime === "image/avif") return ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12));
  if (mime === "video/mp4") return ascii(4, 8) === "ftyp";
  if (mime === "video/webm") return buffer.readUInt32BE(0) === 0x1a45dfa3;
  return false;
}

export async function createContent(viewer: string, form: FormData) {
  const action = form.get("action");
  if (action !== "post" && action !== "story" && action !== "profile") throw new AppError("Unknown upload action.");
  const raw = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)) : "";
  const body = bounded(raw("body"), action === "story" ? 200 : 1000);
  const file = form.get("file");
  let upload: { mime: string; content: Buffer } | null = null;
  if (file instanceof File && file.size) {
    if (file.size > 8 * 1024 * 1024) throw new AppError("Choose a file under 8 MB.", 413);
    const mime = file.type;
    if (!verifiedTypes.includes(mime) || (action !== "post" && !mime.startsWith("image/"))) throw new AppError("Choose a JPEG, PNG, WebP, GIF, or AVIF image, or an MP4/WebM video for a post.");
    const content = Buffer.from(await file.arrayBuffer());
    if (!fileMatches(content, mime)) throw new AppError("That file doesn’t match its format. Try a different file.");
    upload = { mime, content };
  }
  if (action === "post" && !body && !upload) throw new AppError("Add some text or attach a photo or video.");
  if (action === "story" && !upload) throw new AppError("Choose a photo for your story.");
  const name = action === "profile" ? bounded(raw("name"), 48, true) : "";
  const bio = action === "profile" ? bounded(raw("bio"), 180) : "";
  await throttle(`content:${viewer}`, 30, 15);
  await db.transaction(async (tx) => {
    let url: string | null = null;
    if (upload) {
      const [fileRow] = await tx.insert(assets).values({ ownerId: viewer, ...upload }).returning({ id: assets.id });
      url = `/api/media/${fileRow.id}`;
    }
    if (action === "profile") {
      await tx.update(users).set({ name, bio, ...(url ? { avatar: url } : {}) }).where(eq(users.id, viewer));
    } else if (action === "story" && url) {
      await tx.insert(stories).values({ authorId: viewer, body, media: url, expiresAt: new Date(Date.now() + 86400000) });
    } else if (action === "post") {
      await tx.insert(posts).values({ authorId: viewer, body, media: url, mediaKind: upload ? (upload.mime.startsWith("video/") ? "video" : "image") : null });
    }
  });
  return {};
}

export async function publicMedia(id: string) {
  const url = `/api/media/${mustId(id)}`;
  const [row] = await db.select({ mime: assets.mime, content: assets.content }).from(assets).where(and(eq(assets.id, id), or(
    exists(db.select({ id: posts.id }).from(posts).where(eq(posts.media, url))),
    exists(db.select({ id: users.id }).from(users).where(eq(users.avatar, url))),
    exists(db.select({ id: stories.id }).from(stories).where(and(eq(stories.media, url), gt(stories.expiresAt, new Date())))),
  ))).limit(1);
  return row;
}
