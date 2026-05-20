defmodule Diversif.Repo.Migrations.InitialSchema do
  use Ecto.Migration

  def change do
    create table(:users) do
      add :email, :text, null: false
      add :password_hash, :text, null: false
      add :display_name, :text, null: false
      add :created_at, :utc_datetime_usec, null: false
      add :tos_accepted_at, :utc_datetime_usec
      add :privacy_accepted_at, :utc_datetime_usec
      add :age_confirmed_at, :utc_datetime_usec
      add :last_login_at, :utc_datetime_usec
      add :last_export_at, :utc_datetime_usec
    end

    create unique_index(:users, [:email])
    create index(:users, [:last_login_at], name: :users_last_login_at_idx)

    create table(:sessions, primary_key: false) do
      add :id, :text, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :expires_at, :utc_datetime_usec, null: false
    end

    create index(:sessions, [:expires_at], name: :sessions_expires_at_idx)

    create table(:children) do
      add :name, :text, null: false
      add :birth_date, :text, null: false
      add :created_by, references(:users, on_delete: :nilify_all)
      add :created_at, :utc_datetime_usec, null: false
    end

    create table(:memberships, primary_key: false) do
      add :user_id, references(:users, on_delete: :delete_all),
        primary_key: true,
        null: false

      add :child_id, references(:children, on_delete: :delete_all),
        primary_key: true,
        null: false

      add :role, :text, null: false
      add :created_at, :utc_datetime_usec, null: false
    end

    create constraint(:memberships, :memberships_role_check,
             check: "role IN ('owner', 'member')"
           )

    create table(:invitations, primary_key: false) do
      add :code, :text, primary_key: true
      add :child_id, references(:children, on_delete: :delete_all), null: false
      add :created_by, references(:users, on_delete: :nilify_all)
      add :created_at, :utc_datetime_usec, null: false
      add :expires_at, :utc_datetime_usec, null: false
      add :used_at, :utc_datetime_usec
      add :used_by, references(:users, on_delete: :nilify_all)
    end

    create index(:invitations, [:expires_at], name: :invitations_expires_at_idx)

    create table(:foods) do
      add :name, :text, null: false
      add :category, :text, null: false
      add :is_major_allergen, :boolean, null: false, default: false
      add :allergen_type, :text
      add :suggested_age_months, :integer, null: false
      add :notes, :text
      add :is_custom, :boolean, null: false, default: false
      add :custom_for_child_id, references(:children, on_delete: :delete_all)
    end

    create index(:foods, [:custom_for_child_id], name: :foods_custom_for_child_idx)

    create unique_index(:foods, [:name],
             where: "is_custom = false",
             name: :foods_name_seed_idx
           )

    create table(:food_entries) do
      add :child_id, references(:children, on_delete: :delete_all), null: false
      add :food_id, references(:foods, on_delete: :restrict), null: false
      add :given_at, :utc_datetime_usec, null: false
      add :reaction, :text, null: false
      add :texture, :text
      add :notes, :text
      add :logged_by, references(:users, on_delete: :nilify_all)
      add :created_at, :utc_datetime_usec, null: false
    end

    create index(:food_entries, [:child_id, :given_at], name: :food_entries_child_idx)

    create constraint(:food_entries, :food_entries_reaction_check,
             check: "reaction IN ('ras', 'inconfort', 'reaction')"
           )

    create constraint(:food_entries, :food_entries_texture_check,
             check:
               "texture IN ('lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger')"
           )

    create table(:tip_dismissals, primary_key: false) do
      add :user_id, references(:users, on_delete: :delete_all),
        primary_key: true,
        null: false

      add :child_id, references(:children, on_delete: :delete_all),
        primary_key: true,
        null: false

      add :reminder_key, :text, primary_key: true, null: false
      add :dismissed_at, :utc_datetime_usec, null: false
    end

    create table(:passkeys, primary_key: false) do
      add :id, :text, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :public_key, :text, null: false
      add :counter, :integer, null: false, default: 0
      add :transports, :jsonb, null: false, default: "[]"
      add :device_type, :text, null: false
      add :backed_up, :boolean, null: false
      add :name, :text, null: false
      add :created_at, :utc_datetime_usec, null: false
      add :last_used_at, :utc_datetime_usec
    end

    create index(:passkeys, [:user_id], name: :passkeys_user_idx)

    create constraint(:passkeys, :passkeys_device_type_check,
             check: "device_type IN ('singleDevice', 'multiDevice')"
           )

    create table(:webauthn_challenges, primary_key: false) do
      add :token, :text, primary_key: true
      add :challenge, :text, null: false
      add :purpose, :text, null: false
      add :user_id, references(:users, on_delete: :delete_all)
      add :expires_at, :utc_datetime_usec, null: false
    end

    create index(:webauthn_challenges, [:expires_at], name: :webauthn_challenges_expires_idx)

    create constraint(:webauthn_challenges, :webauthn_challenges_purpose_check,
             check: "purpose IN ('registration', 'authentication')"
           )

    create table(:idempotency_keys, primary_key: false) do
      add :key, :text, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :scope, :text, null: false
      add :redirect, :text
      add :created_at, :utc_datetime_usec, null: false
    end

    create index(:idempotency_keys, [:created_at], name: :idempotency_keys_created_at_idx)

    create table(:symptoms) do
      add :food_entry_id, references(:food_entries, on_delete: :delete_all), null: false
      add :child_id, references(:children, on_delete: :delete_all), null: false
      add :observed_at, :utc_datetime_usec, null: false
      add :label, :text, null: false
      add :note, :text
      add :created_at, :utc_datetime_usec, null: false, default: fragment("now()")
      add :created_by, references(:users, on_delete: :nilify_all)
    end

    create index(:symptoms, [:food_entry_id], name: :symptoms_food_entry_id_idx)

    create index(:symptoms, [:child_id, :observed_at],
             name: :symptoms_child_id_observed_at_idx
           )

    create constraint(:symptoms, :symptoms_label_check,
             check:
               "label IN ('rougeur', 'urticaire', 'eczema', 'vomissement', 'diarrhee', 'gonflement', 'toux', 'detresse-respiratoire', 'levres-bleues', 'autre')"
           )
  end
end
