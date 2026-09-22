"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

export function inputError(input: HTMLInputElement) {
  const validity = input.validity;
  if (validity.valueMissing) return "Wajib diisi.";
  if (validity.typeMismatch) return input.type === "email" ? "Gunakan format email yang valid." : "Format belum valid.";
  if (validity.tooShort) return `Minimal ${input.minLength} karakter.`;
  if (validity.tooLong) return `Maksimal ${input.maxLength} karakter.`;
  if (validity.patternMismatch) return input.dataset.patternMessage || "Format belum sesuai.";
  return input.validationMessage;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: string;
  optionalLabel?: boolean;
  sanitize?: "phone" | "digits";
  validate?: (value: string) => string;
};

export function ValidatedInput({
  label, hint, optionalLabel = true, sanitize, validate, required, className = "", onInput, onBlur,
  ...props
}: Props) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const descriptionId = `${id}-description`;

  function refresh(input: HTMLInputElement, show = touched) {
    const custom = validate?.(input.value) || "";
    input.setCustomValidity(custom);
    if (show) setError(inputError(input));
  }

  return <label htmlFor={id} className="block text-sm font-semibold">
    <span>{label}{required ? <span className="ml-1 text-rose-600" aria-hidden="true">*</span> : optionalLabel && !props.disabled ? <span className="ml-1 font-normal text-muted-foreground">(opsional)</span> : null}</span>
    <input
      {...props}
      id={id}
      required={required}
      aria-invalid={Boolean(error)}
      aria-describedby={(hint || error) ? descriptionId : undefined}
      className={`ui-control mt-1.5 px-3 ${error ? "border-rose-500" : ""} ${className}`}
      onInvalid={(event) => { event.preventDefault(); setTouched(true); refresh(event.currentTarget, true); }}
      onInput={(event) => {
        if (sanitize === "phone") event.currentTarget.value = event.currentTarget.value.replace(/(?!^\+)[^0-9]/g, "").replace(/^\+(?=\+)/, "+");
        if (sanitize === "digits") event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
        refresh(event.currentTarget);
        onInput?.(event);
      }}
      onBlur={(event) => { setTouched(true); refresh(event.currentTarget, true); onBlur?.(event); }}
    />
    {(error || hint) && <span id={descriptionId} className={`mt-1 block text-xs font-normal ${error ? "text-rose-700" : "text-muted-foreground"}`}>{error || hint}</span>}
  </label>;
}
