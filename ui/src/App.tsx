import { z } from "zod";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useNavigate,
} from "react-router-dom";

import { Dashboard } from "@/pages/dashboard";
import { Repo } from "@/pages/repo";
import { Test } from "@/pages/test";

import { Profile } from "@/pages/profile";
import { SignIn } from "@/pages/login";
import { SignUp } from "@/pages/signup";

import { UserProfile } from "@/components/Header";

import { AuthProvider, useAuth } from "@/lib/auth";

import { Link as ReactLink } from "react-router-dom";

import {
  Container,
  Flex,
  Link as RadixLink,
  Box,
  Text,
  Callout,
} from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";

import "./App.css";
import "./custom.css";
import { ToastContainer } from "react-toastify";

function NoLogginErrorAlert() {
  return (
    <Box style={{ maxWidth: "sm", alignItems: "center", margin: "auto" }}>
      <Callout.Root color="red">
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text>
          Please <ReactLink to="/login">login</ReactLink> to view your
          dashboard.
        </Callout.Text>
      </Callout.Root>
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
            <Text>CodePod</Text>
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
    <AuthProvider>
      <RouterProvider router={router} />
      <ToastContainer pauseOnFocusLoss={false} />
    </AuthProvider>
  );
}
