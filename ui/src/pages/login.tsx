import React, { useEffect, useState, useRef } from "react";

import Avatar from "@mui/material/Avatar";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

import { useFormik } from "formik";

import { Link as ReactLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import Divider from "@mui/material/Divider";
import { trpc } from "@/lib/trpc";

const theme = createTheme();

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
    let client_id = import.meta.env.DEV
      ? import.meta.env.VITE_APP_GOOGLE_CLIENT_ID
      : window.GOOGLE_CLIENT_ID || null;
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
  return <Box id="googleLoginDiv"></Box>;
}

export function SignIn() {
  /* eslint-disable no-unused-vars */
  const { isSignedIn, signIn } = useAuth();
  const signin = trpc.user.login.useMutation();
  const [error, setError] = useState<null | string>(null);

  let navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn()) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);

  useEffect(() => {
    if (signin.error) {
      setError(signin.error.message);
    }
    if (signin.data?.token) {
      signIn(signin.data.token);
    }
  }, [signin]);

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    // validationSchema: validationSchema,
    onSubmit: (values) => {
      setError(null);
      return signin.mutate({
        email: values.email,
        password: values.password,
      });
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Sign in
          </Typography>
          <GoogleSignin />
          <Divider />
          <Box>Or login with email</Box>
          <Divider />
          <Box
            component="form"
            onSubmit={formik.handleSubmit}
            noValidate
            sx={{ mt: 1 }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formik.values.email}
              onChange={formik.handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formik.values.password}
              onChange={formik.handleChange}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign In
            </Button>
            <Grid container>
              <Grid item xs>
                <Link href="#" variant="body2">
                  Forgot password?
                </Link>
              </Grid>
              <Grid item>
                <Link component={ReactLink} to="/signup">
                  {"Don't have an account? Sign Up"}
                </Link>
                {/* <Link href="/signup" variant="body2">
                  {"Don't have an account? Sign Up"}
                </Link> */}
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}
