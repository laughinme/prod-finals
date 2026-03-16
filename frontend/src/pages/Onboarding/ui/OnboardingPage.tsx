import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col bg-background md:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-secondary/30 px-5 py-8 md:p-16 lg:p-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 md:mb-8 md:size-20"
        >
          <HeartHandshake className="size-6 text-primary-foreground md:size-10" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-3 text-3xl leading-tight font-bold tracking-tight md:mb-6 md:text-7xl"
        >
          {t("onboarding.title_part1")}
          <br />
          {t("onboarding.title_part2")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-xl text-base text-muted-foreground md:text-xl"
        >
          {t("onboarding.description")}
        </motion.p>
      </div>

      <div className="flex flex-1 flex-col justify-center border-t border-border bg-card px-5 py-6 md:border-t-0 md:border-l md:p-16 lg:p-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 space-y-5 md:mb-12 md:space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-4 md:gap-5"
            >
              <div className="mt-1 h-fit rounded-xl bg-primary/10 p-3 md:rounded-2xl md:p-4">
                <Activity className="size-5 text-primary md:size-7" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold md:mb-2 md:text-xl">{t("onboarding.smart_matching_title")}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {t("onboarding.smart_matching_description")}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-4 md:gap-5"
            >
              <div className="mt-1 h-fit rounded-xl bg-primary/10 p-3 md:rounded-2xl md:p-4">
                <ShieldCheck className="size-5 text-primary md:size-7" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold md:mb-2 md:text-xl">{t("onboarding.privacy_title")}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {t("onboarding.privacy_description")}
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="border-t border-border pt-5 md:pt-8"
          >
            <Button
              size="lg"
              className="h-12 w-full gap-2 rounded-2xl text-base font-semibold md:h-14 md:text-lg"
              onClick={() => navigate("/quiz", { replace: true })}
            >
              {t("onboarding.create_profile")}
              <ArrowRight className="size-5" />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground md:mt-4 md:text-sm">
              {t("onboarding.tos_agreement")}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
