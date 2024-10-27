import {
  AlertDialog,
  Box,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  IconButton,
  Select,
  Spinner,
  Tooltip,
} from "@radix-ui/themes";
import { trpc } from "@/lib/trpc";
import { Earth, FileText, Star, ThumbsUp, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";
import { atom, useAtom } from "jotai";
import { ATOM_selectedRepos, ATOM_selectMode, RepoType } from "./dashboard";

export const StarButton = ({
  repo,
}: {
  repo: {
    id: string;
    numLikes: number;
  };
}) => {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const star = trpc.repo.star.useMutation({
    onSuccess(input) {
      utils.repo.getDashboardRepos.invalidate();
      utils.repo.repo.invalidate({ id: repo.id });
      utils.user.me.invalidate();
    },
    onError(error) {
      toast.error(error.message);
    },
  });
  const unstar = trpc.repo.unstar.useMutation({
    onSuccess(input) {
      utils.repo.getDashboardRepos.invalidate();
      utils.repo.repo.invalidate({ id: repo.id });
      utils.user.me.invalidate();
    },
    onError(error) {
      toast.error(error.message);
    },
  });
  const isStarred = me?.data?.stars.map(({ id }) => id).includes(repo.id);
  return (
    <>
      {isStarred ? (
        <Tooltip content="unstar">
          <IconButton
            size="1"
            variant="ghost"
            onClick={() => {
              unstar.mutate({ repoId: repo.id });
            }}
            disabled={unstar.isLoading}
          >
            <Star color="var(--amber-6)" fill="var(--amber-6)" />
            <Box
              style={{
                // Make the different numbers fixed width.
                fontVariant: "tabular-nums",
                paddingLeft: "5px",
              }}
            >
              {repo.numLikes}
            </Box>
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip content="star">
          <IconButton
            size="1"
            variant="ghost"
            onClick={() => {
              star.mutate({ repoId: repo.id });
            }}
            disabled={star.isLoading}
          >
            <Star />
            <Box
              style={{
                fontVariant: "tabular-nums",
                paddingLeft: "5px",
              }}
            >
              {repo.numLikes}
            </Box>
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};

export const DeleteRepoButton = ({ repo }) => {
  const utils = trpc.useUtils();
  const deleteRepo = trpc.repo.deleteRepo.useMutation({
    onSuccess(input) {
      toast.success("Successfully deleted repo");
      utils.repo.getDashboardRepos.invalidate();
    },
    onError(err) {
      toast.error(`Failed to delete repo: ${err.message}`);
    },
  });
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <IconButton color="red" variant="ghost" disabled={deleteRepo.isLoading}>
          {deleteRepo.isLoading ? <Spinner /> : <Trash2 />}
        </IconButton>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px">
        <AlertDialog.Title>Delete Repository</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Are you sure? This project will no be deleted.
        </AlertDialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button
              variant="solid"
              color="red"
              onClick={() => {
                deleteRepo.mutate({
                  id: repo.id,
                });
              }}
            >
              Delete Project
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};

export const DeleteSelectedButton = () => {
  const utils = trpc.useUtils();
  const [selectMode, setSelectMode] = useAtom(ATOM_selectMode);
  const [selectedRepos, setSelectedRepos] = useAtom(ATOM_selectedRepos);
  const deleteRepos = trpc.repo.deleteRepos.useMutation({
    onSuccess(input) {
      toast.success("Successfully deleted repo");
      utils.repo.getDashboardRepos.invalidate();
      setSelectedRepos([]);
      setSelectMode(false);
    },
    onError(err) {
      toast.error(`Failed to delete repo: ${err.message}`);
    },
  });
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button
          color="red"
          variant="ghost"
          disabled={deleteRepos.isLoading || selectedRepos.length === 0}
        >
          Delete Selected
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px">
        <AlertDialog.Title>Delete Selected Repository</AlertDialog.Title>
        <AlertDialog.Description size="2">
          The following repos will be deleted. Are you sure?
        </AlertDialog.Description>

        {selectedRepos
          .sort((a, b) => {
            if (a.createdAt && b.createdAt) {
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            } else if (a.createdAt) {
              return -1;
            } else if (b.createdAt) {
              return 1;
            } else {
              return 0;
            }
          })
          .map((repo) => (
            <div
              key={repo.id}
              style={{
                paddingLeft: "10px",
                // weight bold
                fontWeight: "bold",
              }}
            >
              {repo.name || "Untitled"}
            </div>
          ))}

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button
              variant="solid"
              color="red"
              onClick={() => {
                deleteRepos.mutate({ ids: selectedRepos.map(({ id }) => id) });
              }}
            >
              Delete Selected Repositories
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};
