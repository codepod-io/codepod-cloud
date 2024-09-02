import React, { useState, useEffect, useCallback } from "react";

import { Link as ReactLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";

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
import { prettyPrintBytes, timeDifference } from "@/lib/utils/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";
import { Earth, FileText, ThumbsUp, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";
import { atom, useAtom } from "jotai";

function CreateRepoForm(props) {
  const createRepo = trpc.repo.createRepo.useMutation({
    onError: (error) => {
      toast.error(error.message);
    },
  });
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

export const StarButton = ({
  repo,
}: {
  repo: {
    id: string;
    userId: string;
    public: boolean;
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
            <ThumbsUp color="red" fill="pink" />
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
            <ThumbsUp />
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

type RepoType = {
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

const ATOM_selectMode = atom(false);
const ATOM_selectedRepos = atom<RepoType[]>([]);

const RepoCard = ({ repo }: { repo: RepoType }) => {
  const me = trpc.user.me.useQuery();
  // peiredically re-render so that the "last viwed time" and "lact active time"
  // are updated every second.
  const [counter, setCounter] = useState(0);
  const [selectMode, setSelectMode] = useAtom(ATOM_selectMode);
  const [selectedRepos, setSelectedRepos] = useAtom(ATOM_selectedRepos);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return (
    <Card
      style={{ minWidth: 275, maxWidth: 275 }}
      onClick={() => {
        if (selectMode) {
          if (selectedRepos.map((repo) => repo.id).includes(repo.id)) {
            setSelectedRepos(selectedRepos.filter(({ id }) => id !== repo.id));
          } else {
            setSelectedRepos([...selectedRepos, repo]);
          }
        }
      }}
    >
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
      <Flex gap="2" align="center">
        {repo.userId !== me.data?.id && (
          <Tooltip content="Shared with me">
            <Users color="blue" />
          </Tooltip>
        )}
        {repo.public && (
          <Tooltip content="public">
            <Earth color="green" />
          </Tooltip>
        )}
        {selectMode && (
          <Checkbox
            id={repo.id}
            checked={selectedRepos.map((repo) => repo.id).includes(repo.id)}
          />
        )}
        <DeleteRepoButton repo={repo} />
      </Flex>
    </Card>
  );
};

function Pagination({ totalPages, currentPage, onPageChange }) {
  const [page, setPage] = useState(currentPage);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    onPageChange(newPage);
  };

  return (
    <Flex align="center" gap="8">
      <Button
        variant="ghost"
        onClick={() => handlePageChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        Previous
      </Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button variant="ghost">{`Page ${page} of ${totalPages}`}</Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content>
          {Array.from({ length: totalPages }).map((_, index) => (
            <DropdownMenu.Item
              key={index}
              onSelect={() => handlePageChange(index + 1)}
            >
              {`Page ${index + 1}`}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <Button
        variant="ghost"
        onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
      >
        Next
      </Button>
    </Flex>
  );
}

const DeleteSelectedButton = () => {
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
    onError() {
      toast.error("Failed to delete repo");
    },
  });
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button color="red" variant="ghost" disabled={deleteRepos.isLoading}>
          Delete Selected
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px">
        <AlertDialog.Title>Delete Selected Repository</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Th following repos will be deleted:
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
          Are you sure?
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

function PaginatedRepoLists({ repos }: { repos: RepoType[] }) {
  const [page, setPage] = useState(1);
  const [reposPerPage, setReposPerPage] = useState(20);
  const indexOfLastRepo = page * reposPerPage;
  const indexOfFirstRepo = indexOfLastRepo - reposPerPage;
  const currentRepos = repos.slice(indexOfFirstRepo, indexOfLastRepo);
  const [selectMode, setSelectMode] = useAtom(ATOM_selectMode);
  const [selectedRepos, setSelectedRepos] = useAtom(ATOM_selectedRepos);

  const paginate = (pageNumber) => setPage(pageNumber);

  return (
    <>
      <Flex
        align="center"
        justify="center"
        gap="9"
        style={{
          padding: "10px",
        }}
      >
        <Pagination
          totalPages={Math.ceil(repos.length / reposPerPage)}
          currentPage={page}
          onPageChange={paginate}
        />
        <Flex align="center" gap="3">
          <Select.Root
            defaultValue="20"
            onValueChange={(value: string) => {
              setReposPerPage(parseInt(value));
            }}
          >
            <Select.Trigger />
            <Select.Content
              // Do not auto focus when an item is selected.
              onCloseAutoFocus={(e) => {
                e.preventDefault();
              }}
            >
              <Select.Group>
                <Select.Label>Per Page</Select.Label>
                <Select.Item value="20">20</Select.Item>
                <Select.Item value="30">30</Select.Item>
                <Select.Item value="50">50</Select.Item>
              </Select.Group>
            </Select.Content>
          </Select.Root>
          per page
        </Flex>
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedRepos([]);
            setSelectMode(!selectMode);
          }}
        >
          {selectMode ? "Cancel" : "Select"}
        </Button>
        {selectMode && <DeleteSelectedButton />}
      </Flex>

      <Flex wrap="wrap">
        {currentRepos.map((repo) => (
          <Flex style={{ margin: 1 }} key={repo.id}>
            <RepoCard repo={repo} />
          </Flex>
        ))}
      </Flex>
    </>
  );
}

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
      <PaginatedRepoLists repos={repos} />
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
