"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { useUnidadPeso } from "@/lib/hooks/use-unidad-peso";

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

type UnidadPeso = "tn" | "kg";

function CampoPesoControlado({
  id,
  label,
  error,
  valorKg,
  unidad,
  setUnidad,
  onChangeKg,
}: {
  id: string;
  label: string;
  error?: string;
  valorKg: string | undefined;
  unidad: UnidadPeso;
  setUnidad: (u: UnidadPeso) => void;
  onChangeKg: (kg: string) => void;
}) {
  const kg = valorKg !== undefined && valorKg !== "" ? Number(valorKg) : undefined;
  const [texto, setTexto] = useState(() =>
    kg === undefined || Number.isNaN(kg) ? "" : String(unidad === "tn" ? kg / 1000 : kg)
  );

  function cambiarUnidad(nueva: UnidadPeso) {
    setUnidad(nueva);
    if (kg !== undefined && !Number.isNaN(kg)) {
      setTexto(String(nueva === "tn" ? kg / 1000 : kg));
    }
  }

  function onChangeTexto(valor: string) {
    setTexto(valor);
    const normalizado = valor.trim().replace(",", ".");
    if (normalizado === "") {
      onChangeKg("");
      return;
    }
    const num = Number(normalizado);
    if (Number.isNaN(num)) return;
    onChangeKg(String(unidad === "tn" ? num * 1000 : num));
  }

  const equivalente =
    kg === undefined || Number.isNaN(kg)
      ? null
      : unidad === "tn"
        ? `≈ ${kg.toFixed(0)} kg`
        : `≈ ${(kg / 1000).toFixed(3)} tn`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          className="flex-1"
        />
        <div className="flex overflow-hidden rounded-md border">
          {(["tn", "kg"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => cambiarUnidad(u)}
              className={cn(
                "px-2 text-sm",
                unidad === u
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      {equivalente && <p className="text-xs text-muted-foreground">{equivalente}</p>}
      <ErrorCampo mensaje={error} />
    </div>
  );
}

/**
 * Campo de peso: el form siempre guarda kg (lo que pide la base), pero el
 * usuario puede tipear en tn o kg con un selector que recuerda su última
 * elección, mostrando siempre el equivalente en la otra unidad.
 */
export function CampoPeso<T extends FieldValues>({ form, name, label }: CampoBase<T>) {
  const [unidad, setUnidad] = useUnidadPeso();
  const error = form.formState.errors[name]?.message as string | undefined;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <CampoPesoControlado
          id={name}
          label={label}
          error={error}
          valorKg={field.value}
          unidad={unidad}
          setUnidad={setUnidad}
          onChangeKg={field.onChange}
        />
      )}
    />
  );
}
