import { Box, Container } from "@radix-ui/themes";

export function Home() {
  return (
    <Box
      style={{
        maxWidth: "lg",
        margin: "auto",
      }}
    >
      <Container>
        <Box style={{ textAlign: "center", fontSize: 50 }}>
          Coding on a canvas, organized.
        </Box>
      </Container>
    </Box>
  );
}
