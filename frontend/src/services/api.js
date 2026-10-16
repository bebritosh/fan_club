import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api', timeout: 15000 });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('fc_access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, async error => {
  const original = error.config;
  const refresh = localStorage.getItem('fc_refresh');
  if (error.response?.status === 401 && refresh && !original._retry && !original.url?.includes('/auth/token')) {
    original._retry = true;
    try {
      const { data } = await axios.post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh });
      localStorage.setItem('fc_access', data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch { localStorage.removeItem('fc_access'); localStorage.removeItem('fc_refresh'); }
  }
  return Promise.reject(error);
});
export const getDashboard = async () => (await api.get('/dashboard/')).data;
export const getAthletes = async (params = {}) => (await api.get('/athletes/', { params })).data;
export const getAthlete = async id => { const athlete = (await api.get(`/athletes/${id}/`)).data; athlete.transfers = (athlete.transfers || []).map(t => ({ ...t, from: t.from_club_name, to: t.to_club_name })); return athlete; };
export const saveAthlete = async (data, id) => (await (id ? api.patch(`/athletes/${id}/`, data) : api.post('/athletes/', data))).data;
export const deleteAthlete = async id => api.delete(`/athletes/${id}/`);
export const getClubs = async () => (await api.get('/clubs/')).data;
export const saveClub = async (data, id) => (await (id ? api.patch(`/clubs/${id}/`, data) : api.post('/clubs/', data))).data;
export const deleteClub = async id => api.delete(`/clubs/${id}/`);
export const getTransfers = async () => { const result = (await api.get('/transfers/')).data; const rows = Array.isArray(result) ? result : result.results || []; return rows.map(t => ({ ...t, from: t.from_club_name, to: t.to_club_name })); };
export const saveTransfer = async data => (await api.post('/transfers/', data)).data;
export const updateTransfer = async (id, data) => (await api.patch(`/transfers/${id}/`, data)).data;
export const getEvents = async () => (await api.get('/events/')).data;
export const saveEvent = async data => (await api.post('/events/', data)).data;
export const deleteEvent = async id => api.delete(`/events/${id}/`);
export const getAnalytics = async () => (await api.get('/analytics/')).data;
export const getProfile = async () => (await api.get('/auth/me/')).data;
export const updateProfile = async data => (await api.patch('/auth/me/', data)).data;
export const changePassword = async data => (await api.post('/auth/password/', data)).data;
export const loginRequest = async credentials => (await api.post('/auth/token/', credentials)).data;
export const registerRequest = async data => (await api.post('/auth/register/', data)).data;
export default api;
