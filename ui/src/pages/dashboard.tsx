import React, { useState, useEffect, useCallback } from "react";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import DeleteIcon from "@mui/icons-material/Delete";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import CircularProgress from "@mui/material/CircularProgress";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import PublicOffIcon from "@mui/icons-material/PublicOff";
import Tooltip from "@mui/material/Tooltip";

import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { AlertDialog, Button, Flex, IconButton } from "@radix-ui/themes";
import { timeDifference } from "@/lib/utils/utils";
import { useSnackbar } from "notistack";
import { useTheme } from "@mui/material/styles";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";

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
        <Tooltip title="unstar">
          <IconButton
            size="1"
            variant="ghost"
            onClick={() => {
              unstar.mutate({ repoId: repo.id });
            }}
            disabled={unstar.isLoading}
          >
            <StarIcon
              fontSize="inherit"
              sx={{
                color: "orange",
              }}
            />
            {repo.stargazers.length}
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="star">
          <IconButton
            size="1"
            variant="ghost"
            onClick={() => {
              star.mutate({ repoId: repo.id });
            }}
            disabled={star.isLoading}
          >
            <StarBorderIcon fontSize="inherit" />
            {repo.stargazers.length}
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};

const DeleteRepoButton = ({ repo }) => {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const utils = trpc.useUtils();
  const deleteRepo = trpc.repo.deleteRepo.useMutation({
    onSuccess(input) {
      enqueueSnackbar("Successfully deleted repo", { variant: "success" });
      utils.repo.getDashboardRepos.invalidate();
    },
    onError() {
      enqueueSnackbar("Failed to delete repo", { variant: "error" });
    },
  });
  const theme = useTheme();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <IconButton
          size="1"
          color="red"
          variant="ghost"
          disabled={deleteRepo.isLoading}
        >
          {deleteRepo.isLoading ? (
            <CircularProgress size="14px" />
          ) : (
            <DeleteIcon fontSize="inherit" />
          )}
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
    <Card sx={{ minWidth: 275, maxWidth: 275 }}>
      <CardContent>
        <Stack direction="row" display="flex">
          <Link
            component={ReactLink}
            to={`/repo/${repo.id}`}
            sx={{
              alignItems: "center",
            }}
          >
            <Stack direction="row" display="inline-flex">
              <DescriptionOutlinedIcon
                sx={{
                  marginRight: "5px",
                }}
              />
              <Box component="span">{repo.name || "Untitled"}</Box>
            </Stack>
          </Link>
          <Box ml="auto">
            <StarButton repo={repo} />
          </Box>
        </Stack>
        <Typography variant="subtitle2" color="gray">
          <Flex direction="row">
            Viewed {timeDifference(new Date(), new Date(repo.accessedAt))} ago
            <Flex flexGrow={"1"}></Flex>
            {/* the size */}
            {prettyPrintBytes(repo.yDocBlobSize)}
          </Flex>
        </Typography>
      </CardContent>
      <CardActions disableSpacing>
        <Box>
          {repo.userId !== me.data?.id && (
            <Tooltip title="Shared with me">
              <GroupsIcon fontSize="small" color="primary" />
            </Tooltip>
          )}
          {repo.public && (
            <Tooltip title="public">
              <PublicIcon fontSize="small" color="success" />
            </Tooltip>
          )}
        </Box>
        <DeleteRepoButton repo={repo} />
      </CardActions>
    </Card>
  );
};

const RepoLists = () => {
  const getDashboardRepos = trpc.repo.getDashboardRepos.useQuery();

  if (getDashboardRepos.isLoading) {
    return <CircularProgress />;
  }
  if (getDashboardRepos.isError) {
    return <Box>ERROR: {getDashboardRepos.error.message}</Box>;
  }
  if (!getDashboardRepos.data) return <Box>no data</Box>;
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
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
        }}
      >
        <Box
          sx={{
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
          sx={{
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
      <Box display="flex" flexWrap="wrap">
        {repos.map((repo) => (
          <Box sx={{ m: 1 }} key={repo.id}>
            <RepoCard repo={repo} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export function Dashboard() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn()) {
    return (
      <Box sx={{ maxWidth: "md", alignItems: "center", m: "auto" }}>
        Not signed in.
      </Box>
    );
  }
  return (
    <Box sx={{ maxWidth: "md", alignItems: "center", m: "auto" }}>
      <Box
        sx={{
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
