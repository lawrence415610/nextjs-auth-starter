import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRequestIdentity, isOwnedByViewer } from "../../../helpers";

export async function DELETE(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const identity = await getRequestIdentity();

  const post = await prisma.topicPost.findUnique({
    where: { id: postId },
    select: { authorId: true, anonymousKey: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!isOwnedByViewer(post, identity)) {
    return NextResponse.json({ error: "You can only delete your own posts" }, { status: 403 });
  }

  await prisma.topicPost.delete({ where: { id: postId } });

  return NextResponse.json({ ok: true });
}
