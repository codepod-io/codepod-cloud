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

import { Header, UserProfile } from "@/components/Header";

import { TrpcProvider } from "@/lib/auth";

import { Link as ReactLink } from "react-router-dom";

import {
  Container,
  Flex,
  Link as RadixLink,
  Box,
  Text,
  Callout,
} from "@radix-ui/themes";

import "./custom.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { trpc } from "./lib/trpc";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";

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

function Index() {
  // redirect to dashboard
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/dashboard");
  }, []);
  return null;
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
      <Flex direction="column" height="100vh">
        <Flex>
          <HeaderWithItems />
        </Flex>
        <Flex overflow="auto" flexGrow={"1"}>
          <Profile />
        </Flex>
      </Flex>
    ),
  },
  {
    path: "test",
    element: <Test />,
  },
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/dashboard",
    element: (
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
    ),
  },
]);

export function App() {
  return (
    <SessionProvider>
      <TrpcProvider>
        <RouterProvider router={router} />
        <ToastContainer pauseOnFocusLoss={false} />
      </TrpcProvider>
    </SessionProvider>
  );
}
