import { AlertCircle, Inbox, Loader2 } from "lucide-react";

type StateBlockProps = {
  type: "loading" | "empty" | "error";
  title: string;
  description?: string;
};

export function StateBlock({ type, title, description }: StateBlockProps) {
  const Icon = type === "loading" ? Loader2 : type === "error" ? AlertCircle : Inbox;

  return (
    <div className={`state-block state-block-${type}`} role={type === "error" ? "alert" : "status"}>
      <Icon className="state-icon" aria-hidden="true" />
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </div>
  );
}
