import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getRequestIdentity, serializeTopic } from "./helpers";

const topicInclude = {
  author: { select: { name: true, email: true } },
  posts: {
    orderBy: { createdAt: "desc" as const },
    include: {
      author: { select: { name: true, email: true } },
      votes: { select: { value: true } },
      replies: {
        orderBy: { createdAt: "asc" as const },
        include: {
          author: { select: { name: true, email: true } },
        },
      },
    },
  },
};

export async function GET() {
  const identity = await getRequestIdentity();
  const topics = await prisma.topic.findMany({
    orderBy: { createdAt: "desc" },
    include: topicInclude,
  });

  return NextResponse.json({
    topics: topics.map((topic) => serializeTopic(topic, identity)),
  });
}

export async function POST(request: Request) {
  const identity = await getRequestIdentity();
  const body = (await request.json()) as {
    title?: string;
    summary?: string;
    address?: string;
    lngLat?: [number, number];
  };
  const title = body.title?.trim();
  const summary = body.summary?.trim();
  const address = body.address?.trim();
  const lngLat = body.lngLat;

  if (!title || !summary || !address || !Array.isArray(lngLat) || lngLat.length !== 2) {
    return NextResponse.json({ error: "Missing title, summary, address, or coordinates" }, { status: 400 });
  }

  const [longitude, latitude] = lngLat;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const topic = await prisma.topic.create({
    data: {
      title,
      summary,
      address,
      latitude,
      longitude,
      authorId: identity.currentUserId,
      anonymousKey: identity.currentUserId ? null : identity.anonymousKey,
      posts: {
        create: {
          content: summary,
          authorId: identity.currentUserId,
          anonymousKey: identity.currentUserId ? null : identity.anonymousKey,
        },
      },
    },
    include: topicInclude,
  });

  return NextResponse.json({ topic: serializeTopic(topic, identity) }, { status: 201 });
}
