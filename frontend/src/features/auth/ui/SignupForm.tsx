import { type ComponentProps, type SubmitEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Eye, EyeOff, HeartHandshake, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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
import type { DemoAccount } from "./LoginForm";

type SignupFormProps = Omit<ComponentProps<"div">, "onSubmit"> & {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  errorMessage?: string | null;
  onSwitchToLogin: () => void;
  demoAccounts?: DemoAccount[];
  onDemoLogin?: (account: DemoAccount) => void;
};

export function SignupForm({
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
  onSwitchToLogin,
  demoAccounts,
  onDemoLogin,
  ...props
}: SignupFormProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(true);

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
              {t("auth.create_account_title")}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              {t("auth.enter_details")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <FieldGroup>
              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    disabled={disabled}
                    className="border-input bg-background pr-10 text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={disabled}
                    aria-pressed={showPassword}
                    aria-label={
                      showPassword
                        ? t("auth.hide_password", {
                            defaultValue: "Hide password",
                          })
                        : t("auth.show_password", {
                            defaultValue: "Show password",
                          })
                    }
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <FieldDescription className="text-muted-foreground">
                  {t("auth.password_hint")}
                </FieldDescription>
              </Field>
              {demoAccounts && demoAccounts.length > 0 && onDemoLogin ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsDemoOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    <span className="text-xs uppercase tracking-widest">
                      {t("auth.demo_accounts_folder_title")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        isDemoOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isDemoOpen ? (
                      <motion.div
                        key="demo-list"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-2 py-2 space-y-1">
                          {demoAccounts.map((account) => (
                            <button
                              key={account.key}
                              type="button"
                              onClick={() => onDemoLogin(account)}
                              disabled={disabled}
                              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                            >
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <User className="size-3.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground text-[13px]">
                                  {t(account.titleKey)}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {account.email} / {account.password}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {t("auth.demo_accounts_scenario_label")}:{" "}
                                  {t(account.scenarioKey)}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {t("auth.demo_accounts_categories_label")}:{" "}
                                  {t(account.categoriesKey)}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}
              <Field>
                <Button
                  type="submit"
                  disabled={submitDisabled || disabled}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitLabel}
                </Button>
                <FieldDescription className="text-center text-sm text-muted-foreground">
                  {t("auth.already_have_account")}{" "}
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="font-medium underline-offset-4 hover:underline text-primary-foreground"
                  >
                    {t("auth.sign_in")}
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-sm text-muted-foreground">
        {t("auth.tos_agreement_auth")}{" "}
        <a
          className="font-medium text-foreground hover:underline underline-offset-4"
          href="#"
        >
          {t("auth.tos")}
        </a>{" "}
        {t("auth.and")}{" "}
        <a
          className="font-medium text-foreground hover:underline underline-offset-4"
          href="#"
        >
          {t("auth.privacy_policy")}
        </a>
        .
      </FieldDescription>
    </div>
  );
}
