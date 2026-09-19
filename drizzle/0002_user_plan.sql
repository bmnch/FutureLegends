-- Account-level entitlement (premium skips Stripe checkout)
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
