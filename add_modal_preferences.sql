-- Add modal preferences to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "modalPreferences" JSONB;

-- Add a comment to explain the purpose of the modalPreferences field
COMMENT ON COLUMN "User"."modalPreferences" IS 'Stores user preferences for modals (shown/hidden state, etc.)';

-- Example row level security for the new column
-- Users can only update their own modal preferences
CREATE OR REPLACE POLICY "Users can update their own modal preferences" ON "User"
    FOR UPDATE
    USING (auth.uid()::text = id)
    WITH CHECK (auth.uid()::text = id);

-- Add reply functionality fields to Message table
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "replyToText" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "replyToSenderId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "replyToSenderName" TEXT;

-- Add a comment explaining this is not a real foreign key
COMMENT ON COLUMN "Message"."replyToId" IS 'This is not enforced as a foreign key to allow for references to potentially deleted messages';

-- Create Reaction table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Reaction" (
    "id" TEXT PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE
);

-- Add unique constraint to prevent duplicate reactions
CREATE UNIQUE INDEX IF NOT EXISTS "Reaction_messageId_userId_emoji_key" ON "Reaction"("messageId", "userId", "emoji");

-- Enable Row Level Security for Reaction table
ALTER TABLE "Reaction" ENABLE ROW LEVEL SECURITY;

-- Create policies for Reaction table
-- Users can view reactions on messages they can see
CREATE POLICY "Users can view reactions" ON "Reaction"
    FOR SELECT 
    USING (EXISTS (SELECT 1 FROM "Message" WHERE "Message"."id" = "Reaction"."messageId" AND 
                (auth.uid()::text = "Message"."senderId" OR auth.uid()::text = "Message"."recipientId" OR 
                 "Message"."senderId" IS NULL OR
                 EXISTS (SELECT 1 FROM "Group" WHERE "Group"."id" = "Message"."groupId" AND 
                        EXISTS (SELECT 1 FROM "_GroupMembers" WHERE "A" = "Group"."id" AND "B" = auth.uid()::text)))));

-- Users can add their own reactions
CREATE POLICY "Users can add reactions" ON "Reaction"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "userId");

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions" ON "Reaction"
    FOR DELETE 
    USING (auth.uid()::text = "userId");
