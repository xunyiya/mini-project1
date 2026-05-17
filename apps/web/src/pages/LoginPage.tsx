import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, LogIn } from "lucide-react";
import { ApiClientError } from "../lib/api";
import { apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { LoginOptions } from "@collab/shared";

export function LoginPage() {
  const { me, login } = useAuth();
  const location = useLocation();
  const [loginOptions, setLoginOptions] = useState<LoginOptions | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("Demo@123456");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
  const selectedDepartment = useMemo(
    () => loginOptions?.departments.find((department) => department.id === departmentId),
    [departmentId, loginOptions]
  );

  useEffect(() => {
    let mounted = true;

    apiClient
      .loginOptions()
      .then((options) => {
        if (!mounted) {
          return;
        }

        setLoginOptions(options);
        const initialDepartment = options.departments[0];
        setDepartmentId(initialDepartment?.id ?? "");
      })
      .catch(() => {
        if (mounted) {
          setError("登录选项加载失败，请确认后端服务已启动");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (me) {
    return <Navigate to={from} replace />;
  }

  function handleDepartmentChange(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId);
    setLoginName("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(departmentId, loginName, password);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "登录失败，请稍后重试";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-copy">
          <span className="eyebrow">Day 1 MVP</span>
          <h1>多部门协同工具</h1>
          <p>需求、评审、项目、任务、风险、上线和审计从同一个入口开始。</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-title">
            <LockKeyhole size={22} aria-hidden="true" />
            <strong>登录</strong>
          </div>
          <label>
            <span>职能</span>
            <select
              value={departmentId}
              onChange={(event) => handleDepartmentChange(event.target.value)}
              disabled={!loginOptions}
            >
              {loginOptions?.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          {selectedDepartment ? (
            <div className="login-meta">
              <strong>负责人：{selectedDepartment.leader?.displayName ?? "未设置"}</strong>
              <span>{selectedDepartment.description}</span>
            </div>
          ) : null}
          <label>
            <span>工号</span>
            <input
              value={loginName}
              onChange={(event) => setLoginName(event.target.value)}
              inputMode="numeric"
              autoComplete="username"
              disabled={!selectedDepartment}
              placeholder="请输入工号，例如 10001"
            />
          </label>
          <label>
            <span>密码</span>
            <div className="password-field">
              <input
                value={password}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="password-toggle"
                type="button"
                title={showPassword ? "隐藏密码" : "显示密码"}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button
            className="primary-button"
            type="submit"
            disabled={submitting || !departmentId || !loginName}
          >
            <LogIn size={18} aria-hidden="true" />
            <span>{submitting ? "登录中" : "进入系统"}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
