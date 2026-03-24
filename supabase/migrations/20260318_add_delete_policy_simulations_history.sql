DROP POLICY IF EXISTS "Users can delete simulations" ON simulations_history;

GRANT DELETE ON TABLE simulations_history TO authenticated;

CREATE POLICY "Users can delete simulations"
  ON simulations_history
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'area' = 'Pricing'
    )
  );
