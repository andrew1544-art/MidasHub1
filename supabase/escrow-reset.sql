-- ===========================================
-- RESET ESCROW SETTINGS FOR ADMIN PANEL
-- ===========================================
-- Run this to clear sample payment methods
-- Then add real ones from your admin panel

-- Clear sample escrow payment methods
DELETE FROM public.escrow_settings;

-- Insert placeholder entries that YOU will update with real details
-- Either update these directly in Table Editor or from your admin panel
INSERT INTO public.escrow_settings (method_name, method_icon, details, currency, is_active, display_order) VALUES
  ('Bank Transfer (USD)', '🏦', 'ADMIN: Update with your bank details in Table Editor or Admin Panel', 'USD', false, 1),
  ('Bank Transfer (NGN)', '🏦', 'ADMIN: Update with your Nigerian bank details', 'NGN', false, 2),
  ('Bank Transfer (KES)', '🏦', 'ADMIN: Update with your Kenyan bank details', 'KES', false, 3),
  ('PayPal', '💳', 'ADMIN: Update with your PayPal email', 'USD', false, 4),
  ('Bitcoin (BTC)', '₿', 'ADMIN: Update with your BTC wallet address', 'BTC', false, 5),
  ('USDT (TRC20)', '💎', 'ADMIN: Update with your USDT TRC20 wallet', 'USDT', false, 6),
  ('USDT (ERC20)', '💎', 'ADMIN: Update with your USDT ERC20 wallet', 'USDT', false, 7),
  ('Ethereum (ETH)', '⟠', 'ADMIN: Update with your ETH wallet address', 'ETH', false, 8),
  ('M-Pesa', '📱', 'ADMIN: Update with your M-Pesa paybill/till', 'KES', false, 9),
  ('Opay', '📲', 'ADMIN: Update with your Opay account number', 'NGN', false, 10),
  ('Palmpay', '📲', 'ADMIN: Update with your Palmpay account', 'NGN', false, 11),
  ('Cash App', '💵', 'ADMIN: Update with your Cash App $tag', 'USD', false, 12),
  ('Wise (TransferWise)', '🌐', 'ADMIN: Update with your Wise account details', 'USD', false, 13),
  ('GBP Bank Transfer', '🏦', 'ADMIN: Update with your UK bank details', 'GBP', false, 14),
  ('EUR Bank Transfer', '🏦', 'ADMIN: Update with your EU bank details', 'EUR', false, 15);

-- ============================================
-- HOW TO ACTIVATE PAYMENT METHODS:
-- ============================================
-- 1. Go to Supabase → Table Editor → escrow_settings
-- 2. Click on a row → Edit the "details" field with your REAL payment info
-- 3. Set "is_active" to TRUE for methods you want to show
-- 4. Only active methods appear to buyers
-- 
-- OR do it from your future Admin Panel
-- ============================================

-- Also update trade categories to include more digital service types
DELETE FROM public.trade_categories;
INSERT INTO public.trade_categories (name, icon, description, requires_kyc, is_active) VALUES
  ('Electronics', '📱', 'Phones, laptops, gadgets, accessories', true, true),
  ('Fashion & Beauty', '👗', 'Clothing, shoes, bags, jewelry, cosmetics', true, true),
  ('Graphic Design', '🎨', 'Logos, banners, flyers, branding, UI/UX', true, true),
  ('Web & App Dev', '💻', 'Websites, apps, plugins, scripts, hosting', true, true),
  ('Social Media', '📢', 'Account management, growth, content creation, shoutouts', true, true),
  ('Writing & Translation', '✍️', 'Articles, copywriting, translation, editing', true, true),
  ('Video & Animation', '🎬', 'Video editing, motion graphics, intros, ads', true, true),
  ('Music & Audio', '🎵', 'Beats, mixing, voiceovers, jingles, podcasts', true, true),
  ('Gaming', '🎮', 'Accounts, items, boosting, coaching, gift cards', true, true),
  ('Education & Tutoring', '📚', 'Online classes, homework help, courses, mentoring', true, true),
  ('Crypto & Finance', '₿', 'Crypto trading, P2P, financial consulting', true, true),
  ('Marketing & SEO', '📈', 'SEO, ads management, email marketing, funnels', true, true),
  ('Photography', '📸', 'Photo shoots, editing, retouching, stock photos', true, true),
  ('Vehicles & Parts', '🚗', 'Cars, bikes, parts, repairs', true, true),
  ('Real Estate', '🏠', 'Property, rentals, rooms, land', true, true),
  ('Food & Catering', '🍔', 'Food delivery, meal prep, recipes, catering', false, true),
  ('Health & Fitness', '💪', 'Personal training, diet plans, wellness coaching', true, true),
  ('Legal & Business', '📋', 'Business registration, contracts, consulting', true, true),
  ('Other Services', '🔧', 'Anything else — repairs, errands, custom work', true, true),
  ('Digital Products', '📦', 'Templates, presets, ebooks, courses, software', true, true);
