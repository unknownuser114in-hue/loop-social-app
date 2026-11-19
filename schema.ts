import { boolean, customType, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const users = pgTable("loop_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: text("handle").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  avatar: text("avatar"),
  bio: text("bio").default("").notNull(),
  sample: boolean("sample").default(false).notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("loop_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: time("expires_at").notNull(),
}, (table) => [index("loop_session_expiry").on(table.expiresAt)]);

export const authBuckets = pgTable("loop_auth_buckets", {
  key: text("key").primaryKey(),
  hits: integer("hits").default(1).notNull(),
  expiresAt: time("expires_at").notNull(),
});

export const assets = pgTable("loop_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  content: bytea("content").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});

export const posts = pgTable("loop_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").default("").notNull(),
  media: text("media"),
  mediaKind: text("media_kind", { enum: ["image", "video"] }),
  sampleLikes: integer("sample_likes").default(0).notNull(),
  sampleReplies: integer("sample_replies").default(0).notNull(),
  sampleShares: integer("sample_shares").default(0).notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
}, (table) => [index("loop_posts_recent").on(table.createdAt), index("loop_posts_author").on(table.authorId)]);

export const likes = pgTable("loop_likes", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.postId, table.userId] }), index("loop_likes_user").on(table.userId)]);

export const bookmarks = pgTable("loop_bookmarks", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.postId, table.userId] }), index("loop_bookmarks_user").on(table.userId)]);

export const shares = pgTable("loop_shares", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.postId, table.userId] })]);

export const replies = pgTable("loop_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
}, (table) => [index("loop_replies_post").on(table.postId, table.createdAt)]);

export const follows = pgTable("loop_follows", {
  followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.followerId, table.followingId] }), index("loop_follows_incoming").on(table.followingId)]);

export const stories = pgTable("loop_stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  media: text("media").notNull(),
  body: text("body").default("").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
  expiresAt: time("expires_at"),
}, (table) => [index("loop_stories_expiry").on(table.expiresAt)]);

export const messages = pgTable("loop_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
  readAt: time("read_at"),
}, (table) => [index("loop_messages_sender").on(table.senderId, table.createdAt), index("loop_messages_recipient").on(table.recipientId, table.createdAt)]);

export const notifications = pgTable("loop_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["like", "reply", "follow"] }).notNull(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
  createdAt: time("created_at").defaultNow().notNull(),
  readAt: time("read_at"),
}, (table) => [index("loop_notifications_recipient").on(table.recipientId, table.createdAt)]);

export const reports = pgTable("loop_reports", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.postId, table.reporterId] })]);
