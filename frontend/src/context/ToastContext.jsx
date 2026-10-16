import { createContext, useContext, useState } from 'react';
import { IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import './Toast.css';
const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = (message, type = 'success') => { const id = Date.now() + Math.random(); setItems(v => [...v, { id, message, type }]); setTimeout(() => setItems(v => v.filter(x => x.id !== id)), 3800); };
  return <ToastContext.Provider value={toast}>{children}<div className="toast-stack">{items.map(t => <div className={`toast toast-${t.type}`} key={t.id}>{t.type === 'error' ? <IconInfoCircle/> : <IconCircleCheck/>}<span>{t.message}</span><button onClick={() => setItems(v => v.filter(x => x.id !== t.id))}><IconX size={16}/></button></div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
