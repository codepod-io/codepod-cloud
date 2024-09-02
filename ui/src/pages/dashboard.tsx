import { Box } from "@radix-ui/themes";
import { useAuth } from "@/lib/auth";
import { atom, useAtom } from "jotai";
import { RepoLists } from "./dashboard_repo";

export type RepoType = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  public: boolean;
  numLikes: number;
  yDocBlobSize: number;
  name: string | null;
  accessedAt: string;
};

export const ATOM_selectMode = atom(false);
export const ATOM_selectedRepos = atom<RepoType[]>([]);

export function Dashboard() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn()) {
    return (
      <Box style={{ maxWidth: "md", alignItems: "center", margin: "auto" }}>
        Not signed in.
      </Box>
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
