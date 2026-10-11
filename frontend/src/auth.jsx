import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";
import { clearAccent } from "./theme";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: getToken() ? "loading" : "anon", user: null, notice: "" });

  const signOut = useCallback((notice = "") => {
    setToken("");
    clearAccent();
    setState({ status: "anon", user: null, notice });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => signOut("Your session ended. Sign in again."));
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    if (state.status !== "loading") return undefined;
    let alive = true;
    api.me()
      .then((user) => alive && setState({ status: "authed", user, notice: "" }))
      .catch((err) => {
        if (!alive) return;
        // Offline or server down: keep the token and let the user retry; a 401/403 already signed out.
        if (err.status === 0 || err.status >= 500) setState({ status: "error", user: null, notice: err.message });
        else signOut(err.status === 403 ? err.message : "");
      });
    return () => { alive = false; };
  }, [state.status, signOut]);

  const adopt = useCallback((res) => {
    setToken(res.token);
    setState({ status: "authed", user: res.user, notice: "" });
  }, []);

  const value = useMemo(() => ({
    status: state.status, user: state.user, notice: state.notice,
    login: async (email, password) => adopt(await api.login(email, password)),
    register: async (email, password, name) => adopt(await api.register(email, password, name)),
    adopt,
    setUser: (user) => setState((s) => ({ ...s, user })),
    retry: () => setState({ status: "loading", user: null, notice: "" }),
    signOut,
  }), [state, adopt, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
