import { z } from "zod";

import "./App.css";
import "./custom.css";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useNavigate,
} from "react-router-dom";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { Dashboard } from "./pages/dashboard";
import { Repo } from "./pages/repo";
import { Test } from "./pages/test";

import { Profile } from "./pages/profile";
import { SignIn } from "./pages/login";
import { SignUp } from "./pages/signup";

import { Header, Footer } from "./components/Header";

import { AuthProvider, useAuth } from "./lib/auth";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

import Box from "@mui/material/Box";
import { SnackbarProvider } from "notistack";
import { Alert, Button, Typography } from "@mui/material";

import { trpc } from "./lib/trpc";

const yjsWsUrl = z.string().parse(import.meta.env.VITE_APP_YJS_WS_URL);
const apiUrl = z.string().parse(import.meta.env.VITE_APP_API_URL);
const runtimeApiUrl = z
  .string()
  .parse(import.meta.env.VITE_APP_RUNTIME_API_URL);
const copilotApiUrl = z
  .string()
  .parse(import.meta.env.VITE_APP_COPILOT_API_URL);

const theme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
});

const ProfileButton = () => {
  const me = trpc.user.me.useQuery();
  return (
    <Box sx={{ mr: 2 }}>
      <Link component={ReactLink} to="/profile" underline="none">
        {me.data?.firstname}
      </Link>
    </Box>
  );
};

const NormalLayout = ({ children }) => {
  const { isSignedIn, signOut } = useAuth();
  let navigate = useNavigate();

  return (
    <Box>
      <Header>
        <Box
          sx={{
            alignItems: "baseline",
            display: "flex",
            flexGrow: 1,
          }}
        >
          <Link component={ReactLink} underline="hover" to="/">
            <Typography noWrap>CodePod</Typography>
          </Link>
        </Box>

        {isSignedIn() ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <ProfileButton />
            <Button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
            >
              Logout
            </Button>
          </Box>
        ) : (
          <Box display="block">
            <Link to="/login" component={ReactLink} underline="none">
              Login
            </Link>
          </Box>
        )}
      </Header>
      <Box pt="50px">{children}</Box>
      {/* <Footer /> */}
    </Box>
  );
};

function NoLogginErrorAlert() {
  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      <Alert severity="error">
        Please{" "}
        <Link component={ReactLink} to="/login">
          login
        </Link>{" "}
        to view your dashboard.
      </Alert>
    </Box>
  );
}

const RequireSignIn = ({ children }) => {
  const { isSignedIn } = useAuth();
  if (!isSignedIn()) {
    return <NoLogginErrorAlert />;
  }
  return children;
};

const router = createBrowserRouter([
  {
    path: "repo/:id",
    element: (
      // Not wrapperd with NormalLayout (header + padding) because:
      // 1. Need to use vh to make the Canvas exact full screen
      // 2. Need to populate more buttons to header.
      <Box height="100vh" width="100%" boxSizing={"border-box"}>
        <Repo yjsWsUrl={yjsWsUrl} />
      </Box>
    ),
  },
  {
    path: "login",
    element: (
      <NormalLayout>
        <SignIn />
      </NormalLayout>
    ),
  },
  {
    path: "signup",
    element: (
      <NormalLayout>
        <SignUp />
      </NormalLayout>
    ),
  },
  {
    path: "profile",
    element: (
      <NormalLayout>
        <Profile />
      </NormalLayout>
    ),
  },
  {
    path: "test",
    element: (
      <NormalLayout>
        <Test />
      </NormalLayout>
    ),
  },
  {
    path: "/",
    element: (
      <NormalLayout>
        <RequireSignIn>
          <Dashboard />
        </RequireSignIn>
      </NormalLayout>
    ),
  },
]);

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider
        apiUrl={apiUrl}
        runtimeApiUrl={runtimeApiUrl}
        copilotApiUrl={copilotApiUrl}
      >
        <SnackbarProvider maxSnack={5}>
          <RouterProvider router={router} />
        </SnackbarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
