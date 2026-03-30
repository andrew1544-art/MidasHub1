-- Referral system
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS qualified_referrals INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_posted BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_installed_pwa BOOLEAN DEFAULT false;

-- Generate referral codes for existing users
UPDATE public.profiles SET referral_code = UPPER(SUBSTRING(MD5(id::TEXT || NOW()::TEXT) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Auto-generate referral code on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_emoji, email, date_of_birth, referral_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', '😎'),
    NEW.email,
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8))
  );
  -- If referred, link to referrer and increment count
  IF NEW.raw_user_meta_data->>'referred_by' IS NOT NULL THEN
    UPDATE public.profiles SET referred_by = (
      SELECT id FROM public.profiles WHERE referral_code = UPPER(NEW.raw_user_meta_data->>'referred_by') LIMIT 1
    ) WHERE id = NEW.id;
    UPDATE public.profiles SET referral_count = referral_count + 1
    WHERE referral_code = UPPER(NEW.raw_user_meta_data->>'referred_by');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track qualified referrals (posted + installed)
CREATE OR REPLACE FUNCTION public.check_qualified_referral()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id UUID;
  q_count INT;
BEGIN
  -- When a user posts for the first time, mark them and update referrer
  IF TG_TABLE_NAME = 'posts' THEN
    UPDATE public.profiles SET has_posted = true WHERE id = NEW.user_id AND has_posted = false;
  END IF;
  
  -- Check if this user qualifies (has_posted = true)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = COALESCE(NEW.user_id, NEW.id)
    AND has_posted = true
    AND referred_by IS NOT NULL
  ) THEN
    SELECT referred_by INTO referrer_id FROM public.profiles
    WHERE id = COALESCE(NEW.user_id, NEW.id);
    
    IF referrer_id IS NOT NULL THEN
      SELECT COUNT(*) INTO q_count FROM public.profiles
      WHERE referred_by = referrer_id AND has_posted = true;
      
      UPDATE public.profiles SET qualified_referrals = q_count WHERE id = referrer_id;
      
      -- Auto-badge progression: creator→OG→VIP→Blue Verified
      -- 5+ = creator, 15+ = OG, 30+ = VIP, 50+ = blue verified
      IF q_count >= 5 THEN
        UPDATE public.profiles SET badges = CASE 
          WHEN badges IS NULL OR badges::TEXT = '[]' THEN '["creator"]'::JSONB
          WHEN NOT badges ? 'creator' THEN badges || '"creator"'::JSONB
          ELSE badges END
        WHERE id = referrer_id;
      END IF;
      IF q_count >= 15 THEN
        UPDATE public.profiles SET badges = CASE
          WHEN NOT badges ? 'og' THEN badges || '"og"'::JSONB
          ELSE badges END
        WHERE id = referrer_id;
      END IF;
      IF q_count >= 30 THEN
        UPDATE public.profiles SET badges = CASE
          WHEN NOT badges ? 'vip' THEN badges || '"vip"'::JSONB
          ELSE badges END
        WHERE id = referrer_id;
      END IF;
      IF q_count >= 50 THEN
        UPDATE public.profiles SET is_verified = true WHERE id = referrer_id AND is_verified = false;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_referral_on_post ON public.posts;
CREATE TRIGGER check_referral_on_post AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_qualified_referral();
