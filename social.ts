export type Profile = { id: string; handle: string; name: string; avatar: string | null; bio: string; sample: boolean; followers: number; following: number; followed: boolean };
export type Post = { id: string; authorId: string; body: string; media: string | null; mediaKind: "image" | "video" | null; createdAt: string; likes: number; replies: number; shares: number; liked: boolean; saved: boolean };
export type Story = { id: string; authorId: string; body: string; media: string; createdAt: string; expiresAt: string | null };
export type Reply = { id: string; authorId: string; body: string; createdAt: string };
export type Activity = { id: string; actorId: string; kind: "like" | "reply" | "follow"; postId: string | null; createdAt: string; readAt: string | null };
export type DirectMessage = { id: string; senderId: string; recipientId: string; body: string; createdAt: string; readAt: string | null };
export type Conversation = { personId: string; snippet: string; at: string; unread: number };
export type SocialData = { viewer: Profile | null; people: Profile[]; posts: Post[]; stories: Story[]; unreadMessages: number; unreadNotifications: number };
export type View = "home" | "explore" | "messages" | "notifications" | "bookmarks" | "profile" | "post";
export type Place = { view: View; id?: string; q?: string };

export const AVATAR_IDS = {
  maya: "a0000000-0000-4000-8000-000000000001", jordan: "a0000000-0000-4000-8000-000000000002",
  sofia: "a0000000-0000-4000-8000-000000000003", noah: "a0000000-0000-4000-8000-000000000004",
  alex: "a0000000-0000-4000-8000-000000000005",
};
export const FEATURED_POST = "b0000000-0000-4000-8000-000000000001";
export const DEMO_VIEWER: Profile = { id: AVATAR_IDS.alex, name: "Alex Morgan", handle: "alexmorgan", avatar: "/images/alex.webp", sample: true, bio: "Here for good stories and even better company. ✨", followers: 0, following: 0, followed: false };
export const SEED_PEOPLE = [
  { id: AVATAR_IDS.maya, name: "Maya Chen", handle: "mayachen", avatar: "/images/maya.webp", bio: "Golden-hour enthusiast. Usually somewhere in the mountains. 🏔️" },
  { id: AVATAR_IDS.jordan, name: "Jordan Ellis", handle: "jordanellis", avatar: "/images/jordan.webp", bio: "Street photographer, coffee person, collector of little moments." },
  { id: AVATAR_IDS.sofia, name: "Sofia Patel", handle: "sofiapatel", avatar: "/images/sofia.webp", bio: "Designing things, growing things, finding the good in the everyday. 🌷" },
  { id: AVATAR_IDS.noah, name: "Noah Williams", handle: "noahw", avatar: "/images/noah.webp", bio: "Outside whenever possible. Always taking the scenic route." },
];
export const SEED_POSTS = [
  { id: FEATURED_POST, authorId: AVATAR_IDS.maya, body: "Golden hour in the Dolomites. Some places make you forget to check your phone. 🏔️\n#Dolomites #GoldenHour", media: "/images/dolomites.webp", sampleLikes: 248, sampleReplies: 16, sampleShares: 12, minutes: 120 },
  { id: "b0000000-0000-4000-8000-000000000002", authorId: AVATAR_IDS.jordan, body: "A slow morning, a good book, and nowhere to be. ☕\n#WeekendVibes", media: "/images/coffee.webp", sampleLikes: 137, sampleReplies: 7, sampleShares: 4, minutes: 240 },
  { id: "b0000000-0000-4000-8000-000000000003", authorId: AVATAR_IDS.sofia, body: "Noticing the little things lately. Today’s mood board: tulips, sunlight, and a second coffee.\n#DesignInspiration", media: "/images/story-sofia.webp", sampleLikes: 102, sampleReplies: 5, sampleShares: 3, minutes: 420 },
  { id: "b0000000-0000-4000-8000-000000000004", authorId: AVATAR_IDS.noah, body: "Took the long way home. Worth every extra step.\n#Outside #WeekendVibes", media: "/images/story-noah.webp", sampleLikes: 91, sampleReplies: 3, sampleShares: 2, minutes: 540 },
];
export const SEED_STORIES = [
  { id: "c0000000-0000-4000-8000-000000000001", authorId: AVATAR_IDS.maya, media: "/images/story-maya.webp", body: "A little moment from the coast. ☀️" },
  { id: "c0000000-0000-4000-8000-000000000002", authorId: AVATAR_IDS.jordan, media: "/images/story-jordan.webp", body: "The city looks better after it rains." },
  { id: "c0000000-0000-4000-8000-000000000003", authorId: AVATAR_IDS.sofia, media: "/images/story-sofia.webp", body: "Today’s little joy. 🌷" },
  { id: "c0000000-0000-4000-8000-000000000004", authorId: AVATAR_IDS.noah, media: "/images/story-noah.webp", body: "One more turn in the trail…" },
];
export const SEED_REPLIES = [
  { id: "d0000000-0000-4000-8000-000000000001", authorId: AVATAR_IDS.jordan, postId: FEATURED_POST, body: "That light is unreal. What a shot!" },
  { id: "d0000000-0000-4000-8000-000000000002", authorId: AVATAR_IDS.sofia, postId: FEATURED_POST, body: "Officially adding this to my Italy list. 🤍" },
];
export const TRENDS = [
  { category: "Technology", tag: "#DesignInspiration", count: "2.4K posts" },
  { category: "Lifestyle", tag: "#WeekendVibes", count: "1.8K posts" },
  { category: "Travel", tag: "#Dolomites", count: "956 posts" },
];

export function parsePlace(query: { view?: string; post?: string; user?: string; chat?: string; q?: string }): Place {
  if (query.post) return { view: "post", id: query.post };
  const view = query.view;
  if (view === "explore") return { view, q: (query.q || "").slice(0, 120) };
  if (view === "profile") return { view, id: query.user };
  if (view === "messages") return { view, id: query.chat };
  if (view === "notifications" || view === "bookmarks") return { view };
  return { view: "home" };
}

export function relativeTime(date: string) {
  const time = Math.max(0, (Date.now() - new Date(date).getTime()) / 60000);
  if (time < 1) return "now";
  if (time < 60) return `${Math.floor(time)}m`;
  if (time < 1440) return `${Math.floor(time / 60)}h`;
  if (time < 10080) return `${Math.floor(time / 1440)}d`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function compactCount(n: number) {
  return n >= 1000 ? `${Number((n / 1000).toFixed(1))}K` : String(n);
}
