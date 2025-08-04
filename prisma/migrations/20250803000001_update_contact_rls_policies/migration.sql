-- Update Contact table RLS policies to allow friend request acceptance

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own contacts" ON "Contact";
DROP POLICY IF EXISTS "Users can insert own contacts" ON "Contact";

-- Create updated policies that allow mutual contact creation during friend request acceptance

-- Allow users to read their own contacts OR contacts where they are the contact (but not AI contacts)
CREATE POLICY "Users can view own contacts" ON "Contact"
    FOR SELECT 
    USING (auth.uid()::text = "userId" OR (auth.uid()::text = "contactUserId" AND "isAi" = false));

-- Allow users to insert their own contacts OR when they are being added as someone's contact (but not for AI contacts)
CREATE POLICY "Users can insert own contacts" ON "Contact"
    FOR INSERT 
    WITH CHECK (auth.uid()::text = "userId" OR (auth.uid()::text = "contactUserId" AND "isAi" = false));
