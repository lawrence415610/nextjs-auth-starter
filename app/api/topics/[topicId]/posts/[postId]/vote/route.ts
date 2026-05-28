import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRequestIdentity } from "../../../../helpers";

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const identity = await getRequestIdentity();
  const body = (await request.json()) as { value?: number };
  const value = body.value === -1 ? -1 : 1;

  if (!identity.currentUserId && !identity.anonymousKey) {
    return NextResponse.json({ error: "Missing viewer identity" }, { status: 400 });
  }

  if (identity.currentUserId) {
    await prisma.topicVote.upsert({
      where: {
        postId_authorId: {
          postId,
          authorId: identity.currentUserId,
        },
      },
      update: { value },
      create: {
        postId,
        authorId: identity.currentUserId,
        value,
      },
    });
  } else {
    await prisma.topicVote.upsert({
      where: {
        postId_anonymousKey: {
          postId,
          anonymousKey: identity.anonymousKey!,
        },
      },
      update: { value },
      create: {
        postId,
        anonymousKey: identity.anonymousKey,
        value,
      },
    });
  }

  const aggregate = await prisma.topicVote.aggregate({
    where: { postId },
    _sum: { value: true },
  });

  return NextResponse.json({ votes: aggregate._sum.value ?? 0 });
}
