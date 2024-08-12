import { Link as ReactLink, useLocation } from "react-router-dom";

import { useNavigate } from "react-router-dom";

import { Box, Button, Flex } from "@radix-ui/themes";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";

const ProfileButton = () => {
  const me = trpc.user.me.useQuery();
  return (
    <Box style={{ marginRight: 2 }}>
      <ReactLink to="/profile">{me.data?.firstname}</ReactLink>
    </Box>
  );
};

export const UserProfile = () => {
  const { isSignedIn, signOut } = useAuth();
  let navigate = useNavigate();
  return (
    <>
      {isSignedIn() ? (
        <Flex
          style={{
            alignItems: "center",
          }}
          gap="4"
        >
          <ProfileButton />
          <Button
            onClick={() => {
              signOut();
              navigate("/login");
            }}
            variant="ghost"
          >
            Logout
          </Button>
        </Flex>
      ) : (
        <Box display="block">
          <ReactLink to="/login">Login</ReactLink>
        </Box>
      )}
    </>
  );
};
