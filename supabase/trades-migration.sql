-- ===========================================
-- MIDASHUB TRADE & ESCROW SYSTEM
-- ===========================================
-- Run this in Supabase SQL Editor

-- ============ TRADES TABLE ============
CREATE TABLE public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Trade details
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD',
  escrow_fee DECIMAL(12,2) GENERATED ALWAYS AS (amount * 0.02) STORED,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (amount * 1.02) STORED,
  
  -- Status flow: pending → accepted → paid → delivered → completed / disputed → resolved
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Seller proposed, waiting for buyer to accept
    'accepted',     -- Buyer accepted terms
    'paid',         -- Buyer marked as paid (escrow holding)
    'delivered',    -- Seller marked as delivered
    'completed',    -- Buyer confirmed receipt — funds released
    'disputed',     -- Either party raised a dispute
    'resolved',     -- Admin resolved the dispute
    'cancelled'     -- Either party cancelled before payment
  )),
  
  -- Payment info
  payment_method TEXT DEFAULT '',
  payment_proof_url TEXT DEFAULT '',
  delivery_proof_url TEXT DEFAULT '',
  
  -- Dispute
  dispute_reason TEXT DEFAULT '',
  dispute_by UUID REFERENCES public.profiles(id),
  admin_note TEXT DEFAULT '',
  resolved_in_favor_of UUID REFERENCES public.profiles(id),
  
  -- Timestamps
  accepted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============ TRADE MESSAGES ============
-- Separate from regular chat — trade-specific messages with system events
CREATE TABLE public.trade_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false, -- system messages like "Buyer marked as paid"
  media_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ INDEXES ============
CREATE INDEX idx_trades_conversation ON public.trades(conversation_id);
CREATE INDEX idx_trades_seller ON public.trades(seller_id);
CREATE INDEX idx_trades_buyer ON public.trades(buyer_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trade_messages_trade ON public.trade_messages(trade_id, created_at);

-- ============ RLS ============
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_messages ENABLE ROW LEVEL SECURITY;

-- Trades: only seller and buyer can see their trades
CREATE POLICY "trades_read" ON public.trades FOR SELECT USING (
  auth.uid() = seller_id OR auth.uid() = buyer_id
);
CREATE POLICY "trades_insert" ON public.trades FOR INSERT WITH CHECK (
  auth.uid() = seller_id OR auth.uid() = buyer_id
);
CREATE POLICY "trades_update" ON public.trades FOR UPDATE USING (
  auth.uid() = seller_id OR auth.uid() = buyer_id
);

-- Trade messages
CREATE POLICY "trade_msgs_read" ON public.trade_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.trades WHERE id = trade_id AND (seller_id = auth.uid() OR buyer_id = auth.uid()))
);
CREATE POLICY "trade_msgs_insert" ON public.trade_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id OR is_system = true
);

-- ============ SYSTEM MESSAGE FUNCTION ============
CREATE OR REPLACE FUNCTION public.trade_system_message(p_trade_id UUID, p_content TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO public.trade_messages (trade_id, content, is_system)
  VALUES (p_trade_id, p_content, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ TRADE STATUS CHANGE TRIGGER ============
CREATE OR REPLACE FUNCTION public.on_trade_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- Log system message
    IF NEW.status = 'accepted' THEN
      PERFORM public.trade_system_message(NEW.id, '✅ Trade accepted by buyer. Waiting for payment.');
      NEW.accepted_at = now();
    ELSIF NEW.status = 'paid' THEN
      PERFORM public.trade_system_message(NEW.id, '💰 Buyer marked as paid. Funds are in escrow. Waiting for delivery.');
      NEW.paid_at = now();
    ELSIF NEW.status = 'delivered' THEN
      PERFORM public.trade_system_message(NEW.id, '📦 Seller marked as delivered. Buyer please confirm receipt.');
      NEW.delivered_at = now();
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.trade_system_message(NEW.id, '🎉 Trade completed! Funds released to seller. Thank you!');
      NEW.completed_at = now();
      -- Award XP
      PERFORM public.award_xp(NEW.seller_id, 20);
      PERFORM public.award_xp(NEW.buyer_id, 10);
    ELSIF NEW.status = 'disputed' THEN
      PERFORM public.trade_system_message(NEW.id, '⚠️ Trade disputed. MidasHub admin will review. Do not send any more payments.');
      NEW.disputed_at = now();
    ELSIF NEW.status = 'resolved' THEN
      PERFORM public.trade_system_message(NEW.id, '⚖️ Dispute resolved by admin. Check admin note for details.');
      NEW.resolved_at = now();
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.trade_system_message(NEW.id, '❌ Trade cancelled.');
      NEW.cancelled_at = now();
    END IF;
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trade_status_trigger
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.on_trade_status_change();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_messages;
