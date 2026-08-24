"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm max-sm:block", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-muted [&_tr]:border-b [&_tr]:hover:bg-muted max-sm:hidden",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 max-sm:block", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        // En mobile la tabla se convierte en una lista de tarjetas (ver
        // TableCell) porque una tabla de varias columnas no entra en un
        // viewport angosto sin scroll horizontal.
        "max-sm:mb-2 max-sm:block max-sm:rounded-lg max-sm:border max-sm:p-2 max-sm:last:mb-0",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle text-[11.5px] font-bold tracking-[0.03em] whitespace-nowrap text-muted-foreground uppercase [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        // data-label (ver DataTable) alimenta el ::before de acá abajo,
        // que hace de encabezado de fila dentro de la tarjeta.
        "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:border-b max-sm:border-border max-sm:whitespace-normal max-sm:px-1 max-sm:py-1.5 max-sm:text-right max-sm:last:border-b-0",
        "max-sm:before:shrink-0 max-sm:before:text-left max-sm:before:text-[11px] max-sm:before:font-bold max-sm:before:tracking-[0.03em] max-sm:before:text-muted-foreground max-sm:before:uppercase max-sm:before:content-[attr(data-label)]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
