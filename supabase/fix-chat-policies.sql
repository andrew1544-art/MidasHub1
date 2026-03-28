-- ===========================================
-- FIX CONVERSATION RLS POLICIES
-- ===========================================
-- Run this in Supabase SQL Editor to fix chat 500 errors

-- Drop the broken policies
DROP POLICY IF EXISTS "conv_read" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_members_read" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members_insert" ON public.conversation_members;

-- Recreate with proper policies
-- Anyone logged in can create conversations
CREATE POLICY "conv_read" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE USING (true);

-- Members: logged in users can read all members and insert
CREATE POLICY "conv_members_read" ON public.conversation_members FOR SELECT USING (true);
CREATE POLICY "conv_members_insert" ON public.conversation_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "conv_members_update" ON public.conversation_members FOR UPDATE USING (auth.uid() = user_id);

-- Also fix messages policy to be simpler
DROP POLICY IF EXISTS "messages_read" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;

CREATE POLICY "messages_read" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
