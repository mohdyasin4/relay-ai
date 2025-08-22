-- Migration: Replace attachmenturl with attachments JSON field
-- This migration handles the transition from single attachment URL to multiple attachments support

-- Step 1: Add the new attachments JSON field
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

-- Step 2: Create index on attachments for better query performance
CREATE INDEX IF NOT EXISTS "idx_message_attachments" ON "Message" USING GIN ("attachments");

-- Step 3: Migrate existing attachmenturl data to the new attachments format
-- Convert single attachment URLs to the new JSON structure
UPDATE "Message" 
SET "attachments" = CASE 
  WHEN "attachmenturl" IS NOT NULL AND "attachmenturl" != '' THEN
    json_build_array(
      json_build_object(
        'type', 'image',
        'url', "attachmenturl",
        'fileName', 'Legacy Attachment',
        'fileSize', 0,
        'mimeType', 'image/*'
      )
    )
  ELSE NULL
END
WHERE "attachmenturl" IS NOT NULL AND "attachmenturl" != '';

-- Step 4: Add comment explaining the field
COMMENT ON COLUMN "Message"."attachments" IS 'JSON array of file attachments with type, url, fileName, fileSize, and mimeType';

-- Step 5: Verify migration (optional - can be commented out in production)
-- SELECT COUNT(*) as total_messages, 
--        COUNT("attachmenturl") as messages_with_old_attachment,
--        COUNT("attachments") as messages_with_new_attachments
-- FROM "Message";
