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
    <Box>
      {/* maxWidth container */}
      <Container
        size="4"
        style={{
          border: "2px solid lightgray",
          backgroundColor: "white",
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
    </Box>
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
      <Box>
        <Box position="fixed" width="100%">
          <Header />
        </Box>
        <Box pt="50px">
          <SignIn />
        </Box>
      </Box>
    ),
  },
  {
    path: "signup",
    element: (
      <Box>
        <Box position="fixed" width="100%">
          <Header />
        </Box>
        <Box pt="50px">
          <SignUp />
        </Box>
      </Box>
    ),
  },
  {
    path: "profile",
    element: (
      <RequireSignIn>
        <Box>
          <Box position="fixed" width="100%">
            <Header />
          </Box>
          <Box pt="50px">
            <Profile />
          </Box>
        </Box>
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
        <Box>
          <Box position="fixed" width="100%">
            <Header />
          </Box>
          {/* The main content */}
          <Container size="3">
            <Box pt="50px">
              <Dashboard />
            </Box>
          </Container>
        </Box>
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
