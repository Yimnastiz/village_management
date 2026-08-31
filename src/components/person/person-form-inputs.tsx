"use client";

import { type ChangeEvent, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { normalizePersonNameInput, normalizeThaiNationalIdInput, normalizeThaiPhoneInput, PERSON_GENDER_VALUES } from "@/lib/person-validation";

type InputProps = ComponentProps<typeof Input>;

function setNormalizedValue(event: ChangeEvent<HTMLInputElement>, normalize: (value: string) => string) {
  const value = normalize(event.target.value);
  if (value !== event.target.value) event.target.value = value;
}

/** IME-safe person name input. It filters digits after composition ends. */
export function PersonNameInput({ onChange, onCompositionEnd, ...props }: InputProps) {
  return <Input {...props} onChange={(event) => { if (!event.nativeEvent.isComposing) setNormalizedValue(event, normalizePersonNameInput); onChange?.(event); }} onCompositionEnd={(event) => { setNormalizedValue(event, normalizePersonNameInput); onCompositionEnd?.(event); onChange?.(event); }} maxLength={100} />;
}

export function ThaiNationalIdInput({ onChange, ...props }: InputProps) {
  return <Input {...props} inputMode="numeric" maxLength={13} onChange={(event) => { setNormalizedValue(event, normalizeThaiNationalIdInput); onChange?.(event); }} />;
}

export function ThaiPhoneInput({ onChange, ...props }: InputProps) {
  return <Input {...props} inputMode="tel" maxLength={10} onChange={(event) => { setNormalizedValue(event, normalizeThaiPhoneInput); onChange?.(event); }} />;
}

export function PersonGenderSelect(props: ComponentProps<typeof Select>) {
  return <Select {...props} options={PERSON_GENDER_VALUES.map((value) => ({ value, label: value }))} />;
}
