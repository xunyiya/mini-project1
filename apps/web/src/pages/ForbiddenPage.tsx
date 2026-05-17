import { Link } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";

export function ForbiddenPage() {
  return (
    <main className="center-page">
      <StateBlock type="error" title="无权访问" description="当前角色没有该路由的菜单权限。" />
      <Link className="text-link" to="/">
        返回首页
      </Link>
    </main>
  );
}
