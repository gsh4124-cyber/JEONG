import type { Context, ContextFilterValue } from "@/lib/planning/types";
import styles from "./planning-context.module.css";

export function ContextFilter({ contexts, value, onChange, ariaLabel = "Context 필터" }: {
  contexts: Context[];
  value: ContextFilterValue;
  onChange: (value: ContextFilterValue) => void;
  ariaLabel?: string;
}) {
  return <div className={styles.filter} role="group" aria-label={ariaLabel}>
    <button type="button" data-active={value === "ALL"} onClick={() => onChange("ALL")}>전체</button>
    {contexts.filter((context) => context.isActive).sort((a,b) => a.sortOrder-b.sortOrder).map((context) =>
      <button type="button" key={context.id} data-active={value === context.key} onClick={() => onChange(context.key)}>
        {context.icon} {context.name}
      </button>)}
  </div>;
}
