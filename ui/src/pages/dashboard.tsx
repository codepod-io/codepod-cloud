import { Box, Flex } from "@radix-ui/themes";
import { atom, useAtom } from "jotai";
import { RepoLists } from "./dashboard_repo";
import { useSession } from "next-auth/react";
import { NoLogginErrorAlert } from "@/components/Utils";

export type RepoType = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  public: boolean;
  numLikes: number;
  yDocBlob: {
    size: number;
  } | null;
  name: string | null;
  accessedAt: string;
};

export const ATOM_selectMode = atom(false);
export const ATOM_selectedRepos = atom<RepoType[]>([]);

export function Dashboard() {
  const { data: session } = useSession();

  if (!session) {
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
    <Box style={{ maxWidth: "md", alignItems: "center", margin: "auto" }}>
      <Box
        style={{
          fontSize: "14px",
          paddingTop: "10px",
          color: "#6B87A2",
        }}
      >
        Welcome! Please open or create a repository to get started.
      </Box>
      <RepoLists />
    </Box>
  );
}
