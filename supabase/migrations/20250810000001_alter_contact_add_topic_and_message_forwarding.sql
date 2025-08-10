-- Add topicId to Contact and forwarding columns to Message
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "topicId" text;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isForwarded" boolean DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "forwardedFromMessageId" text;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "forwardedFromContactId" text;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "forwardedById" text;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "forwardedToContactId" text;

-- Backfill topicId for existing direct contacts where possible
UPDATE "Contact" c
SET "topicId" = CONCAT('chat/', CASE WHEN c."contactUserId" IS NOT NULL THEN
  (CASE WHEN c."userId" < c."contactUserId" THEN c."userId" || '-' || c."contactUserId" ELSE c."contactUserId" || '-' || c."userId" END)
ELSE
  (CASE WHEN c."aiPersonaId" IS NOT NULL THEN (CASE WHEN c."userId" < c."aiPersonaId" THEN c."userId" || '-' || c."aiPersonaId" ELSE c."aiPersonaId" || '-' || c."userId" END) ELSE NULL END)
END)
WHERE c."topicId" IS NULL;

