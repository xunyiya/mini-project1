import { ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth-context";

export function DashboardPage() {
  const { me } = useAuth();
  const actionEntries = Object.entries(me?.availableActions ?? {}).filter(
    ([, actions]) => actions.length > 0
  );

  return (
    <div className="page-content">
      <section className="workspace-hero">
        <div>
          <span className="eyebrow">当前身份</span>
          <h2>{me?.roles.map((role) => role.name).join("、")}</h2>
          <p>{me?.user.title} · {me?.user.department.name}</p>
        </div>
        <div className="permission-meter">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>{me?.permissions.length ?? 0} 项权限</span>
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>按钮权限摘要</h3>
          <span>字段权限已预留</span>
        </div>
        {actionEntries.length > 0 ? (
          <div className="action-list">
            {actionEntries.map(([moduleName, actions]) => (
              <div className="action-row" key={moduleName}>
                <strong>{moduleName}</strong>
                <span>{actions.join(" / ")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="soft-empty">当前角色暂无按钮级操作权限</div>
        )}
      </section>
    </div>
  );
}
