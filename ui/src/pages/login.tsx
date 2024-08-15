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
  const login = trpc.user.loginWithGoogle.useMutation();
  const { signIn } = useAuth();
  const scriptLoadedSuccessfully = useLoadGsiScript();

  useEffect(() => {
    if (login.data && login.data.token) {
      signIn(login.data.token);
      localStorage.setItem("token", login.data.token);
    }
  }, [login]);

  useEffect(() => {
    if (!scriptLoadedSuccessfully) return;
    console.log("nodeenv mode", import.meta.env.MODE);
    let client_id = env.GOOGLE_CLIENT_ID || null;
    google.accounts.id.initialize({
      client_id,
      callback: (response) => {
        login.mutate({ idToken: response.credential });
        console.log("LoginMutation result:", login.data);
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

function FieldInfo({ field }: { field: FieldApi<any, any, any, any> }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length ? (
        <em style={{ color: "red" }}>{field.state.meta.errors.join(",")}</em>
      ) : null}
      {field.state.meta.isValidating ? (
        <div style={{ color: "blue" }}>"Validating..."</div>
      ) : null}
    </>
  );
}

function TanstackForm() {
  const { isSignedIn, signIn } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn()) {
      navigate("/");
    }
  });
  const login = trpc.user.login.useMutation({
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
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      login.mutate(value);
    },
    validatorAdapter: zodValidator(),
  });
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      style={{
        width: "100%",
      }}
    >
      <Flex direction="column" gap="3">
        <div>
          <form.Field
            name="email"
            validators={{
              onChange: z.string().email(),
            }}
            children={(field) => (
              <>
                {/* <label htmlFor={field.name}>Email:</label> */}
                <TextField.Root
                  placeholder="Email"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                ></TextField.Root>
                <FieldInfo field={field} />
              </>
            )}
          />
        </div>
        <div>
          <form.Field
            name="password"
            validators={{
              onChange: z.string().min(1, "Password Cannot be empty"),
            }}
            children={(field) => (
              <>
                {/* <label htmlFor={field.name}>Password:</label> */}
                <TextField.Root
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  <TextField.Slot></TextField.Slot>
                  <TextField.Slot>
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPassword(!showPassword);
                      }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </Button>
                  </TextField.Slot>
                </TextField.Root>
                <FieldInfo field={field} />
              </>
            )}
          />
        </div>
        {/* <Button type="submit">Submit</Button> */}
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "..." : "Log In"}
            </Button>
          )}
        />
      </Flex>
    </form>
  );
}

export function SignIn() {
  return (
    <Container flexGrow={"1"} size="1">
      <Flex direction="column" gap="6">
        <Flex style={{ backgroundColor: "red" }} flexGrow="1"></Flex>
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

        {/* A seperator. */}
        <h2
          style={{
            textAlign: "center",
            borderBottom: "1px solid lightgray",
            lineHeight: "0.1em",
            margin: "10px 0",
          }}
        >
          <span style={{ background: "white", padding: "0 10px" }}>
            Or continue with password
          </span>
        </h2>

        {/* Option 2: Email and Password. */}
        <TanstackForm />
        <Flex>
          <Flex>
            <Link href="#">Forgot password?</Link>
          </Flex>
          <Flex flexGrow={"1"} />
          <Flex gap="2">
            Don't have an account?
            <Link asChild>
              <ReactLink to="/signup">{" Sign Up"}</ReactLink>
            </Link>
          </Flex>
        </Flex>
      </Flex>
    </Container>
  );
}
