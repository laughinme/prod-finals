import { routes } from "./AppRoutes.config";
import { sentryUseRoutes } from "./sentryUseRoutes";

export const AppRoutes = () => {
  return sentryUseRoutes(routes);
};
