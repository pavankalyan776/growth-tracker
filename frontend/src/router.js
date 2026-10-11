import { useCallback, useEffect, useState } from "react";

/* Tiny hash router: #/today, #/today/2026-10-03, #/admin/users ... Back/forward and deep links just work,
   and it needs no server rewrites on Vercel. */
function parse() {
  const raw = (window.location.hash || "").replace(/^#\/?/, "");
  const [name = "today", ...rest] = raw.split("/").filter(Boolean);
  return { name, param: rest.join("/") || null };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = useCallback((path) => {
    const target = `#/${String(path).replace(/^#?\/?/, "")}`;
    if (window.location.hash === target) setRoute(parse());
    else window.location.hash = target;
    window.scrollTo({ top: 0 });
  }, []);
  return { ...route, navigate };
}
