ALTER TABLE food_entries
  ADD COLUMN texture TEXT
  CHECK (texture IN ('lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger'));
