import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import Paper from "@mui/material/Paper";
import { Container, Stack } from "@mui/material";
import { trpc } from "@/lib/trpc";

export function Profile() {
  const me = trpc.user.me.useQuery();

  if (!me) {
    // router.push("/login");
    // return null;
    return (
      <Box>
        <Box>Profile Page</Box>
        <Box>Please Log In</Box>
      </Box>
    );
  }

  if (me.isLoading) return <Box>Loading</Box>;

  return (
    <Container maxWidth="lg" sx={{ mt: 2 }}>
      {!me.data ? (
        "Loading"
      ) : (
        <Box>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Stack>
              <Typography variant="h4">User profile</Typography>
              <Box>
                Name {me.data.firstname} {me.data.lastname}
              </Box>
              <Box> Email: {me.data.email}</Box>
            </Stack>
          </Paper>
          <Divider />
        </Box>
      )}
    </Container>
  );
}
