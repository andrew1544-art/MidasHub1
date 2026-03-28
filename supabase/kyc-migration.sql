-- ===========================================
-- MIDASHUB KYC / TRADE VERIFICATION
-- ===========================================
-- Run this in Supabase SQL Editor

-- Add identity fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_full_name TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_phone TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_country TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_id_type TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_id_number TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_id_photo_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_selfie_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_admin_note TEXT DEFAULT '';

-- Trade categories (admin-managed)
CREATE TABLE IF NOT EXISTS public.trade_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  requires_kyc BOOLEAN DEFAULT true,
  min_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add category to trades
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.trade_categories(id);

-- RLS for trade_categories (public read, admin write)
ALTER TABLE public.trade_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_cats_read" ON public.trade_categories FOR SELECT USING (true);

-- Insert default categories
INSERT INTO public.trade_categories (name, icon, description, requires_kyc) VALUES
  ('Electronics', '📱', 'Phones, laptops, gadgets, accessories', true),
  ('Fashion', '👗', 'Clothing, shoes, bags, jewelry', true),
  ('Digital Services', '💻', 'Design, coding, writing, marketing', true),
  ('Gaming', '🎮', 'Accounts, items, consoles, gift cards', true),
  ('Vehicles', '🚗', 'Cars, bikes, parts', true),
  ('Real Estate', '🏠', 'Property, rentals, rooms', true),
  ('Crypto & Finance', '₿', 'Crypto trading, financial services', true),
  ('Art & Collectibles', '🎨', 'Artwork, NFTs, collectible items', true),
  ('Food & Drinks', '🍔', 'Food delivery, recipes, catering', false),
  ('Other', '📦', 'Anything else', true)
ON CONFLICT DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_kyc ON public.profiles(kyc_status);
