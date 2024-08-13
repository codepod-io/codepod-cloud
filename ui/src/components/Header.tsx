import { Link as ReactLink, useLocation } from "react-router-dom";

import { useNavigate } from "react-router-dom";

import { Avatar, Box, DropdownMenu } from "@radix-ui/themes";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";

export const UserProfile = () => {
  const { isSignedIn, signOut } = useAuth();
  const me = trpc.user.me.useQuery();
  let navigate = useNavigate();
  return (
    <>
      {isSignedIn() ? (
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
          <DropdownMenu.Content>
            <DropdownMenu.Item asChild>
              <ReactLink to="/profile">Profile</ReactLink>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onClick={() => {
                signOut();
                navigate("/login");
              }}
            >
              Logout
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ) : (
        <Box display="block">
          <ReactLink to="/login">Login</ReactLink>
        </Box>
      )}
    </>
  );
};
