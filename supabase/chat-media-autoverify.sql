-- ===========================================
-- CHAT MEDIA + AUTO-VERIFIED TRADERS
-- ===========================================

-- 1. Add media fields to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT '';

-- 2. Auto-verify traders after 2 successful trades
-- This trigger runs whenever a trade is completed
CREATE OR REPLACE FUNCTION public.auto_verify_trader()
RETURNS TRIGGER AS $$
DECLARE
  seller_completed INTEGER;
  buyer_completed INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Count completed trades for seller
    SELECT COUNT(*) INTO seller_completed FROM public.trades
    WHERE seller_id = NEW.seller_id AND status = 'completed';
    
    -- Auto-verify seller if 2+ completed trades
    IF seller_completed >= 2 THEN
      UPDATE public.profiles SET
        kyc_status = 'verified',
        kyc_verified_at = COALESCE(kyc_verified_at, now()),
        trade_count = seller_completed
      WHERE id = NEW.seller_id AND kyc_status != 'verified';
    END IF;
    -- Always update trade count for seller
    UPDATE public.profiles SET trade_count = seller_completed WHERE id = NEW.seller_id;

    -- Count completed trades for buyer
    SELECT COUNT(*) INTO buyer_completed FROM public.trades
    WHERE buyer_id = NEW.buyer_id AND status = 'completed';
    
    -- Auto-verify buyer if 2+ completed trades
    IF buyer_completed >= 2 THEN
      UPDATE public.profiles SET
        kyc_status = 'verified',
        kyc_verified_at = COALESCE(kyc_verified_at, now()),
        trade_count = buyer_completed
      WHERE id = NEW.buyer_id AND kyc_status != 'verified';
    END IF;
    -- Always update trade count for buyer
    UPDATE public.profiles SET trade_count = buyer_completed WHERE id = NEW.buyer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_verify_trigger ON public.trades;
CREATE TRIGGER auto_verify_trigger AFTER UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_trader();

-- 3. Backfill trade counts for existing users
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT seller_id AS uid FROM public.trades WHERE status = 'completed'
    UNION SELECT DISTINCT buyer_id FROM public.trades WHERE status = 'completed'
  LOOP
    UPDATE public.profiles SET trade_count = (
      SELECT COUNT(*) FROM public.trades
      WHERE (seller_id = u.uid OR buyer_id = u.uid) AND status = 'completed'
    ) WHERE id = u.uid;
  END LOOP;
END $$;

-- 4. Auto-verify any existing users with 2+ successful trades
UPDATE public.profiles SET kyc_status = 'verified', kyc_verified_at = now()
WHERE trade_count >= 2 AND kyc_status != 'verified';
