import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import bgPattern from "../assets/bgPattern.jpg"
import { cn } from "../lib/utils"

function ModeSwitch({
  className,
  size = "default",
  checked,
  ...props
}) {
  const isDefault = size !== "sm"

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={checked}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-border/50 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/30 overflow-hidden cursor-pointer shadow-sm bg-[white]",
        isDefault ? "h-[85px] w-[200px] p-2" : "h-[14px] w-[24px]",
        className
      )}
      {...props}
    >
      <img
        src={bgPattern}
        className="absolute inset-0 w-full h-full opacity-0 group-data-[state=checked]/switch:opacity-100 blur-[20px] transition-opacity duration-500 z-0"
        alt=""
      />
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 shadow-lg z-10 relative transition-transform duration-300 ease-out"
        )}
        style={{
          background: "radial-gradient(circle, rgb(255, 255, 255) 60%, rgb(82, 82, 82) 100%)",
          width: isDefault ? "70px" : "12px",
          height: isDefault ? "70px" : "12px",
          transform: isDefault
            ? checked ? "translateX(114px)" : "translateX(0px)"
            : checked ? "translateX(calc(100% - 2px))" : "translateX(0px)",
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export { ModeSwitch }
