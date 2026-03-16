import * as Sentry from "@sentry/react";
import { useRoutes } from "react-router-dom";

export const sentryUseRoutes = Sentry.wrapUseRoutesV6(useRoutes);
