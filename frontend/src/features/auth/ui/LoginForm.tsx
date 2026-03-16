import { type ComponentProps, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { HeartHandshake } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldError,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

type LoginFormProps = Omit<ComponentProps<"div">, "onSubmit"> & {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  errorMessage?: string | null;
  onSwitchToSignup: () => void;
};

export function LoginForm({
  className,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  submitLabel,
  disabled = false,
  submitDisabled = false,
  errorMessage,
  onSwitchToSignup,
  ...props
}: LoginFormProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary">
              <HeartHandshake className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              T-Match
            </span>
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">
              {t("auth.welcome_back")}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              {t("auth.sign_in_description")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <FieldGroup>
              <div className="flex justify-center">
                {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
              </div>
              <Field>
                <FieldLabel
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  {t("auth.email")}
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  disabled={disabled}
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground"
                />
              </Field>
              <Field>
                <FieldLabel
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  {t("auth.password")}
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  disabled={disabled}
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground"
                />
              </Field>
              <Field>
                <Button
                  type="submit"
                  disabled={submitDisabled || disabled}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitLabel}
                </Button>
                <FieldDescription className="text-center text-sm text-muted-foreground">
                  {t("auth.dont_have_account")}{" "}
                  <button
                    type="button"
                    onClick={onSwitchToSignup}
                    className="font-medium underline-offset-4 hover:underline text-primary-foreground"
                  >
                    {t("auth.sign_up")}
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
