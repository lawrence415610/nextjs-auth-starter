import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRequestIdentity } from "../../helpers";

export async function POST(request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const identity = await getRequestIdentity();
  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Missing post content" }, { status: 400 });
  }

  const post = await prisma.topicPost.create({
    data: {
      content,
      topicId,
      authorId: identity.currentUserId,
      anonymousKey: identity.currentUserId ? null : identity.anonymousKey,
    },
    include: {
      author: { select: { name: true, email: true } },
      votes: { select: { value: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json({
    post: {
      id: post.id,
      author: post.author?.name || post.author?.email || "Anonymous",
      content: post.content,
      createdAt: "Just now",
      votes: post.votes.reduce((total, vote) => total + vote.value, 0),
      isMine: true,
      replies: post.replies.map((reply) => ({
        id: reply.id,
        author: reply.author?.name || reply.author?.email || "Anonymous",
        content: reply.content,
        createdAt: "Just now",
        isMine: false,
      })),
    },
  });
}
