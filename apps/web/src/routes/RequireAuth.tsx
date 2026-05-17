import { Navigate, Outlet, useLocation } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { useAuth } from "../lib/auth-context";
import { canAccessPath, isKnownProtectedPath } from "./permissions";
import { ForbiddenPage } from "../pages/ForbiddenPage";

export function RequireAuth() {
  const { loading, me } = useAuth();
  const location = useLocation();

  if (loading) {
    return <StateBlock type="loading" title="正在加载" />;
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isKnownProtectedPath(location.pathname) && !canAccessPath(location.pathname, me.visibleMenus)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
