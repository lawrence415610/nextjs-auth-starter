import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRequestIdentity, isOwnedByViewer } from "../../../../../helpers";

export async function DELETE(_request: Request, { params }: { params: Promise<{ replyId: string }> }) {
  const { replyId } = await params;
  const identity = await getRequestIdentity();

  const reply = await prisma.topicReply.findUnique({
    where: { id: replyId },
    select: { authorId: true, anonymousKey: true },
  });

  if (!reply) {
    return NextResponse.json({ error: "Reply not found" }, { status: 404 });
  }

  if (!isOwnedByViewer(reply, identity)) {
    return NextResponse.json({ error: "You can only delete your own replies" }, { status: 403 });
  }

  await prisma.topicReply.delete({ where: { id: replyId } });

  return NextResponse.json({ ok: true });
}
