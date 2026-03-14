import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";

export default function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full flex-1 flex-col bg-background md:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-secondary/30 p-8 md:p-16 lg:p-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 md:size-20"
        >
          <HeartHandshake className="size-8 text-primary-foreground md:size-10" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 text-5xl leading-tight font-bold tracking-tight md:text-7xl"
        >
          Знакомства по
          <br />
          образу жизни
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-xl text-lg text-muted-foreground md:text-xl"
        >
          Мы анализируем ваши привычки и ритм жизни, чтобы находить людей, с
          которыми вам действительно по пути.
        </motion.p>
      </div>

      <div className="flex flex-1 flex-col justify-center border-l border-border bg-card p-8 md:p-16 lg:p-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-5"
            >
              <div className="mt-1 h-fit rounded-2xl bg-primary/10 p-4">
                <Activity className="size-7 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Умный мэтчинг</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Рекомендации на основе агрегированных данных о досуге, любимых
                  местах и тратах.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-5"
            >
              <div className="mt-1 h-fit rounded-2xl bg-primary/10 p-4">
                <ShieldCheck className="size-7 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Приватность 100%</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Никаких точных сумм и адресов. Только общие интересы и паттерны
                  поведения.
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="border-t border-border pt-8"
          >
            <Button
              size="lg"
              className="h-14 w-full gap-2 rounded-2xl text-lg font-semibold"
              onClick={() => navigate("/profile-setup")}
            >
              Создать профиль
              <ArrowRight className="size-5" />
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Нажимая кнопку, вы соглашаетесь с правилами обработки данных.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
