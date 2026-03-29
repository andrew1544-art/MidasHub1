-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
-- Unique constraint: one endpoint per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subs_unique ON public.push_subscriptions(user_id, endpoint);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
-- Service role can read all (for sending)
CREATE POLICY "Service can read all push subs" ON public.push_subscriptions FOR SELECT USING (auth.role() = 'service_role');
