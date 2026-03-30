-- ===== CUSTOM TRADE ROLES (Admin-managed) =====
CREATE TABLE IF NOT EXISTS public.trade_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '👤',
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trade_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active roles" ON public.trade_roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles" ON public.trade_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Insert default roles
INSERT INTO public.trade_roles (name, icon, description, display_order) VALUES
  ('Seller', '🏪', 'I have an item or service to sell', 1),
  ('Buyer', '🛒', 'I want to purchase', 2),
  ('Vendor', '🏬', 'I supply goods in bulk', 3),
  ('Middle Man', '🤝', 'I facilitate the deal between parties', 4)
ON CONFLICT DO NOTHING;

-- ===== MULTI-PARTY TRADE PARTICIPANTS =====
CREATE TABLE IF NOT EXISTS public.trade_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer',
  role_id UUID REFERENCES public.trade_roles(id),
  kyc_verified BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trade_id, user_id)
);

ALTER TABLE public.trade_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view" ON public.trade_participants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can join" ON public.trade_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own" ON public.trade_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all" ON public.trade_participants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Add share code to trades for invite links
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS max_participants INT DEFAULT 4;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS require_kyc BOOLEAN DEFAULT true;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_trade_participants_trade ON public.trade_participants(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_share_code ON public.trades(share_code);
