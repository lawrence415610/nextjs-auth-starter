import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";

type TopicWithPosts = {
  id: string;
  title: string;
  summary: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  authorId: string | null;
  anonymousKey: string | null;
  author?: { name: string | null; email: string } | null;
  posts: Array<{
    id: string;
    content: string;
    createdAt: Date;
    authorId: string | null;
    anonymousKey: string | null;
    author?: { name: string | null; email: string } | null;
    votes: Array<{ value: number }>;
    replies: Array<{
      id: string;
      content: string;
      createdAt: Date;
      authorId: string | null;
      anonymousKey: string | null;
      author?: { name: string | null; email: string } | null;
    }>;
  }>;
};

export async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  return typeof userId === "string" ? userId : null;
}

export async function getRequestIdentity() {
  const currentUserId = await getCurrentUserId();
  const headerStore = await headers();
  const anonymousKey = headerStore.get("x-nightlife-client-id")?.trim() || null;

  return { currentUserId, anonymousKey };
}

export function isOwnedByViewer(
  resource: { authorId: string | null; anonymousKey: string | null },
  identity: { currentUserId: string | null; anonymousKey: string | null },
) {
  return Boolean(
    (identity.currentUserId && resource.authorId === identity.currentUserId) ||
      (!resource.authorId && identity.anonymousKey && resource.anonymousKey === identity.anonymousKey),
  );
}

export function displayName(user?: { name: string | null; email: string } | null) {
  return user?.name || user?.email || "Anonymous";
}

export function serializeTopic(
  topic: TopicWithPosts,
  identity: { currentUserId: string | null; anonymousKey: string | null },
) {
  return {
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    address: topic.address,
    createdAt: formatRelative(topic.createdAt),
    lngLat: [topic.longitude, topic.latitude] as [number, number],
    isMine: isOwnedByViewer(topic, identity),
    posts: topic.posts.map((post) => ({
      id: post.id,
      author: displayName(post.author),
      content: post.content,
      createdAt: formatRelative(post.createdAt),
      votes: post.votes.reduce((total, vote) => total + vote.value, 0),
      isMine: isOwnedByViewer(post, identity),
      replies: post.replies.map((reply) => ({
        id: reply.id,
        author: displayName(reply.author),
        content: reply.content,
        createdAt: formatRelative(reply.createdAt),
        isMine: isOwnedByViewer(reply, identity),
      })),
    })),
  };
}

export function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
