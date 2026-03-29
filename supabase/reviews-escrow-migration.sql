-- ===========================================
-- TRADE REVIEWS + ESCROW PAYMENT CONFIG
-- ===========================================

-- 1. Trade reviews — both parties rate each other after completion
CREATE TABLE IF NOT EXISTS public.trade_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trade_id, reviewer_id) -- one review per person per trade
);

ALTER TABLE public.trade_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read" ON public.trade_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON public.trade_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Add review stats to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Function to recalculate user rating after review
CREATE OR REPLACE FUNCTION public.update_trade_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET
    trade_rating = COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM public.trade_reviews WHERE reviewed_id = NEW.reviewed_id), 0),
    total_reviews = (SELECT COUNT(*) FROM public.trade_reviews WHERE reviewed_id = NEW.reviewed_id)
  WHERE id = NEW.reviewed_id;
  
  -- Award XP for leaving a review
  PERFORM public.award_xp(NEW.reviewer_id, 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS review_rating_trigger ON public.trade_reviews;
CREATE TRIGGER review_rating_trigger AFTER INSERT ON public.trade_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_trade_rating();

-- 2. Escrow payment settings — admin configures where buyers send money
CREATE TABLE IF NOT EXISTS public.escrow_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  method_name TEXT NOT NULL,        -- e.g. "Bank Transfer", "PayPal", "Bitcoin", "M-Pesa"
  method_icon TEXT DEFAULT '💰',
  details TEXT NOT NULL,            -- payment details (account number, wallet address, etc)
  currency TEXT DEFAULT 'USD',      -- which currency this method accepts
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.escrow_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escrow_read" ON public.escrow_settings FOR SELECT USING (true);

-- Insert sample escrow payment methods (ADMIN: update these with real details!)
INSERT INTO public.escrow_settings (method_name, method_icon, details, currency, display_order) VALUES
  ('Bank Transfer', '🏦', 'Bank: [Your Bank Name]\nAccount Name: MidasHub Escrow\nAccount Number: [Your Account]\nRouting: [Your Routing]', 'USD', 1),
  ('PayPal', '💳', 'Send to: escrow@midashub.com\nNote: Include Trade ID', 'USD', 2),
  ('Bitcoin (BTC)', '₿', 'Wallet: [Your BTC Wallet Address]\nNetwork: Bitcoin\nInclude Trade ID in memo', 'BTC', 3),
  ('USDT (TRC20)', '💎', 'Wallet: [Your USDT Wallet]\nNetwork: TRC20\nInclude Trade ID in memo', 'USDT', 4),
  ('M-Pesa', '📱', 'Paybill: [Your Paybill]\nAccount: MidasHub\nInclude Trade ID', 'KES', 5),
  ('Opay / Palmpay', '📲', 'Account: [Your Number]\nName: MidasHub Escrow\nInclude Trade ID', 'NGN', 6)
ON CONFLICT DO NOTHING;

-- 3. Add escrow tracking fields to trades
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS escrow_payment_method TEXT DEFAULT '';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS escrow_payment_ref TEXT DEFAULT '';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS escrow_confirmed BOOLEAN DEFAULT false;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS delivery_estimate TEXT DEFAULT '';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS buyer_reviewed BOOLEAN DEFAULT false;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS seller_reviewed BOOLEAN DEFAULT false;

-- Backfill trade_count for existing users
UPDATE public.profiles SET trade_count = (
  SELECT COUNT(*) FROM public.trades 
  WHERE (seller_id = profiles.id OR buyer_id = profiles.id) AND status = 'completed'
);
