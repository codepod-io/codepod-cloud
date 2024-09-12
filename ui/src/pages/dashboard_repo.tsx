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
  Popover,
  Select,
  Spinner,
  Tooltip,
} from "@radix-ui/themes";
import { prettyPrintBytes, timeDifference, useTick } from "@/lib/utils/utils";
import { runtimeTrpc, trpc } from "@/lib/trpc";
import { Earth, FileText, ThumbsUp, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";
import { atom, useAtom } from "jotai";
import { ATOM_selectedRepos, ATOM_selectMode, RepoType } from "./dashboard";
import {
  DeleteRepoButton,
  DeleteSelectedButton,
  StarButton,
} from "./dashboard_buttons";
import { match } from "ts-pattern";
import {
  JavaScriptLogo,
  JuliaLogo,
  PythonLogo,
  RacketLogo,
} from "@/components/nodes/utils";
import { SupportedLanguage } from "@/lib/store/types";

function Kernel({
  repoId,
  kernelName,
}: {
  repoId: string;
  kernelName: SupportedLanguage;
}) {
  const utils = runtimeTrpc.useUtils();
  const stopKernel = runtimeTrpc.k8s.stop.useMutation({
    onSuccess: () => {
      toast.success("Kernel terminated");
      utils.getKernels.invalidate({
        repoId,
      });
    },
  });
  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button variant="ghost">
          {match(kernelName)
            .with("python", () => <PythonLogo />)
            .with("julia", () => <JuliaLogo />)
            .with("javascript", () => <JavaScriptLogo />)
            .with("racket", () => <RacketLogo />)
            .otherwise(() => "??")}
        </Button>
      </Popover.Trigger>
      <Popover.Content>
        <Flex gap="3">
          <Box flexGrow="1">
            <Flex gap="3" mt="3" justify="between">
              <Popover.Close>
                <Button
                  size="1"
                  color="red"
                  onClick={() => {
                    stopKernel.mutate({
                      repoId,
                      kernelName: kernelName,
                    });
                  }}
                >
                  Terminate
                </Button>
              </Popover.Close>
            </Flex>
          </Box>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}

function ActiveRuntimes({ repo }: { repo: RepoType }) {
  const kernels = runtimeTrpc.getKernels.useQuery({
    repoId: repo.id,
  });

  if (kernels.isLoading) {
    return <Spinner />;
  }
  if (kernels.isError) {
    return <>ERROR: {kernels.error.message}</>;
  }
  return (
    <Flex gap="2" align="center">
      {kernels.data?.map((kernel) => (
        <Box key={kernel.id}>
          <Kernel repoId={repo.id} kernelName={kernel.name} />
        </Box>
      ))}
    </Flex>
  );
}

function ViewedAt({ repo }: { repo: RepoType }) {
  // peiredically re-render so that the "last viwed time" and "lact active time"
  // are updated every second.
  useTick(1000);
  return (
    <Flex>
      Viewed {timeDifference(new Date(), new Date(repo.accessedAt))} ago
    </Flex>
  );
}

const RepoCard = ({ repo }: { repo: RepoType }) => {
  const me = trpc.user.me.useQuery();
  const [selectMode, setSelectMode] = useAtom(ATOM_selectMode);
  const [selectedRepos, setSelectedRepos] = useAtom(ATOM_selectedRepos);
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
        <ViewedAt repo={repo} />
        <Flex flexGrow={"1"}></Flex>
        {/* the size */}
        {prettyPrintBytes(repo.yDocBlob?.size || 0)}
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
        <ActiveRuntimes repo={repo} />
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

export const RepoLists = () => {
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
