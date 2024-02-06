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
import IconButton from "@mui/material/IconButton";

import {
  Button,
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
        variant="contained"
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
            size="small"
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
            size="small"
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
    <Box>
      <Tooltip title="Delete Repo">
        <IconButton
          disabled={deleteRepo.isLoading}
          size="small"
          sx={{
            "&:hover": {
              color: theme.palette.error.main,
            },
          }}
          onClick={() => {
            setOpen(true);
          }}
        >
          {deleteRepo.isLoading ? (
            <CircularProgress size="14px" />
          ) : (
            <DeleteIcon fontSize="inherit" />
          )}
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth>
        <DialogTitle>{`Delete ${repo.name}`}</DialogTitle>
        <DialogContent>Are you sure?</DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              deleteRepo.mutate({
                id: repo.id,
              });
              setOpen(false);
            }}
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

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
    name: string | null;
    yDocBlob: any;
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
          <Stack direction="row">
            Viewed {timeDifference(new Date(), new Date(repo.accessedAt))}
          </Stack>
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
          position: "relative",
        }}
      >
        Welcome! Please open or create a repository to get started.
      </Box>
      <RepoLists />
    </Box>
  );
}
