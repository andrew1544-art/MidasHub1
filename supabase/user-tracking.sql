-- User login tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  language TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON public.user_sessions(ip_address);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own sessions" ON public.user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all sessions" ON public.user_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Add last known location to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_device TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_browser TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0;
