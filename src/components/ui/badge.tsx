import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2.5 py-0.5 text-[11.5px] font-bold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        // Chip "hecho/liquidado" — pastel índigo, distinto del acento principal.
        secondary:
          "bg-[#eef0fd] text-[#4f46e5] dark:bg-[#312e81]/40 dark:text-[#a5b4fc] [a]:hover:bg-[#e2e4fb]",
        // Chip negativo/alerta — pastel rojo.
        destructive:
          "bg-[#fdecec] text-[#dc2626] dark:bg-[#7f1d1d]/40 dark:text-[#fca5a5] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-[#fbd8d8]",
        // Chip neutral — la mayoría de las etiquetas de estado.
        outline:
          "border-transparent bg-[#f1f3f7] text-[#64748b] dark:bg-white/10 dark:text-muted-foreground [a]:hover:bg-[#e6e9ef]",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
