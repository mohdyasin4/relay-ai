import React from "react"
import { Separator } from "@/components/ui/separator"
import { motion } from "motion/react"

interface DateSeparatorProps {
  date: string
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  return (
    <motion.div
      className="relative w-full my-6 flex items-center justify-center pointer-events-none z-[6]"
      aria-label={`Messages from ${date}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >

      {/* Date label floating on top */}
      <div className="px-3 py-0.5 z-10 rounded-full text-xs font-semibold text-foreground/80 bg-muted ring-1 ring-border/60 shadow-sm">
        {date}
      </div>
      {/* Separator line */}
      <Separator className="absolute w-full" />
    </motion.div>
  )
}

export default DateSeparator
