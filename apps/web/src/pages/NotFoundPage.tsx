import { Link } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";

export function NotFoundPage() {
  return (
    <main className="center-page">
      <StateBlock type="empty" title="页面不存在" />
      <Link className="text-link" to="/">
        返回首页
      </Link>
    </main>
  );
}
