-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "authorId" TEXT,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT,

    CONSTRAINT "TopicPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicReply" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT,

    CONSTRAINT "TopicReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicVote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" INTEGER NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "TopicVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Topic_createdAt_idx" ON "Topic"("createdAt");

-- CreateIndex
CREATE INDEX "Topic_latitude_longitude_idx" ON "Topic"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "TopicPost_topicId_createdAt_idx" ON "TopicPost"("topicId", "createdAt");

-- CreateIndex
CREATE INDEX "TopicReply_postId_createdAt_idx" ON "TopicReply"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "TopicVote_postId_idx" ON "TopicVote"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicVote_postId_authorId_key" ON "TopicVote"("postId", "authorId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPost" ADD CONSTRAINT "TopicPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPost" ADD CONSTRAINT "TopicPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicReply" ADD CONSTRAINT "TopicReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "TopicPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicReply" ADD CONSTRAINT "TopicReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicVote" ADD CONSTRAINT "TopicVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "TopicPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicVote" ADD CONSTRAINT "TopicVote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
