-- Clover / RoomSync Supabase Row-Level Security (RLS) Migration
-- Enforces multi-tenant household isolation at the PostgreSQL engine level.

-- Helper function: verify if the authenticated user is an active member of the given household
CREATE OR REPLACE FUNCTION is_household_member(lookup_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships
    WHERE memberships.household_id = lookup_household_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'
  );
$$;

-- 1. Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Households RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their households"
  ON households FOR SELECT
  TO authenticated
  USING (is_household_member(id) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create households"
  ON households FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Household admins can update their household"
  ON households FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.household_id = households.id
        AND memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
        AND memberships.status = 'active'
    )
  );

-- 3. Memberships RLS
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view memberships of their households"
  ON memberships FOR SELECT
  TO authenticated
  USING (is_household_member(household_id) OR user_id = auth.uid());

CREATE POLICY "Admins or creators can manage memberships"
  ON memberships FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m2
      WHERE m2.household_id = memberships.household_id
        AND m2.user_id = auth.uid()
        AND m2.role = 'admin'
        AND m2.status = 'active'
    )
  );

-- 4. Expenses & Shares RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can insert expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(household_id));

CREATE POLICY "Payer or admin can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    is_household_member(household_id) AND (
      payer_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.household_id = expenses.household_id
          AND memberships.user_id = auth.uid()
          AND memberships.role = 'admin'
      )
    )
  );

ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view expense shares"
  ON expense_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
        AND is_household_member(expenses.household_id)
    )
  );

CREATE POLICY "Household members can insert expense shares"
  ON expense_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
        AND is_household_member(expenses.household_id)
    )
  );

-- 5. Settlements RLS
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view settlements"
  ON settlements FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can create settlements"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(household_id));

-- 6. Shopping Items RLS
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view shopping items"
  ON shopping_items FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can insert shopping items"
  ON shopping_items FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(household_id));

CREATE POLICY "Household members can update shopping items"
  ON shopping_items FOR UPDATE
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can delete shopping items"
  ON shopping_items FOR DELETE
  TO authenticated
  USING (is_household_member(household_id));

-- 7. Chores & Rotations RLS
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view chores"
  ON chores FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can manage chores"
  ON chores FOR ALL
  TO authenticated
  USING (is_household_member(household_id));

ALTER TABLE chore_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view chore rotations"
  ON chore_rotations FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can manage chore rotations"
  ON chore_rotations FOR ALL
  TO authenticated
  USING (is_household_member(household_id));

-- 8. Bills RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view bills"
  ON bills FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can manage bills"
  ON bills FOR ALL
  TO authenticated
  USING (is_household_member(household_id));

-- 9. Polls, Options & Votes RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view polls"
  ON polls FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Household members can manage polls"
  ON polls FOR ALL
  TO authenticated
  USING (is_household_member(household_id));

ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view poll options"
  ON poll_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM polls
      WHERE polls.id = poll_options.poll_id
        AND is_household_member(polls.household_id)
    )
  );

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view poll votes"
  ON poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM polls
      WHERE polls.id = poll_votes.poll_id
        AND is_household_member(polls.household_id)
    )
  );

CREATE POLICY "Users can vote for themselves in household polls"
  ON poll_votes FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM polls
      WHERE polls.id = poll_votes.poll_id
        AND is_household_member(polls.household_id)
    )
  );

-- 10. Household Events RLS
ALTER TABLE household_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view household activity events"
  ON household_events FOR SELECT
  TO authenticated
  USING (is_household_member(household_id));

-- Note: outbox_events and idempotency_keys are system tables accessed exclusively
-- via backend database roles (service_role or postgres pooler) and not directly exposed to client roles.
