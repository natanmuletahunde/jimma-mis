import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { User, useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react/custom-fetch";

const TOKEN_KEY = "jimma_token";

// Register custom fetch token getter
setAuthTokenGetter(() => {
  return localStorage.getItem(TOKEN_KEY);
});

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: typeof useLogin extends (...args: any[]) => infer R ? R : never;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  
  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLogin();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
  }, [queryClient]);

  useEffect(() => {
    if (loginMutation.isSuccess && loginMutation.data) {
      const newToken = loginMutation.data.token;
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      queryClient.setQueryData(getGetMeQueryKey(), loginMutation.data.user);
    }
  }, [loginMutation.isSuccess, loginMutation.data, queryClient]);

  // If token is invalid, backend might return 401, react-query will handle retry,
  // but if it fails we should ideally log out. The useGetMe query handles that.

  const isLoading = token ? isUserLoading : false;

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      login: loginMutation,
      logout,
      token
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
