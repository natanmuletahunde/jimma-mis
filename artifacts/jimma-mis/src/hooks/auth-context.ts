import { createContext } from "react";
import type { User, useLogin } from "@workspace/api-client-react";

export const TOKEN_KEY = "jimma_token";

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>;
  logout: () => void;
  token: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
