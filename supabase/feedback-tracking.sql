-- Feedback / Feature Requests
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'feature', -- feature, bug, complaint, other
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new', -- new, reviewing, planned, done, dismissed
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users create feedback" ON public.feedback;
CREATE POLICY "Users create feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback;
CREATE POLICY "Users read own feedback" ON public.feedback FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage feedback" ON public.feedback;
CREATE POLICY "Admins manage feedback" ON public.feedback FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Ensure auto_verify_trader function exists
CREATE OR REPLACE FUNCTION public.auto_verify_trader()
RETURNS TRIGGER AS $$
DECLARE
  seller_count INTEGER;
  buyer_count INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT COUNT(*) INTO seller_count FROM public.trades WHERE seller_id = NEW.seller_id AND status = 'completed';
    SELECT COUNT(*) INTO buyer_count FROM public.trades WHERE buyer_id = NEW.buyer_id AND status = 'completed';
    -- Update trade counts
    UPDATE public.profiles SET trade_count = seller_count WHERE id = NEW.seller_id;
    UPDATE public.profiles SET trade_count = buyer_count WHERE id = NEW.buyer_id;
    -- Auto-verify after 2 completed trades
    IF seller_count >= 2 THEN
      UPDATE public.profiles SET trade_count = seller_count WHERE id = NEW.seller_id;
    END IF;
    IF buyer_count >= 2 THEN
      UPDATE public.profiles SET trade_count = buyer_count WHERE id = NEW.buyer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_verify_trigger ON public.trades;
CREATE TRIGGER auto_verify_trigger AFTER UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_trader();
