import { Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { ApiClientError, apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

export function ProfilePage() {
  const { me } = useAuth();
  const [passwordForm, setPasswordForm] = useState<Record<PasswordField, string>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordVisible, setPasswordVisible] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setSaving(true);

    try {
      await apiClient.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setSuccess("密码已修改，下次登录请使用新密码");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "密码修改失败");
    } finally {
      setSaving(false);
    }
  }

  function toggleVisible(field: PasswordField) {
    setPasswordVisible((current) => ({
      ...current,
      [field]: !current[field]
    }));
  }

  if (!me) {
    return null;
  }

  const profileFields = [
    ["姓名", me.user.displayName],
    ["工号", me.user.username],
    ["部门", me.user.department.name],
    ["职能", me.roles.map((role) => role.name).join("、")],
    ["邮箱", me.user.email]
  ];

  const passwordFields: Array<[PasswordField, string, string]> = [
    ["currentPassword", "当前密码", "current-password"],
    ["newPassword", "新密码", "new-password"],
    ["confirmPassword", "确认新密码", "new-password"]
  ];

  return (
    <div className="page-content profile-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">个人信息</span>
            <h2>我的账号</h2>
          </div>
        </div>
        <div className="profile-summary">
          <div className="profile-summary-avatar">
            <UserRound size={28} aria-hidden="true" />
          </div>
          <div>
            <h3>{me.user.displayName}</h3>
            <span>
              {me.user.department.name} · {me.user.username}
            </span>
          </div>
        </div>
        <div className="detail-grid profile-detail-grid">
          {profileFields.map(([label, value]) => (
            <div className="detail-field" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="content-band profile-password-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">安全设置</span>
            <h3>修改密码</h3>
          </div>
          <KeyRound size={20} aria-hidden="true" />
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {success ? <div className="form-success">{success}</div> : null}
        <form className="password-change-form" onSubmit={handleChangePassword}>
          <div className="form-grid two-columns">
            {passwordFields.map(([field, label, autoComplete]) => (
              <label key={field}>
                <span>{label}</span>
                <div className="password-field">
                  <input
                    type={passwordVisible[field] ? "text" : "password"}
                    value={passwordForm[field]}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        [field]: event.target.value
                      })
                    }
                    autoComplete={autoComplete}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    title={passwordVisible[field] ? "隐藏密码" : "显示密码"}
                    onClick={() => toggleVisible(field)}
                  >
                    {passwordVisible[field] ? (
                      <EyeOff size={17} aria-hidden="true" />
                    ) : (
                      <Eye size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button className="primary-button inline-action" type="submit" disabled={saving}>
              {saving ? "保存中" : "保存新密码"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
