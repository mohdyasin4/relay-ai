-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "modalPreferences" JSONB;

-- Add a comment to explain the purpose of the modalPreferences field
COMMENT ON COLUMN "User"."modalPreferences" IS 'Stores user preferences for modals (shown/hidden state, etc.)';
