import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`button ${props.className ?? ''}`} />;
}
export function Field({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} {...props} /></div>;
}
export function Panel({ children }: { children: ReactNode }) { return <section className="panel">{children}</section>; }
