import { z } from "zod";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useNavigate,
} from "react-router-dom";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { Dashboard } from "@/pages/dashboard";
import { Repo } from "@/pages/repo";
import { Test } from "@/pages/test";

import { Profile } from "@/pages/profile";
import { SignIn } from "@/pages/login";
import { SignUp } from "@/pages/signup";

import { Footer, UserProfile } from "@/components/Header";

import { AuthProvider, useAuth } from "@/lib/auth";

import { Link as ReactLink } from "react-router-dom";

import { SnackbarProvider } from "notistack";
import { Alert, Button, Typography } from "@mui/material";
import { Container, Flex, Link as RadixLink, Box } from "@radix-ui/themes";

import "./App.css";
import "./custom.css";

const theme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
});

function NoLogginErrorAlert() {
  return (
    <Box style={{ maxWidth: "sm", alignItems: "center", margin: "auto" }}>
      <Alert severity="error">
        Please <ReactLink to="/login">login</ReactLink> to view your dashboard.
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

function Header() {
  return (
    <Container
      size="4"
      style={{
        border: "2px solid lightgray",
        backgroundColor: "white",
        height: "50px",
        // horizontal align items
        justifyContent: "center",
      }}
    >
      {/* The header items */}
      <Flex align="center" my="2">
        <RadixLink asChild>
          <ReactLink to="/">
            <Typography noWrap>CodePod</Typography>
          </ReactLink>
        </RadixLink>
        <Box flexGrow="1" />
        <UserProfile />
      </Flex>
    </Container>
  );
}

const router = createBrowserRouter([
  {
    path: "repo/:id",
    element: <Repo />,
  },
  {
    path: "login",
    element: (
      <Flex direction="column" height="100vh">
        <Flex>
          <Header />
        </Flex>
        <Flex overflow="auto" flexGrow={"1"}>
          <SignIn />
        </Flex>
      </Flex>
    ),
  },
  {
    path: "signup",
    element: (
      <Flex direction="column" height="100vh">
        <Flex>
          <Header />
        </Flex>
        <Flex overflow="auto" flexGrow={"1"}>
          <SignUp />
        </Flex>
      </Flex>
    ),
  },
  {
    path: "profile",
    element: (
      <RequireSignIn>
        <Flex direction="column" height="100vh">
          <Flex>
            <Header />
          </Flex>
          <Flex overflow="auto" flexGrow={"1"}>
            <Profile />
          </Flex>
        </Flex>
      </RequireSignIn>
    ),
  },
  {
    path: "test",
    element: <Test />,
  },
  {
    path: "/",
    element: (
      <RequireSignIn>
        <Flex direction="column" height="100vh">
          <Flex>
            <Header />
          </Flex>

          <Flex
            overflow="auto"
            flexGrow={"1"}
            style={{
              backgroundColor: "var(--gray-2)",
            }}
          >
            <Container size="3">
              <Dashboard />
            </Container>
          </Flex>
        </Flex>
      </RequireSignIn>
    ),
  },
]);

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <SnackbarProvider maxSnack={5}>
          <RouterProvider router={router} />
        </SnackbarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
