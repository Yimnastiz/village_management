"use client";

import { type ChangeEvent, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { normalizePersonNameInput, normalizeThaiNationalIdInput, normalizeThaiPhoneInput, PERSON_GENDER_VALUES } from "@/lib/person-validation";

type InputProps = ComponentProps<typeof Input>;

function setNormalizedValue(input: HTMLInputElement, normalize: (value: string) => string) {
  const value = normalize(input.value);
  if (value !== input.value) input.value = value;
}

function isComposing(event: ChangeEvent<HTMLInputElement>) {
  return "isComposing" in event.nativeEvent && event.nativeEvent.isComposing === true;
}

/** IME-safe person name input. It filters digits after composition ends. */
export function PersonNameInput({ onChange, onCompositionEnd, ...props }: InputProps) {
  return <Input {...props} onChange={(event) => { if (!isComposing(event)) setNormalizedValue(event.currentTarget, normalizePersonNameInput); onChange?.(event); }} onCompositionEnd={(event) => { setNormalizedValue(event.currentTarget, normalizePersonNameInput); onCompositionEnd?.(event); }} maxLength={100} />;
}

export function ThaiNationalIdInput({ onChange, ...props }: InputProps) {
  return <Input {...props} inputMode="numeric" maxLength={13} onChange={(event) => { setNormalizedValue(event.currentTarget, normalizeThaiNationalIdInput); onChange?.(event); }} />;
}

export function ThaiPhoneInput({ onChange, ...props }: InputProps) {
  return <Input {...props} inputMode="tel" maxLength={10} onChange={(event) => { setNormalizedValue(event.currentTarget, normalizeThaiPhoneInput); onChange?.(event); }} />;
}

export function PersonGenderSelect(props: Omit<ComponentProps<typeof Select>, "options">) {
  return <Select {...props} options={PERSON_GENDER_VALUES.map((value) => ({ value, label: value }))} />;
}
