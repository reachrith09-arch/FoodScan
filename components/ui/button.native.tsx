import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable } from "react-native";
import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group flex flex-row items-center justify-center gap-2 web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "rounded-xl bg-primary web:hover:opacity-90 active:opacity-90",
        pill: "rounded-full bg-primary web:hover:opacity-90 active:opacity-90",
        destructive: "rounded-xl bg-destructive web:hover:opacity-90 active:opacity-90",
        outline:
          "rounded-xl border border-border web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent",
        secondary: "rounded-xl bg-secondary web:hover:opacity-80 active:opacity-80",
        ghost:
          "rounded-xl web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent",
        link: "web:underline-offset-4 web:hover:underline web:focus:underline",
      },
      size: {
        default: "h-10 px-4 py-2 native:h-12 native:px-5 native:py-3",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-2xl px-8 native:h-14 native:min-h-[52px]",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva(
  "web:whitespace-nowrap text-base font-medium text-foreground web:transition-colors",
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        pill: "text-primary-foreground",
        destructive: "text-destructive-foreground",
        outline: "group-active:text-accent-foreground",
        secondary:
          "text-secondary-foreground group-active:text-secondary-foreground",
        ghost: "group-active:text-accent-foreground",
        link: "text-primary group-active:underline",
      },
      size: {
        default: "native:text-lg native:leading-6",
        sm: "text-sm native:text-base native:leading-5",
        lg: "text-lg native:text-xl native:leading-7",
        icon: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({
  ref,
  className,
  variant = "default",
  size,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <TextClassContext.Provider
      value={buttonTextVariants({
        variant,
        size,
        className: "web:pointer-events-none",
      })}
    >
      <Pressable
        className={cn(
          props.disabled && "web:pointer-events-none opacity-50",
          buttonVariants({ variant, size, className }),
        )}
        ref={ref}
        role="button"
        style={({ pressed }) => [
          pressed && !props.disabled && { opacity: 0.9 },
          typeof style === "function" ? (style as any)({ pressed }) : style,
        ].filter(Boolean)}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (typeof child === "string" || typeof child === "number") {
            return <Text>{child}</Text>;
          }
          return child;
        })}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };

