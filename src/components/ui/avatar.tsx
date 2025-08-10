"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  onError,
  loading = "lazy",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const handleError: React.ComponentProps<typeof AvatarPrimitive.Image>["onError"] = (e) => {
    try {
      const img = e.currentTarget as HTMLImageElement & { _failed?: boolean }
      // prevent infinite loop
      if (!img._failed) {
        img._failed = true
        img.src = "/placeholder.svg"
      }
    } catch {}
    onError?.(e)
  }
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      loading={loading}
      onError={handleError}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
