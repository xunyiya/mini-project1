import type { MenuItem } from "@collab/shared";

export const knownProtectedPaths = [
  "/",
  "/requirements",
  "/reviews",
  "/projects",
  "/tasks",
  "/meetings",
  "/risks",
  "/changes",
  "/defects",
  "/releases",
  "/notifications",
  "/people",
  "/admin"
];

export function isKnownProtectedPath(pathname: string) {
  return knownProtectedPaths.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`))
  );
}

export function canAccessPath(pathname: string, menus: MenuItem[]) {
  return menus.some((menu) => {
    if (menu.path === "/") {
      return pathname === "/";
    }

    return pathname === menu.path || pathname.startsWith(`${menu.path}/`);
  });
}
