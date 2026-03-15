import { useContext } from "react";

import { MatchNotificationsContext } from "./context";

export const useMatchNotifications = () => useContext(MatchNotificationsContext);
