import React, { useState, useContext, useEffect, createContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

import { trpc } from "./trpc";

type AuthContextType = ReturnType<typeof useProvideAuth>;

const authContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, apiUrl, spawnerApiUrl }) {
  const auth = useProvideAuth({ apiUrl, spawnerApiUrl });

  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "http://localhost:4000/trpc",
        headers: auth.getAuthHeaders(),
        // fetch(url, options) {
        //   return fetch(url, {
        //     ...options,
        //     credentials: "include",
        //   });
        // },
      }),
    ],
  });

  return (
    <authContext.Provider value={auth}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </authContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(authContext)!;
};

function useProvideAuth({ apiUrl, spawnerApiUrl }) {
  const [authToken, setAuthToken] = useState<String | null>(null);

  useEffect(() => {
    // load initial state from local storage
    setAuthToken(localStorage.getItem("token") || null);
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    if (!authToken) return {};

    return {
      authorization: `Bearer ${authToken}`,
    };
  };

  const signOut = () => {
    console.log("sign out");
    // HEBI CAUTION this must be removed. Otherwise, when getItem back, it is not null, but "null"
    // localStorage.setItem("token", null);
    localStorage.removeItem("token");
    setAuthToken(null);
  };

  const signIn = (token: string) => {
    setAuthToken(token);
    localStorage.setItem("token", token);
  };

  /**
   * This is not immediately set onrefresh.
   */
  const isSignedIn = () => {
    if (authToken && localStorage.getItem("token") !== null) {
      return true;
    } else {
      return false;
    }
  };

  /**
   * This is set immediately on refresh.
   */
  function hasToken() {
    return localStorage.getItem("token") !== null;
  }

  return {
    getAuthHeaders,
    signIn,
    signOut,
    isSignedIn,
    hasToken,
  };
}
