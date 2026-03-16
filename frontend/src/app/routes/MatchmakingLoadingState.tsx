import { useTranslation } from "react-i18next";

export const MatchmakingLoadingState = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/20">
      <p className="text-lg text-muted-foreground">
        {t("common.loading_scenario")}
      </p>
    </div>
  );
};
