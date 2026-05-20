defmodule Diversif.Repo.Migrations.DropSymptomsCreatedAtDefault do
  use Ecto.Migration

  # Mirrors the edit to migration 0001: app-stamped timestamps are the rule
  # for consistency across audit ordering, so symptoms.created_at no longer
  # carries a SQL `now()` default. New rows must set it explicitly.
  def up do
    execute("ALTER TABLE symptoms ALTER COLUMN created_at DROP DEFAULT")
  end

  def down do
    execute("ALTER TABLE symptoms ALTER COLUMN created_at SET DEFAULT now()")
  end
end
