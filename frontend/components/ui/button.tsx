'use client';

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 hover:scale-[.98] active:scale-[.96] motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // ⚠️ Was `btn-primary text-stone-50 shadow-xs`. **`btn-primary` is not
        // defined anywhere** — there is no `.btn-primary` rule in `globals.css`
        // or `public.css`, and the `app.css` that `tailwind.config.ts` mentions
        // does not exist. So this variant rendered near-white text on a
        // transparent background: an invisible button. It never showed because
        // the only consumer (`vendor-datatable`) uses `ghost` and `outline`
        // exclusively — a latent bug, fixed 2026-08-20 by moving it onto the
        // tokens. The border is required: lilac is 1.11:1 on the chrome ground.
        default:
          "border border-ink bg-primary text-primary-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-background hover:bg-brand/10 hover:text-brand dark:hover:bg-brand/20 dark:hover:text-brand-on-dark",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-brand/10 hover:text-brand dark:hover:bg-brand/20 dark:hover:text-brand-on-dark",
        // `text-brand`, NOT `text-primary`: `--primary` became lilac on
        // 2026-08-20 and lilac text on a light ground is **1.32:1**. A text link
        // is structure, which is the brand's job, and it needs the dark-mode
        // counterpart as a unit.
        link: "text-brand dark:text-brand-on-dark underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
