-- Migration: Remove old attachmenturl field after successful migration to attachments JSON
-- This should be run AFTER confirming that all data has been successfully migrated

-- Step 1: Verify that all data has been migrated (safety check)
-- Uncomment and run this first to ensure no data loss:
-- SELECT COUNT(*) as messages_with_old_attachment, 
--        COUNT("attachments") as messages_with_new_attachments
-- FROM "Message" 
-- WHERE "attachmenturl" IS NOT NULL AND "attachmenturl" != '';

-- Step 2: Remove the old attachmenturl column
-- Only run this after confirming successful migration
ALTER TABLE "Message" DROP COLUMN IF EXISTS "attachmenturl";

-- Step 3: Verify the column has been removed
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'Message' AND column_name = 'attachmenturl';

