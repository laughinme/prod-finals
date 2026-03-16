import {
  useEffect,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import { UserRound } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface ProfileImageFallbackProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  containerClassName?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}

export function ProfileImageFallback({
  src,
  alt,
  className,
  containerClassName,
  fallbackClassName,
  iconClassName,
  onError,
  ...props
}: ProfileImageFallbackProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    onError?.(event);
  };

  return (
    <div className={cn("overflow-hidden", containerClassName)}>
      {src && !hasError ? (
        <img
          src={src}
          alt={alt ?? ""}
          className={cn("h-full w-full object-cover", className)}
          onError={handleError}
          {...props}
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "flex h-full w-full items-center justify-center bg-secondary text-muted-foreground",
            fallbackClassName,
          )}
        >
          <UserRound className={cn("size-5", iconClassName)} />
        </div>
      )}
    </div>
  );
}
