import type { BugTicketView, ProjectView, RequirementView, SafeUser } from "@collab/shared";
import { ArrowLeft } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BugTicketForm,
  bugFormFromTicket,
  buildBugPayload,
  defaultBugForm,
  type BugFormState
} from "../components/BugTicketForm";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

export function BugTicketFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bugTicket, setBugTicket] = useState<BugTicketView | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [requirements, setRequirements] = useState<RequirementView[]>([]);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [form, setForm] = useState<BugFormState>(defaultBugForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [detail, userPage, requirementPage, projectPage] = await Promise.all([
        apiClient.bugTicket(id),
        apiClient.users(1, 100),
        apiClient.requirements({ page: 1, pageSize: 100 }),
        apiClient.projects({ page: 1, pageSize: 100 })
      ]);

      setBugTicket(detail);
      setForm(bugFormFromTicket(detail));
      setUsers(userPage.items);
      setRequirements(requirementPage.items);
      setProjects(projectPage.items);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "bug单加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const savedBugTicket = await apiClient.updateBugTicket(id, buildBugPayload(form));
      navigate(`/defects/${savedBugTicket.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "bug单保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content bug-page">
        <StateBlock type="loading" title="正在加载bug单" />
      </div>
    );
  }

  if (!bugTicket) {
    return (
      <div className="page-content bug-page">
        <StateBlock type="error" title={error ?? "bug单不存在"} />
      </div>
    );
  }

  if (!bugTicket.availableActions.includes("edit")) {
    return (
      <div className="page-content bug-page">
        <section className="content-band">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{bugTicket.code}</span>
              <h2>{bugTicket.title}</h2>
            </div>
            <Link className="ghost-button" to={`/defects/${bugTicket.id}`}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回详情</span>
            </Link>
          </div>
          <StateBlock type="error" title="当前用户只能查看该bug单" description="只有发现人、处理人、bug关联人可以修改。" />
        </section>
      </div>
    );
  }

  return (
    <div className="page-content bug-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{bugTicket.code}</span>
            <h2>编辑bug单</h2>
          </div>
          <Link className="ghost-button" to={`/defects/${bugTicket.id}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>返回详情</span>
          </Link>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <BugTicketForm
          form={form}
          users={users}
          requirements={requirements}
          projects={projects}
          saving={saving}
          submitLabel="保存修改"
          onCancel={() => navigate(`/defects/${bugTicket.id}`)}
          onChange={setForm}
          onSubmit={handleSave}
        />
      </section>
    </div>
  );
}
