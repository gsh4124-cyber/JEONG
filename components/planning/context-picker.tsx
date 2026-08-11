import type { Context } from "@/lib/planning/types";
import styles from "./planning-context.module.css";

type Props = {
  contexts: Context[];
  value?: string;
  onChange: (contextId: string | undefined) => void;
  label?: string;
  allowUnassigned?: boolean;
};

export function ContextPicker({ contexts, value, onChange, label = "Context", allowUnassigned = true }: Props) {
  return <label className={styles.picker}>
    <span>{label}</span>
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
      {allowUnassigned && <option value="">미지정</option>}
      {contexts.filter((context) => context.isActive).sort((a,b) => a.sortOrder-b.sortOrder).map((context) =>
        <option key={context.id} value={context.id}>{context.icon} {context.name}</option>)}
    </select>
  </label>;
}

export function ContextTag({ contexts, contextId }: { contexts: Context[]; contextId?: string }) {
  const context = contexts.find((item) => item.id === contextId);
  if (!context) return null;
  return <span className={styles.tag}>{context.icon} {context.name}</span>;
}
