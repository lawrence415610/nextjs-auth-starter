-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_authorId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Post";
