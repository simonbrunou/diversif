defmodule Diversif.Repo.Migrations.AuditEvents do
  use Ecto.Migration

  def change do
    create table(:audit_events) do
      add :user_id, references(:users, on_delete: :nilify_all)
      add :event, :text, null: false
      add :ip, :text
      add :meta, :jsonb, null: false, default: "{}"
      add :created_at, :utc_datetime_usec, null: false, default: fragment("now()")
    end

    create index(:audit_events, [:user_id, :created_at])
    create index(:audit_events, [:event, :created_at])
  end
end
