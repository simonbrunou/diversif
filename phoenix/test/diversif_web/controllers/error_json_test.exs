defmodule DiversifWeb.ErrorJSONTest do
  use DiversifWeb.ConnCase, async: true

  test "renders 404" do
    assert DiversifWeb.ErrorJSON.render("404.json", %{}) == %{errors: %{detail: "Not Found"}}
  end

  test "renders 500" do
    assert DiversifWeb.ErrorJSON.render("500.json", %{}) ==
             %{errors: %{detail: "Internal Server Error"}}
  end
end
