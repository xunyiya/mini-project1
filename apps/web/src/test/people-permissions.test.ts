import { describe, expect, it } from "vitest";
import { canAccessPath } from "../routes/permissions";

describe("people route permissions", () => {
  it("allows people route only when the menu is visible", () => {
    expect(
      canAccessPath("/people", [
        {
          key: "people",
          label: "职能成员",
          path: "/people",
          permissionCode: "menu.people.manage"
        }
      ])
    ).toBe(true);
    expect(canAccessPath("/people", [])).toBe(false);
  });
});
