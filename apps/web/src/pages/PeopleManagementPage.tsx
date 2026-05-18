import type { CreateUserInput, DepartmentWithLeader, SafeUser } from "@collab/shared";
import { Plus, ShieldCheck, Trash2, UserCog, UserMinus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiClientError, apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { StateBlock } from "../components/StateBlock";

const defaultForm = {
  displayName: "",
  email: "",
  title: "",
  password: "Demo@123456"
};

function restoreScrollPosition(scrollY: number) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
    });
  });
}

export function PeopleManagementPage() {
  const { me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDepartmentId = searchParams.get("departmentId");
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    requestedDepartmentId ?? me?.managedDepartmentIds[0] ?? me?.user.departmentId ?? ""
  );
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = useMemo(() => me?.availableActions.people ?? [], [me?.availableActions.people]);
  const visibleDepartments = useMemo(
    () => {
      const manageableDepartmentIds = new Set(me?.managedDepartmentIds ?? []);
      return departments.filter(
        (department) =>
          me?.isAdmin ||
          manageableDepartmentIds.has(department.id) ||
          department.id === me?.user.departmentId
      );
    },
    [departments, me?.isAdmin, me?.managedDepartmentIds, me?.user.departmentId]
  );
  const selectedDepartment = visibleDepartments.find(
    (department) => department.id === selectedDepartmentId
  );

  function replaceDepartment(updatedDepartment: DepartmentWithLeader) {
    setDepartments((currentDepartments) =>
      currentDepartments.map((department) =>
        department.id === updatedDepartment.id ? updatedDepartment : department
      )
    );
  }

  const updateSelectedDepartment = useCallback(
    (departmentId: string) => {
      setSelectedDepartmentId(departmentId);
      if (requestedDepartmentId !== departmentId) {
        setSearchParams(
          departmentId ? { departmentId } : {},
          { replace: true, preventScrollReset: true }
        );
      }
    },
    [requestedDepartmentId, setSearchParams]
  );

  const loadData = useCallback(async (nextDepartmentId = selectedDepartmentId) => {
    setLoading(true);
    setError(null);

    try {
      const [departmentPage, userPage] = await Promise.all([
        apiClient.departments(1, 100),
        apiClient.users(1, 100, nextDepartmentId)
      ]);
      setDepartments(departmentPage.items);
      setUsers(userPage.items);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "成员数据加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    void loadData(selectedDepartmentId);
  }, [loadData, selectedDepartmentId]);

  useEffect(() => {
    if (requestedDepartmentId && requestedDepartmentId !== selectedDepartmentId) {
      setSelectedDepartmentId(requestedDepartmentId);
    }
  }, [requestedDepartmentId, selectedDepartmentId]);

  useEffect(() => {
    if (visibleDepartments.length === 0) {
      return;
    }

    const selectedIsVisible = visibleDepartments.some(
      (department) => department.id === selectedDepartmentId
    );

    if (!selectedDepartmentId || !selectedIsVisible) {
      updateSelectedDepartment(visibleDepartments[0].id);
    }
  }, [selectedDepartmentId, updateSelectedDepartment, visibleDepartments]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDepartmentId) {
      setError("请选择职能");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateUserInput = {
      departmentId: selectedDepartmentId,
      displayName: form.displayName,
      email: form.email,
      title: form.title,
      password: form.password
    };

    try {
      await apiClient.createUser(payload);
      setForm(defaultForm);
      await loadData(selectedDepartmentId);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "账号创建失败";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string) {
    setSaving(true);
    setError(null);

    try {
      await apiClient.deleteUser(userId);
      await loadData(selectedDepartmentId);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "账号删除失败";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePromote(user: SafeUser) {
    setSaving(true);
    setError(null);
    const scrollY = window.scrollY;
    const departmentToKeep = user.departmentId;
    updateSelectedDepartment(departmentToKeep);

    try {
      const updatedDepartment = await apiClient.updateDepartmentLeader(departmentToKeep, {
        userId: user.id
      });
      replaceDepartment(updatedDepartment);
      updateSelectedDepartment(departmentToKeep);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "负责人更新失败";
      setError(message);
    } finally {
      setSaving(false);
      restoreScrollPosition(scrollY);
    }
  }

  async function handleDemote(user: SafeUser) {
    setSaving(true);
    setError(null);
    const scrollY = window.scrollY;
    const departmentToKeep = user.departmentId;
    updateSelectedDepartment(departmentToKeep);

    try {
      const updatedDepartment = await apiClient.removeDepartmentLeader(departmentToKeep, user.id);
      replaceDepartment(updatedDepartment);
      updateSelectedDepartment(departmentToKeep);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "负责人移除失败";
      setError(message);
    } finally {
      setSaving(false);
      restoreScrollPosition(scrollY);
    }
  }

  if (loading && departments.length === 0) {
    return (
      <div className="page-content">
        <StateBlock type="loading" title="正在加载成员" />
      </div>
    );
  }

  return (
    <div className="page-content people-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">职能成员</span>
            <h2>{selectedDepartment?.name ?? "成员管理"}</h2>
          </div>
          <select
            className="department-switch"
            value={selectedDepartmentId}
            onChange={(event) => updateSelectedDepartment(event.target.value)}
          >
            {visibleDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        {selectedDepartment ? (
          <div className="leader-strip">
            <ShieldCheck size={19} aria-hidden="true" />
            <strong>
              负责人：
              {selectedDepartment.leaders.length > 0
                ? selectedDepartment.leaders.map((leader) => leader.displayName).join("、")
                : "未设置"}
            </strong>
            <span>{selectedDepartment.memberCount} 个有效账号</span>
          </div>
        ) : null}
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      {actions.includes("create") ? (
        <section className="content-band">
          <div className="section-heading">
            <h3>创建账号</h3>
            <span>工号由系统从 10001 开始按职能自动编排</span>
          </div>
          <form className="people-form" onSubmit={handleCreate}>
            <label>
              <span>姓名</span>
              <input
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                placeholder="成员姓名"
              />
            </label>
            <label>
              <span>邮箱</span>
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="demo@example.com"
              />
            </label>
            <label>
              <span>岗位</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="岗位名称"
              />
            </label>
            <label>
              <span>初始密码</span>
              <input
                value={form.password}
                type="password"
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              <Plus size={18} aria-hidden="true" />
              <span>{saving ? "处理中" : "创建账号"}</span>
            </button>
          </form>
        </section>
      ) : null}

      <section className="content-band">
        <div className="section-heading">
          <h3>成员列表</h3>
          <span>{users.length} 人</span>
        </div>
        {users.length === 0 ? (
          <StateBlock type="empty" title="暂无成员" />
        ) : (
          <div className="people-table">
            {users.map((user) => {
              const isLeader = selectedDepartment?.leaderUserIds.includes(user.id) ?? false;
              const isAdminUser = user.roles.some((role) => role.code === "admin");
              const canDelete =
                actions.includes("delete") &&
                !isLeader &&
                user.id !== me?.user.id &&
                (!isAdminUser || Boolean(me?.isAdmin));
              const canPromote = actions.includes("promoteLeader") && !isLeader;
              const canDemote =
                actions.includes("demoteLeader") &&
                isLeader &&
                (selectedDepartment?.leaderUserIds.length ?? 0) > 1;

              return (
                <div className="people-row" key={user.id}>
                  <div>
                    <strong>{user.displayName}</strong>
                    <span>
                      工号 {user.username} · {user.title}
                    </span>
                  </div>
                  <span className={`status-pill ${isLeader ? "status-leader" : ""}`}>
                    {isLeader ? "负责人" : user.roles.map((role) => role.name).join("、")}
                  </span>
                  <div className="row-actions">
                    {canPromote ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={saving}
                        onClick={() => void handlePromote(user)}
                      >
                        <UserCog size={16} aria-hidden="true" />
                        <span>设为负责人</span>
                      </button>
                    ) : null}
                    {canDemote ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDemote(user)}
                      >
                        <UserMinus size={16} aria-hidden="true" />
                        <span>移除负责人</span>
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        className="danger-button"
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDelete(user.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        <span>删除</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
