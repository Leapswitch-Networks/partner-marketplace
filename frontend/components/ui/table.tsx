'use client';

import * as React from "react"

import { cn } from "@/lib/utils/cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full"
    >
      <table
        data-slot="table"
        className={cn("w-full border-collapse caption-bottom text-xs text-foreground 2xl:text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-10 [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        // Zebra stripe: `muted` is #eff3f2 — the brand teal at 8% over white.
        // The card underneath is `surface-wash` #eaf0ef, the same teal at 10%,
        // so the striped row is a *lighter* green than the one above it rather
        // than a darker one. It was `bg-muted/30`, which composited to ≈#ebf1f0
        // — a 1-point difference nobody could see, which is why the rows read as
        // one block. Full opacity is the visible version of the same colour.
        //
        // Hover must beat both, and it must be brand rather than grey:
        // `UI_PATTERNS.md` § The Signed-In Chrome Is Green — "never hover to a
        // grey, it reads as a smudge on green". `brand/10` over the wash lands
        // at ≈#d6e2e0, clear of both stripe states.
        "[&_tr:nth-child(even)]:bg-muted [&_tr:hover]:bg-brand/10 dark:[&_tr:hover]:bg-brand/20 [&_tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
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
        "data-[state=selected]:bg-muted border-b border-border/60 transition-colors",
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
        // `border-b`, NOT `border`. The vertical hairlines were `border-border/60`
        // — a near-white #e6edef — drawn between every header cell, and the header
        // row is filled `bg-brand`. White rules on brand green read as damage to
        // the fill rather than as column separation, and nothing else in this
        // design separates columns that way. The bottom edge stays: that one
        // divides the header from the rows, which is a real boundary.
        //
        // Size follows the table's own `text-xs 2xl:text-sm` rather than
        // overriding it at 2xl (it was `text-[0.9375rem]`, 15px against the
        // cells' 14px). The header is distinguished by weight — the vendor row
        // sets `[&>th]:font-bold` — not by being a size of its own.
        "text-muted-foreground h-10 px-3 text-left align-middle font-medium whitespace-nowrap border-b border-border/60 2xl:h-11 2xl:px-3.5 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
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
        // `py-0.5` gave 2px above and below a 16px line — a ~20px row, which is
        // why consecutive records read as one merged block. `py-2` is 8px, for a
        // ~32px row: enough air to see where one record ends without spending the
        // vertical space a dense index page needs.
        //
        // Callers that need a cell tight again override per column — `#` uses
        // `px-0.5` and the actions cell `!px-0`, both of which still win here.
        "px-3 py-2 align-middle whitespace-nowrap border-x border-border/40 2xl:px-3.5 2xl:py-2.5 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
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
      className={cn("text-muted-foreground mt-4 text-sm", className)}
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
