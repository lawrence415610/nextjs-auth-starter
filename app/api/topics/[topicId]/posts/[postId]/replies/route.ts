import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRequestIdentity } from "../../../../helpers";

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const identity = await getRequestIdentity();
  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Missing reply content" }, { status: 400 });
  }

  const reply = await prisma.topicReply.create({
    data: {
      content,
      postId,
      authorId: identity.currentUserId,
      anonymousKey: identity.currentUserId ? null : identity.anonymousKey,
    },
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    reply: {
      id: reply.id,
      author: reply.author?.name || reply.author?.email || "Anonymous",
      content: reply.content,
      createdAt: "Just now",
      isMine: true,
    },
  });
}
