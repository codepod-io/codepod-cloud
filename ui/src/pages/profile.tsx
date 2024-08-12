import { trpc } from "@/lib/trpc";
import { Box, Card, Container, Flex, Heading } from "@radix-ui/themes";

export function Profile() {
  const me = trpc.user.me.useQuery();

  if (!me) {
    // router.push("/login");
    // return null;
    return (
      <>
        <>Profile Page</>
        <>Please Log In</>
      </>
    );
  }

  if (me.isLoading) return <>Loading</>;

  return (
    <Container
      size="1"
      style={{
        paddingTop: "20px",
      }}
    >
      {!me.data ? (
        "Loading"
      ) : (
        <Flex direction="column" gap="3">
          <Card>
            <Flex direction="column">
              <Heading as="h4">User profile</Heading>
              <Box>
                Name {me.data.firstname} {me.data.lastname}
              </Box>
              <Box> Email: {me.data.email}</Box>
            </Flex>
          </Card>
        </Flex>
      )}
    </Container>
  );
}
