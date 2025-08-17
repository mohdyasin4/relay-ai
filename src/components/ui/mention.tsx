import * as MentionPrimitive from "@diceui/mention";
import * as React from "react";

import { cn } from "@/lib/utils";

const Mention = React.forwardRef<
  React.ComponentRef<typeof MentionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MentionPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MentionPrimitive.Root
    data-slot="mention"
    ref={ref}
    className={cn(
      "[--dice-transform-origin:8px] **:data-tag:rounded-full **:data-tag:px-2.5 **:data-tag:py-0.5 **:data-tag:pb-1 **:data-tag:text-[12px] **:data-tag:font-semibold **:data-tag:bg-primary **:data-tag:text-primary-foreground **:data-tag:ring-1 **:data-tag:ring-border/40 dark:**:data-tag:bg-primary dark:**:data-tag:text-primary-foreground",
      className,
    )}
    {...props}
  />
));
Mention.displayName = MentionPrimitive.Root.displayName;

const MentionLabel = React.forwardRef<
  React.ComponentRef<typeof MentionPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MentionPrimitive.Label>
>(({ className, ...props }, ref) => (
  <MentionPrimitive.Label
    data-slot="mention-label"
    ref={ref}
    className={cn("px-0.5 py-1.5 font-semibold text-sm", className)}
    {...props}
  />
));
MentionLabel.displayName = MentionPrimitive.Label.displayName;

const MentionInput = React.forwardRef<
  React.ComponentRef<typeof MentionPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof MentionPrimitive.Input>
>(({ className, ...props }, ref) => (
  <MentionPrimitive.Input
    data-slot="mention-input"
    ref={ref}
    className={cn(
      "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
MentionInput.displayName = MentionPrimitive.Input.displayName;

const MentionContent = React.forwardRef<
  React.ComponentRef<typeof MentionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MentionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <MentionPrimitive.Content
    data-slot="mention-content"
    ref={ref}
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 min-w-[8rem] max-h-[40vh] overflow-auto overscroll-contain rounded-lg border bg-popover/95 backdrop-blur-md p-1 text-popover-foreground shadow-xl ring-1 ring-border/50 data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
    {...props}
  >
    {children}
  </MentionPrimitive.Content>
));
MentionContent.displayName = MentionPrimitive.Content.displayName;

const MentionItem = React.forwardRef<
  React.ComponentRef<typeof MentionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MentionPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <MentionPrimitive.Item
    data-slot="mention-item"
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </MentionPrimitive.Item>
));
MentionItem.displayName = MentionPrimitive.Item.displayName;

export { Mention, MentionContent, MentionInput, MentionItem, MentionLabel };
