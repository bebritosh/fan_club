import { createContext, useContext, useEffect, useState } from 'react';
import { getProfile, loginRequest, registerRequest } from '../services/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(Boolean(localStorage.getItem('fc_access')));
  useEffect(() => { if (!localStorage.getItem('fc_access')) return; getProfile().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const login = async credentials => { const tokens = await loginRequest(credentials); localStorage.setItem('fc_access', tokens.access); localStorage.setItem('fc_refresh', tokens.refresh); setUser(await getProfile()); };
  const register = async payload => { await registerRequest(payload); await login({ username: payload.username, password: payload.password }); };
  const logout = () => { localStorage.removeItem('fc_access'); localStorage.removeItem('fc_refresh'); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
