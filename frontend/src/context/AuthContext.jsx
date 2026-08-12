import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("rr_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("rr_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) localStorage.setItem("rr_token", token);
    else localStorage.removeItem("rr_token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("rr_user", JSON.stringify(user));
    else localStorage.removeItem("rr_user");
  }, [user]);

  const applySession = (session) => {
    setToken(session.token);
    setUser(session.user);
  };

  const signup = async (email, password, name) => {
    const session = await api.signup({ email, password, name });
    applySession(session);
  };

  const login = async (email, password) => {
    const session = await api.login({ email, password });
    applySession(session);
  };

  const loginWithToken = (jwtToken, tokenUser) => {
    setToken(jwtToken);
    if (tokenUser) setUser(tokenUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, user, signup, login, loginWithToken, logout, isAuthenticated: Boolean(token) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
