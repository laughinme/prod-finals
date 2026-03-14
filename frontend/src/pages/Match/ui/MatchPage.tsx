import { motion } from "motion/react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, MessageCircle } from "lucide-react";

import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { Button } from "@/shared/components/ui/button";

export default function MatchPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUserPreview, matchedProfile, openChat, closeMatch } =
    useMatchmakingFlow();

  if (!matchedProfile) {
    return <Navigate to="/discovery" replace />;
  }

  return (
    <div className="absolute inset-0 z-50 flex min-h-screen flex-col bg-background/95 p-8 backdrop-blur-md">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-800px w-800px -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
          className="mb-12 flex items-center justify-center gap-8"
        >
          <div className="relative z-10 h-32 w-32 overflow-hidden rounded-full border-8 border-background shadow-2xl md:h-48 md:w-48">
            <img
              src={currentUserPreview.image}
              alt="You"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="-mx-12 z-20 flex h-16 w-16 items-center justify-center rounded-full border-8 border-background bg-primary shadow-xl md:h-24 md:w-24">
            <span className="text-xl font-bold text-primary-foreground md:text-3xl">
              {matchedProfile.matchScore}%
            </span>
          </div>

          <div className="relative z-10 h-32 w-32 overflow-hidden rounded-full border-8 border-background shadow-2xl md:h-48 md:w-48">
            <img
              src={matchedProfile.image}
              alt={matchedProfile.name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 text-5xl font-bold tracking-tight md:text-7xl"
        >
          {t("match.its_a_match")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12 max-w-lg text-xl text-muted-foreground"
        >
          {t("match.match_description", { name: matchedProfile.name })}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex w-full max-w-md flex-col gap-4 sm:flex-row"
        >
          <Button
            size="lg"
            className="h-14 flex-1 gap-2 rounded-2xl text-lg font-semibold"
            onClick={() => {
              openChat(matchedProfile.id);
              navigate("/chat");
            }}
          >
            <MessageCircle className="size-5" />
            {t("match.write_message")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 flex-1 rounded-2xl text-lg"
            onClick={() => {
              closeMatch();
              navigate("/discovery");
            }}
          >
            {t("common.continue")}
            <ArrowRight className="ml-2 size-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
