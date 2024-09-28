import React, { useEffect, useState, useRef } from "react";

import { Link as ReactLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  TextField,
} from "@radix-ui/themes";
import { toast } from "react-toastify";

import { zodValidator } from "@tanstack/zod-form-adapter";

import { FieldApi, useForm } from "@tanstack/react-form";
import { z } from "zod";
import { env } from "@/lib/vars";

// useLoadGsiScript from
// https://github.com/MomenSherif/react-oauth/blob/244d2b970d910af18a1bfdf2a74625834e087b40/packages/%40react-oauth/google/src/GoogleOAuthProvider.tsx
interface UseLoadGsiScriptOptions {
  /**
   * Nonce applied to GSI script tag. Propagates to GSI's inline style tag
   */
  nonce?: string;
  /**
   * Callback fires on load [gsi](https://accounts.google.com/gsi/client) script success
   */
  onScriptLoadSuccess?: () => void;
  /**
   * Callback fires on load [gsi](https://accounts.google.com/gsi/client) script failure
   */
  onScriptLoadError?: () => void;
}

function useLoadGsiScript(options: UseLoadGsiScriptOptions = {}): boolean {
  const { nonce, onScriptLoadSuccess, onScriptLoadError } = options;

  const [scriptLoadedSuccessfully, setScriptLoadedSuccessfully] =
    useState(false);

  const onScriptLoadSuccessRef = useRef(onScriptLoadSuccess);
  onScriptLoadSuccessRef.current = onScriptLoadSuccess;

  const onScriptLoadErrorRef = useRef(onScriptLoadError);
  onScriptLoadErrorRef.current = onScriptLoadError;

  useEffect(() => {
    const scriptTag = document.createElement("script");
    scriptTag.src = "https://accounts.google.com/gsi/client";
    scriptTag.async = true;
    scriptTag.defer = true;
    scriptTag.nonce = nonce;
    scriptTag.onload = () => {
      setScriptLoadedSuccessfully(true);
      onScriptLoadSuccessRef.current?.();
    };
    scriptTag.onerror = () => {
      setScriptLoadedSuccessfully(false);
      onScriptLoadErrorRef.current?.();
    };

    document.body.appendChild(scriptTag);

    return () => {
      document.body.removeChild(scriptTag);
    };
  }, [nonce]);

  return scriptLoadedSuccessfully;
}

declare var google: any;

export function GoogleSignin() {
  const { isSignedIn, signIn } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn()) {
      navigate("/");
    }
  }, []);

  const loginWithGoogle = trpc.user.loginWithGoogle.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        signIn(data.token);
        navigate("/");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const scriptLoadedSuccessfully = useLoadGsiScript();

  useEffect(() => {
    if (!scriptLoadedSuccessfully) return;
    // console.log("nodeenv mode", import.meta.env.MODE);
    let client_id = env.GOOGLE_CLIENT_ID || null;
    google.accounts.id.initialize({
      client_id,
      callback: (response) => {
        loginWithGoogle.mutate({ idToken: response.credential });
      },
    });
    google.accounts.id.renderButton(
      document.getElementById("googleLoginDiv"),
      { theme: "outline", size: "large" } // customization attributes
    );
  }, [scriptLoadedSuccessfully]);
  return (
    <Box
      id="googleLoginDiv"
      // Needed to center the rendered google signin button.
      style={{ alignSelf: "center" }}
    ></Box>
  );
}

export function SignIn() {
  return (
    <Container
      flexGrow={"1"}
      size="1"
      style={{
        paddingTop: "20vh",
      }}
    >
      <Flex direction="column" gap="6">
        <Heading
          as="h1"
          size="8"
          style={{
            // center the heading
            textAlign: "center",
          }}
        >
          Log In to Your Account
        </Heading>

        {/* Option 1: OAuth */}
        <GoogleSignin />
      </Flex>
    </Container>
  );
}
