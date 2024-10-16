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
import Test from "@/pages/test";

import { Profile } from "@/pages/profile";
import { SignIn } from "@/pages/login";

import { Header, UserProfile } from "@/components/Header";

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

import "./custom.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { trpc } from "./lib/trpc";

function NoLogginErrorAlert() {
  return (
    <Callout.Root color="red">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>
      <Callout.Text>
        Please <ReactLink to="/login">login</ReactLink> to view this page.
      </Callout.Text>
    </Callout.Root>
  );
}

const RequireSignIn = ({ children }) => {
  const { isSignedIn } = useAuth();
  if (!isSignedIn()) {
    return (
      // put in the center of the screen
      <Flex
        direction="column"
        style={{
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <NoLogginErrorAlert />
      </Flex>
    );
  }
  return children;
};

function HeaderWithItems() {
  return (
    <Header>
      <RadixLink asChild>
        <ReactLink to="/">
          <Text>CodePod</Text>
        </ReactLink>
      </RadixLink>
      <Box flexGrow="1" />
      <UserProfile />
    </Header>
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
          <HeaderWithItems />
        </Flex>
        <Flex overflow="auto" flexGrow={"1"}>
          <SignIn />
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
            <HeaderWithItems />
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
            <HeaderWithItems />
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

function AuthValidationImpl() {
  const { signOut } = useAuth();
  trpc.user.me.useQuery(undefined, {
    retry: false,
    onError(error) {
      // if the JWT token is invalid, sign out
      // This will happen when:
      // 1. we changed the JWT secret
      // 2. TODO the JWT token is expired
      if (
        error.message === "invalid signature" ||
        error.message === "Authorization token is not valid"
      ) {
        console.log("invalid token");
        // sign out
        signOut();
      } else {
        console.error("AuthValidationImpl unknown error", error);
        // FIXME We're signing user out on TRPC error. This is likely due to invalid user token.
        signOut();
      }
    },
  });
  return null;
}

function AuthValidation() {
  const { authToken } = useAuth();

  if (!authToken) return null;
  return <AuthValidationImpl />;
}

export function App() {
  return (
    <AuthProvider>
      <AuthValidation />
      <RouterProvider router={router} />
      <ToastContainer pauseOnFocusLoss={false} />
    </AuthProvider>
  );
}
