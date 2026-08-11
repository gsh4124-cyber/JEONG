"use client";

import { useEffect, useState } from "react";
import type { ContextFilterValue } from "./types";

const STORAGE_KEY = "jeong_active_context_filter";
const VALID_FILTERS: ContextFilterValue[] = ["ALL", "PERSONAL", "WORK", "CHURCH"];

export function usePlanningContextFilter() {
  const [value, setValue] = useState<ContextFilterValue>("ALL");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ContextFilterValue | null;
    if (saved && VALID_FILTERS.includes(saved)) setValue(saved);
  }, []);

  const update = (next: ContextFilterValue) => {
    setValue(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return [value, update] as const;
}
