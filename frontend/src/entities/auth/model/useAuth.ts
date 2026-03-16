import { useContext } from "react";
import { AuthContext } from "./AuthContext";
import type { AuthContextValue } from "./types";

export const useAuth = (): AuthContextValue | null => useContext(AuthContext);
