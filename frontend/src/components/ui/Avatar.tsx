import * as React from "react"
import { cn } from "@/lib/utils"

const Avatar = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
    {children}
  </div>
)

const AvatarImage = ({ src, alt = "Avatar", className }: { src: string, alt?: string, className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} className={cn("aspect-square h-full w-full", className)} />
)

const AvatarFallback = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>
    {children}
  </div>
)

export { Avatar, AvatarImage, AvatarFallback }
