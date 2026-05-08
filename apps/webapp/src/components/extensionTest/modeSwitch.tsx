import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import bgPattern from "@/assets/bgPattern.jpg"
import { cn } from "@/lib/utils"

function ModeSwitch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-border/50 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[size=default]:h-[85px] data-[size=default]:w-[200px] data-[size=default]:p-2 data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:ring-destructive/40 data-checked:bg-transparent data-unchecked:bg-[white] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "overflow-hidden relative cursor-pointer shadow-sm",
        className
      )}
      {...props}
    >
      <img src={bgPattern.src} className="w-full h-full absolute top-0 left-0 opacity-0 group-data-[state=checked]/switch:opacity-100 blur-[20px] transition-opacity" />
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-[70px] group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[114px] group-data-[size=sm]/switch:data-checked:translate-x-full group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 shadow-lg"
        style={{
          background: "radial-gradient(circle, rgb(255, 255, 255) 60%, rgb(82, 82, 82) 100%)"
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export { ModeSwitch }