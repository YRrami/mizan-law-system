import type { HTMLAttributes } from "react";

type LogoMarkProps = {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  rounded?: string;
  className?: string;
  imgClassName?: string;
} & HTMLAttributes<HTMLDivElement>;

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-14 w-14",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
  "2xl": "h-24 w-24",
};

export default function LogoMark({
  size = "md",
  rounded = "rounded-[22px]",
  className = "",
  imgClassName = "",
  ...props
}: LogoMarkProps) {
  return (
    <div
      {...props}
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-md ring-1 ring-black/5 ${sizeClasses[size]} ${rounded} ${className}`}
    >
      <img
        src="/logo.png"
        alt="مؤسسة ياسر الرفاعي للمحاماة"
        className={`h-full w-full object-contain p-1 ${imgClassName}`}
        draggable={false}
      />
    </div>
  );
}
