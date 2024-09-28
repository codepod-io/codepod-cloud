import { NoLogginErrorAlert } from "@/components/Utils";
import { trpc } from "@/lib/trpc";
import { env } from "@/lib/vars";
import { Box, Card, Container, Flex, Heading } from "@radix-ui/themes";
import { useSession } from "next-auth/react";

export function Profile() {
  const { data: session } = useSession();

  if (!session) {
    // router.push("/login");
    // return null;
    return (
      <Flex
        direction="column"
        style={{
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <NoLogginErrorAlert />
      </Flex>
    );
  }

  return (
    <Container
      size="1"
      style={{
        paddingTop: "20px",
      }}
    >
      <Flex direction="column" gap="3">
        <Card>
          <Flex direction="column">
            <Heading as="h4">User profile</Heading>
            <Box>Name {session.user?.name}</Box>
            <Box> Email: {session.user?.email}</Box>
            <Heading as="h4">App Version</Heading>
            <Box>{env.APP_VERSION}</Box>
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}
