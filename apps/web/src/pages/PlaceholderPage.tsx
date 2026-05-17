import { StateBlock } from "../components/StateBlock";
import { useAuth } from "../lib/auth-context";

type PlaceholderPageProps = {
  title: string;
  moduleKey: string;
};

export function PlaceholderPage({ title, moduleKey }: PlaceholderPageProps) {
  const { me } = useAuth();
  const actions = me?.availableActions[moduleKey] ?? [];

  return (
    <div className="page-content">
      <section className="content-band">
        <div className="section-heading">
          <h2>{title}</h2>
          {actions.length > 0 ? <span>{actions.join(" / ")}</span> : <span>只读</span>}
        </div>
        <StateBlock type="empty" title="模块骨架已就绪" description="后续迭代会接入业务列表和状态机。" />
      </section>
    </div>
  );
}
