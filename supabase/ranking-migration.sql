-- ===========================================
-- MIDASHUB RANKING SYSTEM - XP Migration
-- ===========================================
-- Run this in Supabase SQL Editor AFTER the main schema.sql

-- 1. Add XP column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);

-- 2. Function to award XP
CREATE OR REPLACE FUNCTION public.award_xp(target_user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET xp = xp + amount WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. XP on post creation (+10 XP)
CREATE OR REPLACE FUNCTION public.xp_on_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_xp(NEW.user_id, 10);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_post_trigger ON public.posts;
CREATE TRIGGER xp_post_trigger AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_post();

-- 4. XP on like (+1 to liker, +2 to post owner)
CREATE OR REPLACE FUNCTION public.xp_on_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
    -- Liker gets 1 XP
    PERFORM public.award_xp(NEW.user_id, 1);
    -- Post owner gets 2 XP (if different person)
    IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
      PERFORM public.award_xp(post_owner, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_like_trigger ON public.likes;
CREATE TRIGGER xp_like_trigger AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_like();

-- 5. XP on comment (+5 to commenter, +3 to post owner)
CREATE OR REPLACE FUNCTION public.xp_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
    PERFORM public.award_xp(NEW.user_id, 5);
    IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
      PERFORM public.award_xp(post_owner, 3);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_comment_trigger ON public.comments;
CREATE TRIGGER xp_comment_trigger AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_comment();

-- 6. XP on repost (+5 to reposter, +8 to post owner)
CREATE OR REPLACE FUNCTION public.xp_on_repost()
RETURNS TRIGGER AS $$
DECLARE
  post_owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
    PERFORM public.award_xp(NEW.user_id, 5);
    IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
      PERFORM public.award_xp(post_owner, 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_repost_trigger ON public.reposts;
CREATE TRIGGER xp_repost_trigger AFTER INSERT ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_repost();

-- 7. XP on friendship accepted (+5 to both)
CREATE OR REPLACE FUNCTION public.xp_on_friendship()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- +5 XP for sending request
    PERFORM public.award_xp(NEW.requester_id, 5);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- +5 XP for accepting
    PERFORM public.award_xp(NEW.addressee_id, 5);
    PERFORM public.award_xp(NEW.requester_id, 5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_friendship_trigger ON public.friendships;
CREATE TRIGGER xp_friendship_trigger AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_friendship();

-- 8. XP on message sent (+1)
CREATE OR REPLACE FUNCTION public.xp_on_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_xp(NEW.sender_id, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_message_trigger ON public.messages;
CREATE TRIGGER xp_message_trigger AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_message();

-- 9. XP when post goes viral (+50)
-- This runs when the is_viral flag flips to true
CREATE OR REPLACE FUNCTION public.xp_on_viral()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_viral = true AND (OLD.is_viral = false OR OLD.is_viral IS NULL) THEN
    PERFORM public.award_xp(NEW.user_id, 50);
    -- Also send a notification
    INSERT INTO public.notifications (user_id, type, content, reference_id)
    VALUES (NEW.user_id, 'viral', '🔥 Your post just went viral! +50 XP', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS xp_viral_trigger ON public.posts;
CREATE TRIGGER xp_viral_trigger AFTER UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_viral();

-- 10. Backfill XP for existing users based on their activity
-- Run this ONCE to give existing users their earned XP
DO $$
DECLARE
  u RECORD;
  total_xp INTEGER;
BEGIN
  FOR u IN SELECT id FROM public.profiles LOOP
    total_xp := 0;
    -- Posts
    total_xp := total_xp + (SELECT COUNT(*) * 10 FROM public.posts WHERE user_id = u.id);
    -- Likes given
    total_xp := total_xp + (SELECT COUNT(*) * 1 FROM public.likes WHERE user_id = u.id);
    -- Likes received
    total_xp := total_xp + (SELECT COUNT(*) * 2 FROM public.likes l JOIN public.posts p ON l.post_id = p.id WHERE p.user_id = u.id AND l.user_id != u.id);
    -- Comments made
    total_xp := total_xp + (SELECT COUNT(*) * 5 FROM public.comments WHERE user_id = u.id);
    -- Comments received
    total_xp := total_xp + (SELECT COUNT(*) * 3 FROM public.comments c JOIN public.posts p ON c.post_id = p.id WHERE p.user_id = u.id AND c.user_id != u.id);
    -- Friends
    total_xp := total_xp + (SELECT COUNT(*) * 5 FROM public.friendships WHERE (requester_id = u.id OR addressee_id = u.id) AND status = 'accepted');
    -- Messages
    total_xp := total_xp + (SELECT COUNT(*) * 1 FROM public.messages WHERE sender_id = u.id);
    -- Viral posts
    total_xp := total_xp + (SELECT COUNT(*) * 50 FROM public.posts WHERE user_id = u.id AND is_viral = true);

    UPDATE public.profiles SET xp = total_xp WHERE id = u.id;
  END LOOP;
END $$;
