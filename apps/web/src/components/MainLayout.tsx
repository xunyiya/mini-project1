import {
  Bell,
  Boxes,
  Bug,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  Gauge,
  GitPullRequestArrow,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Network,
  Settings,
  ShieldAlert,
  UsersRound
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

const iconMap = {
  dashboard: LayoutDashboard,
  requirements: FileText,
  reviews: ClipboardCheck,
  projects: Boxes,
  tasks: CalendarCheck,
  meetings: MessageSquareText,
  risks: ShieldAlert,
  changes: GitPullRequestArrow,
  defects: Bug,
  releases: Gauge,
  notifications: Bell,
  people: Network,
  admin: Settings
};

export function MainLayout() {
  const { me, logout } = useAuth();
  const menus = me?.visibleMenus ?? [];
  const notificationMenu = menus.find((menu) => menu.key === "notifications");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">协</div>
          <div>
            <strong>多部门协同</strong>
            <span>研发交付工作台</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="主菜单">
          {menus.map((menu) => {
            const Icon = iconMap[menu.key as keyof typeof iconMap] ?? LayoutDashboard;
            return (
              <NavLink
                end={menu.path === "/"}
                key={menu.key}
                to={menu.path}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{menu.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">{me?.organization.name}</span>
            <h1>{me?.user.displayName}</h1>
          </div>
          <div className="top-actions">
            {notificationMenu ? (
              <NavLink className="icon-button" title="消息中心" to={notificationMenu.path}>
                <Bell size={19} />
                {me?.unreadNotificationCount ? (
                  <span className="badge">{me.unreadNotificationCount}</span>
                ) : null}
              </NavLink>
            ) : null}
            <div className="user-chip">
              <UsersRound size={17} aria-hidden="true" />
              <span>{me?.user.department.name}</span>
            </div>
            <button className="icon-button" title="退出登录" type="button" onClick={() => void logout()}>
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
