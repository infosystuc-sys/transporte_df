"use client";

import { Controller, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CampoBase<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
};

function ErrorCampo({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return <p className="text-sm text-destructive">{mensaje}</p>;
}

export function CampoTexto<T extends FieldValues>({
  form,
  name,
  label,
  textarea,
  tipo = "text",
}: CampoBase<T> & { textarea?: boolean; tipo?: string }) {
  const error = form.formState.errors[name]?.message as string | undefined;
  const Componente = textarea ? Textarea : Input;
  return (
    <div className={`flex flex-col gap-2 ${textarea ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Componente id={name} type={tipo} {...form.register(name)} />
      <ErrorCampo mensaje={error} />
    </div>
  );
}

export function CampoBooleano<T extends FieldValues>({ form, name, label }: CampoBase<T>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor={name}>{label}</Label>
          <Switch
            id={name}
            checked={!!field.value}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  );
}

export function CampoSelect<T extends FieldValues>({
  form,
  name,
  label,
  opciones,
  placeholder = "Seleccionar...",
}: CampoBase<T> & { opciones: { value: string; label: string }[]; placeholder?: string }) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          <Label htmlFor={name}>{label}</Label>
          <Select
            value={field.value != null ? String(field.value) : undefined}
            onValueChange={field.onChange}
          >
            <SelectTrigger id={name} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErrorCampo mensaje={error} />
        </div>
      )}
    />
  );
}
