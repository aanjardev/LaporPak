"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

export function PasswordField({
  label, name, value, onChange, autoComplete, disabled, validate,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  validate?: (value: string) => string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const customError = validate?.(value) || "";
  const error = touched ? !value ? "Wajib diisi." : value.length < 8 ? "Minimal 8 karakter." : customError : "";

  useEffect(() => { inputRef.current?.setCustomValidity(customError); }, [customError]);

  return <label htmlFor={id} className="block text-sm font-semibold">
    {label}<span className="ml-1 text-rose-600" aria-hidden="true">*</span>
    <span className="relative mt-1.5 block">
      <input
        id={id}
        ref={inputRef}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => { event.currentTarget.setCustomValidity(validate?.(event.currentTarget.value) || ""); onChange(event); }}
        onBlur={() => setTouched(true)}
        onInvalid={(event) => { event.preventDefault(); setTouched(true); }}
        autoComplete={autoComplete}
        minLength={8}
        maxLength={72}
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`ui-control px-3 pr-12 disabled:bg-muted ${error ? "border-rose-500" : ""}`}
      />
      <button type="button" onClick={() => setVisible((current) => !current)} disabled={disabled} aria-label={visible ? "Sembunyikan kata sandi" : "Lihat kata sandi"} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50">
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
    {error && <span id={`${id}-error`} className="mt-1 block text-xs font-normal text-rose-700">{error}</span>}
  </label>;
}
