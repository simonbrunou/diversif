defmodule Diversif.Children do
  @moduledoc """
  Children context: child rows, ownership, memberships, invitations.
  Port of `src/lib/server/invitations.ts` + the membership bits of
  `src/lib/server/auth.ts`.
  """

  import Ecto.Query

  alias Diversif.Children.{Child, Invitation, Membership}
  alias Diversif.Repo
  alias Diversif.Utils.Invites

  @invite_duration_seconds 60 * 60 * 24 * 7

  # ---------------------------------------------------------------------------
  # Children & memberships
  # ---------------------------------------------------------------------------

  def list_children_for_user(user_id) when is_integer(user_id) do
    Repo.all(
      from c in Child,
        join: m in Membership,
        on: m.child_id == c.id,
        where: m.user_id == ^user_id,
        order_by: [asc: c.created_at],
        select: %{child: c, role: m.role}
    )
  end

  def get_child(id) when is_integer(id), do: Repo.get(Child, id)

  def get_membership(user_id, child_id) do
    Repo.one(from m in Membership, where: m.user_id == ^user_id and m.child_id == ^child_id)
  end

  def list_memberships_for_child(child_id) do
    Repo.all(
      from m in Membership, where: m.child_id == ^child_id, order_by: [asc: m.created_at]
    )
  end

  @doc """
  Create a child and the owner membership atomically. Returns `{:ok, child}`.
  """
  def create_child_with_owner(user_id, attrs) when is_integer(user_id) do
    now = DateTime.utc_now()
    attrs = Map.merge(attrs, %{"created_by" => user_id, "created_at" => now})

    Repo.transaction(fn ->
      with {:ok, child} <-
             %Child{} |> Child.changeset(attrs) |> Repo.insert(),
           {:ok, _} <-
             %Membership{}
             |> Membership.changeset(%{
               "user_id" => user_id,
               "child_id" => child.id,
               "role" => "owner",
               "created_at" => now
             })
             |> Repo.insert() do
        child
      else
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  def change_child(attrs \\ %{}), do: Child.changeset(%Child{}, attrs)

  def update_child(%Child{} = child, attrs) do
    child |> Child.changeset(attrs) |> Repo.update()
  end

  def delete_child(%Child{} = child), do: Repo.delete(child)

  # ---------------------------------------------------------------------------
  # Invitations
  # ---------------------------------------------------------------------------

  @doc """
  Create an invitation for a child. Retries up to 5x on unique-violation in
  case the random code collides. Mirrors `createInvitationForChild`.
  """
  def create_invitation(child_id, created_by) when is_integer(child_id) do
    now = DateTime.utc_now()
    expires_at = DateTime.add(now, @invite_duration_seconds, :second)

    result =
      Enum.reduce_while(1..5, {:error, :code_exhausted}, fn _, _ ->
        code = Invites.generate_code()

        changeset =
          Invitation.changeset(%Invitation{}, %{
            "code" => code,
            "child_id" => child_id,
            "created_by" => created_by,
            "created_at" => now,
            "expires_at" => expires_at
          })

        case Repo.insert(changeset) do
          {:ok, _} ->
            {:halt, {:ok, code}}

          # Match the unique_constraint on :code regardless of the exact
          # message text (Ecto's "has already been taken" is conventional but
          # not load-bearing).
          {:error, %Ecto.Changeset{} = cs} ->
            if Keyword.has_key?(cs.errors, :code),
              do: {:cont, {:error, :code_exhausted}},
              else: {:halt, {:error, cs}}
        end
      end)

    if match?({:error, :code_exhausted}, result) do
      require Logger
      Logger.warning("invite.code_exhausted child_id=#{child_id}")
    end

    result
  end

  @doc """
  Look up an invitation by code. Returns the row only when it's unused and
  unexpired — callers can therefore treat a `nil` result as "not actionable"
  without re-checking the time/used columns.
  """
  def find_invitation(code) when is_binary(code) do
    case Repo.get(Invitation, code) do
      nil -> nil
      %Invitation{used_at: nil, expires_at: exp} = inv ->
        if DateTime.compare(exp, DateTime.utc_now()) == :gt, do: inv, else: nil
      _ -> nil
    end
  end

  @doc """
  Accept an invitation. Two outcomes in one transaction:

  * Not-yet-member: insert the membership and mark the invite used.
  * Already-member: no-op (the user's membership stays as-is and the
    invitation is NOT consumed, so it remains valid for someone else).

  Returns `{:ok, {:joined | :already_member, %Child{}}}` on success, or
  `{:error, :race_lost}` if a concurrent acceptance burned the invite
  between `find_invitation/1` and the `update_all`. Older `{1, _} = ...`
  shape would `MatchError` and 500 in that race; this is the documented
  path that lets the caller render a friendly toast.
  """
  def accept_invitation(%Invitation{} = inv, user_id) when is_integer(user_id) do
    now = DateTime.utc_now()

    Repo.transaction(fn ->
      case get_membership(user_id, inv.child_id) do
        nil ->
          {:ok, _} =
            %Membership{}
            |> Membership.changeset(%{
              "user_id" => user_id,
              "child_id" => inv.child_id,
              "role" => "member",
              "created_at" => now
            })
            |> Repo.insert()

          {n, _} =
            from(i in Invitation, where: i.code == ^inv.code and is_nil(i.used_at))
            |> Repo.update_all(set: [used_at: now, used_by: user_id])

          if n == 0 do
            # Someone else consumed the invite between our find and update.
            # Roll back the membership so we don't grant access on a now-
            # invalid token.
            Repo.rollback(:race_lost)
          else
            {:joined, get_child(inv.child_id)}
          end

        %Membership{} ->
          {:already_member, get_child(inv.child_id)}
      end
    end)
  end
end
