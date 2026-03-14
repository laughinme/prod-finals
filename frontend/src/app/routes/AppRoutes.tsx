import * as Sentry from "@sentry/react";
import { useRoutes } from "react-router-dom";
import { routes } from "./AppRoutes.config";

const sentryUseRoutes = Sentry.wrapUseRoutesV6(useRoutes);

export const AppRoutes = () => {
  return sentryUseRoutes(routes);
};
