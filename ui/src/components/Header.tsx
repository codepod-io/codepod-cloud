import { Link as ReactLink, useLocation } from "react-router-dom";

import { useNavigate } from "react-router-dom";

import { Avatar, Box, DropdownMenu, Flex, Text } from "@radix-ui/themes";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";

import { env } from "@/lib/vars";

function Banner() {
  return (
    <Flex
      style={{
        backgroundColor: "var(--yellow-9)",
        padding: "10px",
        // make the items center
        justifyContent: "center",
      }}
    >
      <Text>{env.BANNER}</Text>
    </Flex>
  );
}

export function Header({ children }) {
  // console.log("env", env);
  return (
    <Flex
      direction="column"
      style={{
        width: "100%",
      }}
    >
      {env.BANNER && <Banner />}
      <Flex
        gap="3"
        style={{
          width: "100%",
          border: "2px solid lightgray",
          backgroundColor: "white",
          height: "50px",
          // horizontal align items
          justifyContent: "center",
          paddingLeft: "10%",
          paddingRight: "10%",
          alignItems: "center",
        }}
      >
        {/* The header items */}

        {children}
      </Flex>
    </Flex>
  );
}

export const UserProfile = () => {
  const { isSignedIn, signOut } = useAuth();
  if (!isSignedIn()) {
    return (
      <Box display="block">
        <ReactLink to="/login">Login</ReactLink>
      </Box>
    );
  }
  const me = trpc.user.me.useQuery();
  let navigate = useNavigate();
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Box>
            <Avatar
              // src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=256&h=256&q=70&crop=focalpoint&fp-x=0.5&fp-y=0.3&fp-z=1&fit=crop"
              // fallback="A"
              fallback={
                me.data
                  ? `${me.data?.firstname[0]}${me.data?.lastname[0]}`
                  : "??"
              }
              radius="full"
            />
          </Box>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content variant="soft">
          <DropdownMenu.Item asChild>
            <ReactLink to="/profile">Profile</ReactLink>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => {
              signOut();
              navigate("/login");
            }}
            style={{
              color: "red",
            }}
          >
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
};
