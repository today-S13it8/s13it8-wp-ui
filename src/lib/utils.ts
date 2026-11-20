import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Join class names, and let a later Tailwind class win over an earlier one
 * that sets the same thing: cn("px-2", props.className) lets a caller's
 * "px-4" replace the default instead of both landing on the element.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
