import type { WorkflowTemplate } from "@collab/shared";
import { REVIEW_NODE_TYPE_LABELS } from "@collab/shared";
import { GitBranch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

export function WorkflowTemplatesPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setTemplates(await apiClient.workflowTemplates("REQUIREMENT"));
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "流程模板加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="page-content workflow-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">权限配置</span>
            <h2>流程模板</h2>
          </div>
          <div className="permission-meter">
            <GitBranch size={18} aria-hidden="true" />
            <span>{templates.length} 个模板</span>
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      {loading ? (
        <StateBlock type="loading" title="正在加载流程模板" />
      ) : templates.length === 0 ? (
        <StateBlock type="empty" title="暂无流程模板" />
      ) : (
        <div className="workflow-template-list">
          {templates.map((template) => (
            <section className="content-band workflow-template" key={template.id}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {template.isDefault ? "默认模板" : "自定义模板"} ·{" "}
                    {template.enabled ? "已启用" : "已停用"}
                  </span>
                  <h3>{template.name}</h3>
                </div>
              </div>
              <p className="muted-text">{template.description}</p>
              <div className="workflow-node-list">
                {[...template.nodesConfig]
                  .sort((left, right) => left.orderIndex - right.orderIndex)
                  .map((node) => (
                    <div className="workflow-node-card" key={`${template.id}-${node.orderIndex}`}>
                      <strong>{node.nodeName}</strong>
                      <span>{REVIEW_NODE_TYPE_LABELS[node.nodeType]}</span>
                      <small>{node.required ? "必需节点" : "可选节点"}</small>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
