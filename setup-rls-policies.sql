-- Enable Row Level Security on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FriendRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;

-- User table policies
-- Allow users to read their own profile and other users' basic info
CREATE POLICY "Users can view all profiles" ON "User"
    FOR SELECT 
    USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON "User"
    FOR UPDATE 
    USING (auth.uid()::text = id);

-- Allow users to insert their own profile (for registration)
CREATE POLICY "Users can insert own profile" ON "User"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = id);

-- Contact table policies
-- Allow users to read their own contacts OR contacts where they are the contact (but not AI contacts)
CREATE POLICY "Users can view own contacts" ON "Contact"
    FOR SELECT 
    USING (auth.uid()::text = "userId" OR (auth.uid()::text = "contactUserId" AND "isAi" = false));

-- Allow users to insert their own contacts OR when they are being added as someone's contact (but not for AI contacts)
CREATE POLICY "Users can insert own contacts" ON "Contact"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "userId" OR (auth.uid()::text = "contactUserId" AND "isAi" = false));

-- Allow users to update their own contacts
CREATE POLICY "Users can update own contacts" ON "Contact"
    FOR UPDATE 
    USING (auth.uid()::text = "userId");

-- Allow users to delete their own contacts
CREATE POLICY "Users can delete own contacts" ON "Contact"
    FOR DELETE 
    USING (auth.uid()::text = "userId");

-- FriendRequest table policies
-- Allow users to view friend requests they sent or received
CREATE POLICY "Users can view their friend requests" ON "FriendRequest"
    FOR SELECT 
    USING (auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId");

-- Allow users to insert friend requests they are sending
CREATE POLICY "Users can send friend requests" ON "FriendRequest"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "senderId");

-- Allow users to update friend requests they received (to accept/reject)
CREATE POLICY "Users can update received friend requests" ON "FriendRequest"
    FOR UPDATE 
    USING (auth.uid()::text = "receiverId");

-- Allow users to delete friend requests they sent or received
CREATE POLICY "Users can delete their friend requests" ON "FriendRequest"
    FOR DELETE 
    USING (auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId");

-- Message table policies
-- Allow users to view messages they sent or received (including AI messages)
CREATE POLICY "Users can view their messages" ON "Message"
    FOR SELECT 
    USING (auth.uid()::text = "senderId" OR auth.uid()::text = "recipientId" OR "senderId" IS NULL OR
           EXISTS (SELECT 1 FROM "Group" WHERE "Group".id = "Message"."groupId" AND 
                   EXISTS (SELECT 1 FROM "_GroupMembers" WHERE "A" = "Group".id AND "B" = auth.uid()::text)));

-- Allow users to insert messages they are sending OR AI messages (where senderId is null)
CREATE POLICY "Users can send messages" ON "Message"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "senderId" OR "senderId" IS NULL);

-- Allow users to update messages they sent (for status updates, not AI messages)
CREATE POLICY "Users can update own messages" ON "Message"
    FOR UPDATE 
    USING (auth.uid()::text = "senderId" AND "senderId" IS NOT NULL);

-- Allow users to delete messages they sent (not AI messages)
CREATE POLICY "Users can delete own messages" ON "Message"
    FOR DELETE 
    USING (auth.uid()::text = "senderId" AND "senderId" IS NOT NULL);

-- Reaction table policies
-- Allow users to view reactions on messages they can see (including AI messages)
CREATE POLICY "Users can view reactions" ON "Reaction"
    FOR SELECT 
    USING (EXISTS (SELECT 1 FROM "Message" WHERE "Message".id = "Reaction"."messageId" AND 
                   (auth.uid()::text = "Message"."senderId" OR auth.uid()::text = "Message"."recipientId" OR "Message"."senderId" IS NULL OR
                    EXISTS (SELECT 1 FROM "Group" WHERE "Group".id = "Message"."groupId" AND 
                            EXISTS (SELECT 1 FROM "_GroupMembers" WHERE "A" = "Group".id AND "B" = auth.uid()::text)))));

-- Allow users to add their own reactions
CREATE POLICY "Users can add reactions" ON "Reaction"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "userId");

-- Allow users to delete their own reactions
CREATE POLICY "Users can delete own reactions" ON "Reaction"
    FOR DELETE 
    USING (auth.uid()::text = "userId");

-- Group table policies
-- Allow users to view groups they are members of
CREATE POLICY "Users can view their groups" ON "Group"
    FOR SELECT 
    USING (EXISTS (SELECT 1 FROM "_GroupMembers" WHERE "A" = "Group".id AND "B" = auth.uid()::text));

-- Allow users to create groups
CREATE POLICY "Users can create groups" ON "Group"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "creatorId");

-- Allow group creators to update their groups
CREATE POLICY "Group creators can update groups" ON "Group"
    FOR UPDATE 
    USING (auth.uid()::text = "creatorId");

-- Invitation table policies
-- Allow users to view invitations they sent
CREATE POLICY "Users can view sent invitations" ON "Invitation"
    FOR SELECT 
    USING (auth.uid()::text = "inviterId");

-- Allow users to insert invitations they are sending
CREATE POLICY "Users can send invitations" ON "Invitation"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "inviterId");

-- Allow users to update invitations they sent (to mark as accepted/expired)
CREATE POLICY "Users can update sent invitations" ON "Invitation"
    FOR UPDATE 
    USING (auth.uid()::text = "inviterId");

-- Allow users to delete invitations they sent
CREATE POLICY "Users can delete sent invitations" ON "Invitation"
    FOR DELETE 
    USING (auth.uid()::text = "inviterId");
