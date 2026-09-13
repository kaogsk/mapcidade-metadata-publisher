"use client";

/** Primitivas de formulário no tema escuro "sala de controle". */
import { forwardRef } from "react";

export function Panel({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel animate-fade-up p-6 md:p-7 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-5 flex items-start gap-3">
          {icon && (
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gp-bar5/25 bg-gp-abyss/50 text-gp-bar5">
              {icon}
            </span>
          )}
          <div>
            {title && (
              <h2 className="font-display text-[17px] font-bold tracking-tight text-white">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 font-body text-[13px] text-gp-darkgray">{subtitle}</p>
            )}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}
export function Field({ label, hint, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <label className="gp-label">{label}</label>
      {children}
      {hint && <p className="mt-1 font-body text-[11.5px] text-gp-darkgray/70">{hint}</p>}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <input ref={ref} {...props} className={`gp-input ${props.className ?? ""}`} />;
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea(props: TextareaProps) {
  return <textarea {...props} className={`gp-input ${props.className ?? ""}`} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;
export function Select(props: SelectProps) {
  return <select {...props} className={`gp-input ${props.className ?? ""}`} />;
}

export function Button({
  variant = "primary",
  children,
  className = "",
  ...rest
}: {
  variant?: "primary" | "ghost" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls =
    variant === "primary"
      ? "gp-btn-primary"
      : variant === "danger"
        ? "gp-btn-danger"
        : "gp-btn-ghost";
  return (
    <button {...rest} className={`${cls} ${className}`}>
      {children}
    </button>
  );
}

/** Aviso/erro/sucesso inline. */
export function Alert({
  kind,
  children,
}: {
  kind: "info" | "success" | "error" | "warn";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    info: "border-gp-bar4/30 bg-gp-bar4/10 text-gp-lightgray",
    success: "border-gp-bar7/40 bg-gp-bar7/10 text-gp-offwhite",
    error: "border-gp-warn/50 bg-gp-warn/10 text-[#f6c3ac]",
    warn: "border-gp-warn/40 bg-gp-warn/10 text-[#f2cbb6]",
  };
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 font-body text-[13px] ${map[kind]}`}>
      {children}
    </div>
  );
}
