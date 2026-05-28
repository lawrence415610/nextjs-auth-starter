-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "anonymousKey" TEXT;

-- AlterTable
ALTER TABLE "TopicPost" ADD COLUMN "anonymousKey" TEXT;

-- AlterTable
ALTER TABLE "TopicReply" ADD COLUMN "anonymousKey" TEXT;

-- DropForeignKey
ALTER TABLE "TopicVote" DROP CONSTRAINT "TopicVote_authorId_fkey";

-- DropIndex
DROP INDEX "TopicVote_postId_authorId_key";

-- AlterTable
ALTER TABLE "TopicVote" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "TopicVote" ADD COLUMN "anonymousKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TopicVote_postId_authorId_key" ON "TopicVote"("postId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicVote_postId_anonymousKey_key" ON "TopicVote"("postId", "anonymousKey");

-- AddForeignKey
ALTER TABLE "TopicVote" ADD CONSTRAINT "TopicVote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
