import { describe, expect, it } from "vitest";
import { canAccessPath, isKnownProtectedPath } from "../routes/permissions";

const menus = [
  {
    key: "dashboard",
    label: "首页工作台",
    path: "/",
    permissionCode: "menu.dashboard.view"
  },
  {
    key: "tasks",
    label: "任务看板",
    path: "/tasks",
    permissionCode: "menu.tasks.view"
  }
];

describe("route permission helpers", () => {
  it("allows exact and nested paths from visible menus", () => {
    expect(canAccessPath("/", menus)).toBe(true);
    expect(canAccessPath("/tasks", menus)).toBe(true);
    expect(canAccessPath("/tasks/123", menus)).toBe(true);
  });

  it("blocks paths that are not in visible menus", () => {
    expect(canAccessPath("/admin", menus)).toBe(false);
  });

  it("recognizes protected application routes", () => {
    expect(isKnownProtectedPath("/requirements")).toBe(true);
    expect(isKnownProtectedPath("/unknown")).toBe(false);
  });
});
