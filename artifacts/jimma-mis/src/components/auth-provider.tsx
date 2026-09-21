import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react/custom-fetch";
import { AuthContext, TOKEN_KEY } from "@/hooks/auth-context";

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        queryClient.setQueryData(getGetMeQueryKey(), data.user);
      },
    },
  });

  const logout = useCallback(() => {
    // Fire-and-forget: record the logout server-side before clearing the token
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      fetch(`${import.meta.env.BASE_URL}api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => {});
    }
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

  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
  const isLoading = Boolean(activeToken && !user && isUserLoading);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        login: loginMutation,
        logout,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
