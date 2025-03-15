import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses = "rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 transition-colors flex items-center justify-center";

  const variantClasses = variant === "primary"
    ? "bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
    : "border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent";

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}