import React, { useState, useEffect, useCallback } from "react";

import { Link as ReactLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import {
  AlertDialog,
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Spinner,
  Tooltip,
} from "@radix-ui/themes";
import { timeDifference } from "@/lib/utils/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";
import { FileText, LockOpen, ThumbsUp, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";

function CreateRepoForm(props) {
  const createRepo = trpc.repo.createRepo.useMutation();
  const navigate = useNavigate();
  useEffect(() => {
    if (createRepo.data) {
      navigate(`/repo/${createRepo.data.id}`);
    }
  }, [createRepo]);
  return (
    <Box>
      <Button
        variant="ghost"
        onClick={() => {
          createRepo.mutate();
        }}
      >
        Create New Project
      </Button>
    </Box>
  );
}

const StarButton = ({ repo }) => {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const star = trpc.repo.star.useMutation({
    onSuccess(input) {
      utils.repo.getDashboardRepos.invalidate();
    },
  });
  const unstar = trpc.repo.unstar.useMutation({
    onSuccess(input) {
      utils.repo.getDashboardRepos.invalidate();
    },
  });
  const isStarred = repo.stargazers?.map(({ id }) => id).includes(me.data?.id);
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
            <ThumbsUp color="red" size={16} fill="pink" />
            <Box
              style={{
                // Make the different numbers fixed width.
                fontVariant: "tabular-nums",
                paddingLeft: "5px",
              }}
            >
              {repo.stargazers.length}
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
            <ThumbsUp size={16} />
            <Box
              style={{
                fontVariant: "tabular-nums",
                paddingLeft: "5px",
              }}
            >
              {repo.stargazers.length}
            </Box>
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};

const DeleteRepoButton = ({ repo }) => {
  const utils = trpc.useUtils();
  const deleteRepo = trpc.repo.deleteRepo.useMutation({
    onSuccess(input) {
      toast.success("Successfully deleted repo");
      utils.repo.getDashboardRepos.invalidate();
    },
    onError() {
      toast.error("Failed to delete repo");
    },
  });
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <IconButton
          size="1"
          color="red"
          variant="ghost"
          disabled={deleteRepo.isLoading}
        >
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

function prettyPrintBytes(bytes: number) {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

const RepoCard = ({
  repo,
}: {
  repo: {
    id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    public: boolean;
    stargazers: {
      id: string;
      updatedAt: string;
    }[];
    yDocBlobSize: number;
    name: string | null;
    accessedAt: string;
  };
}) => {
  const me = trpc.user.me.useQuery();
  // peiredically re-render so that the "last viwed time" and "lact active time"
  // are updated every second.
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return (
    <Card style={{ minWidth: 275, maxWidth: 275 }}>
      <Flex>
        <ReactLink
          to={`/repo/${repo.id}`}
          style={{
            alignItems: "center",
          }}
        >
          <Flex direction="row" display="inline-flex" gap="2">
            <FileText />
            <span>{repo.name || "Untitled"}</span>
          </Flex>
        </ReactLink>
        <Flex flexGrow={"1"}></Flex>
        <StarButton repo={repo} />
      </Flex>
      <Flex style={{ color: "gray" }}>
        Viewed {timeDifference(new Date(), new Date(repo.accessedAt))} ago
        <Flex flexGrow={"1"}></Flex>
        {/* the size */}
        {prettyPrintBytes(repo.yDocBlobSize)}
      </Flex>
      <Flex>
        {repo.userId !== me.data?.id && (
          <Tooltip content="Shared with me">
            <Users color="blue" />
          </Tooltip>
        )}
        {repo.public && (
          <Tooltip content="public">
            <LockOpen color="green" />
          </Tooltip>
        )}
        <DeleteRepoButton repo={repo} />
      </Flex>
    </Card>
  );
};

const RepoLists = () => {
  const getDashboardRepos = trpc.repo.getDashboardRepos.useQuery();

  if (getDashboardRepos.isLoading) {
    return <Spinner />;
  }
  if (getDashboardRepos.isError) {
    return <>ERROR: {getDashboardRepos.error.message}</>;
  }
  if (!getDashboardRepos.data) return <>no data</>;
  const repos = getDashboardRepos.data?.slice();
  // sort repos by last access time
  repos.sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (a.createdAt) {
      return -1;
    } else if (b.createdAt) {
      return 1;
    } else {
      return 0;
    }
  });
  return (
    <>
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
        }}
      >
        <Box
          style={{
            color: "#839DB5",
            fontSize: "25px",
          }}
        >
          My projects ({repos.length})
        </Box>
        <CreateRepoForm />
      </Box>

      {repos.length === 0 && (
        <Box
          style={{
            padding: "20px",
            color: "#6B87A2",
            fontSize: "18px",
            fontWeight: 600,
            display: "flex",
            // width: "100%",
            justifyContent: "center",
            alignContent: "center",
          }}
        >
          You don't have any projects yet. Click "Create New Project" to get
          started.
        </Box>
      )}
      <Flex wrap="wrap">
        {repos.map((repo) => (
          <Box style={{ margin: 1 }} key={repo.id}>
            <RepoCard repo={repo} />
          </Box>
        ))}
      </Flex>
    </>
  );
};

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
