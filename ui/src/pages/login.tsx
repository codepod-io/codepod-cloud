import React, { useEffect, useState, useRef } from "react";

import { Link as ReactLink, useNavigate } from "react-router-dom";

import { trpc } from "@/lib/trpc";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  TextField,
} from "@radix-ui/themes";

import { signIn, useSession } from "next-auth/react";

function NextAuthSignIn() {
  const { data: session } = useSession();
  // if we have a session, redirect to the home page
  const navigate = useNavigate();
  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  return <Button onClick={() => signIn("google")}>login</Button>;
}

export function SignIn() {
  return (
    <Container flexGrow={"1"} size="1">
      <Flex direction="column" gap="6">
        <Flex style={{ backgroundColor: "red" }} flexGrow="1"></Flex>
        <Heading
          as="h1"
          size="8"
          style={{
            // center the heading
            textAlign: "center",
          }}
        >
          Log In to Your Account
        </Heading>

        {/* Option 1: OAuth */}
        <NextAuthSignIn />
      </Flex>
    </Container>
  );
}
