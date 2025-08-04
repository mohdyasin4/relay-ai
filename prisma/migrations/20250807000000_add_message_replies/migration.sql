-- AlterTable
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN "replyToText" TEXT;
ALTER TABLE "Message" ADD COLUMN "replyToSenderId" TEXT;
ALTER TABLE "Message" ADD COLUMN "replyToSenderName" TEXT;

-- CreateIndex
-- Add a comment explaining this is not a real foreign key as replies can reference
-- messages that no longer exist due to potential data retention policies
COMMENT ON COLUMN "Message"."replyToId" IS 'This is not enforced as a foreign key to allow for references to potentially deleted messages';
