import { useCallback, useRef, useState } from "react";
import type { Api, TimelineItem } from "./api";

/** Toda la biblioteca por páginas (lo más reciente primero). `reset` empieza de cero; `more` pide la página siguiente. */
export function useTimeline() {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState(false);
  const next = useRef<string | null>(null);
  const done = useRef(false);
  const busy = useRef(false);

  const load = useCallback(async (api: Api, fresh: boolean) => {
    if (busy.current || (!fresh && done.current)) return;
    busy.current = true;
    try {
      const r = await api.timeline(fresh ? null : next.current);
      next.current = r.next;
      done.current = r.next === null;
      setItems((prev) => (fresh || !prev ? r.items : [...prev, ...r.items]));
      setError(false);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
    }
  }, []);
  const reset = useCallback(
    (api: Api) => {
      done.current = false;
      busy.current = false;
      next.current = null;
      return load(api, true);
    },
    [load],
  );
  return { items, error, reset, more: (api: Api) => load(api, false) };
}
