import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Button from "@mui/material/Button";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import {
  useEffect,
  useState,
  useRef,
  useContext,
  memo,
  createContext,
  useCallback,
} from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

import { useStore } from "zustand";

import debounce from "lodash/debounce";

import { createRepoStore, RepoContext } from "../lib/store";

import { Canvas } from "../components/Canvas";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  Breadcrumbs,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { initParser } from "../lib/parser";

import { usePrompt } from "../lib/prompt";
import { containerContext, containerTrpc, copilotContext, copilotTrpc, trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";

const HeaderItem = memo<any>(() => {
  const store = useContext(RepoContext)!;
  const repoName = useStore(store, (state) => state.repoName);
  const setRepoName = useStore(store, (state) => state.setRepoName);
  const editMode = useStore(store, (state) => state.editMode);
  const repoId = useStore(store, (state) => state.repoId)!;

  const utils = trpc.useUtils();
  const updateRepo = trpc.repo.updateRepo.useMutation({
    onSuccess: () => {
      utils.repo.getDashboardRepos.invalidate();
    },
  });
  const debouncedUpdateRepo = useCallback(
    debounce(
      (name: string) => {
        console.log("update repo", name);
        updateRepo.mutate({ id: repoId, name });
      },
      1000,
      { maxWait: 5000 }
    ),
    []
  );

  const [focus, setFocus] = useState(false);
  const [enter, setEnter] = useState(false);

  const textfield = (
    <TextField
      hiddenLabel
      placeholder="Untitled"
      value={repoName || ""}
      size="small"
      variant={focus ? undefined : "standard"}
      onFocus={() => {
        setFocus(true);
      }}
      onKeyDown={(e) => {
        if (["Enter", "Escape"].includes(e.key)) {
          e.preventDefault();
          setFocus(false);
        }
      }}
      onMouseEnter={() => {
        setEnter(true);
      }}
      onMouseLeave={() => {
        setEnter(false);
      }}
      autoFocus={focus ? true : false}
      onBlur={() => {
        setFocus(false);
      }}
      InputProps={{
        ...(focus
          ? {}
          : {
              disableUnderline: true,
            }),
      }}
      sx={{
        // Try to compute a correct width so that the textfield size changes
        // according to content size.
        width: `${((repoName?.length || 0) + 6) * 6}px`,
        minWidth: "100px",
        maxWidth: "500px",
        border: "none",
      }}
      disabled={editMode === "view"}
      onChange={(e) => {
        const name = e.target.value;
        setRepoName(name);
        debouncedUpdateRepo(name);
      }}
    />
  );

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
      }}
      spacing={1}
    >
      {!focus && enter ? (
        <Tooltip
          title="Edit"
          sx={{
            margin: 0,
            padding: 0,
          }}
          // placement="right"
          followCursor
        >
          {textfield}
        </Tooltip>
      ) : (
        textfield
      )}
    </Stack>
  );
});

function RepoHeader({ id }) {
  const store = useContext(RepoContext)!;

  const setShareOpen = useStore(store, (state) => state.setShareOpen);
  const copyRepo = trpc.repo.copyRepo.useMutation();
  useEffect(() => {
    if (copyRepo.isSuccess) {
      const newRepoId = copyRepo.data;
      window.open(`/repo/${newRepoId}`);
    }
  }, [copyRepo]);
  return (
    <Header>
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          alignItems: "baseline",
          display: "flex",
          flexGrow: 1,
        }}
      >
        <Link component={ReactLink} underline="hover" to="/">
          <Typography noWrap>CodePod</Typography>
        </Link>
        <HeaderItem />
      </Breadcrumbs>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          paddingRight: "10px",
        }}
      >
        <Button
          endIcon={<ContentCopyIcon />}
          onClick={() => copyRepo.mutate({ repoId: id })}
          variant="contained"
        >
          Make a copy
        </Button>
      </Box>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          paddingRight: "10px",
        }}
      >
        <Button
          endIcon={<ShareIcon />}
          onClick={() => setShareOpen(true)}
          variant="contained"
        >
          Share
        </Button>
      </Box>
    </Header>
  );
}

/**
 * Wrap the repo page with a header, a sidebar and a canvas.
 */
function HeaderWrapper({ children, id }) {
  const store = useContext(RepoContext)!;
  const isSidebarOnLeftHand = useStore(
    store,
    (state) => state.isSidebarOnLeftHand
  );
  const [open, setOpen] = useState(true);
  let sidebar_width = "240px";
  let header_height = "50px";

  return (
    <Box
      sx={{
        height: "100%",
      }}
    >
      {/* The header. */}
      <RepoHeader id={id} />
      {/* The sidebar */}
      <Drawer
        sx={{
          width: sidebar_width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: sidebar_width,
            boxSizing: "border-box",
          },
        }}
        variant="persistent"
        anchor={isSidebarOnLeftHand ? "left" : "right"}
        open={open}
      >
        <Box
          sx={{
            pt: header_height,
            verticalAlign: "top",
            height: "100%",
            overflow: "auto",
          }}
        >
          <Box sx={{ mx: 2, my: 1 }}>
            <Sidebar />
          </Box>
        </Box>
      </Drawer>

      {/* The button to toggle sidebar. */}
      <Box
        style={{
          position: "absolute",
          margin: "5px",
          top: header_height,
          ...(isSidebarOnLeftHand && { left: open ? sidebar_width : 0 }),
          ...(!isSidebarOnLeftHand && { right: open ? sidebar_width : 0 }),
          transition: "all .2s",
          zIndex: 100,
        }}
      >
        <IconButton
          onClick={() => {
            setOpen(!open);
          }}
          size="small"
          color="primary"
        >
          {isSidebarOnLeftHand ? (
            open ? (
              <ChevronLeftIcon />
            ) : (
              <ChevronRightIcon />
            )
          ) : open ? (
            <ChevronRightIcon />
          ) : (
            <ChevronLeftIcon />
          )}
        </IconButton>
      </Box>

      {/* The Canvas */}
      <Box
        sx={{
          display: "inline-flex",
          flexGrow: 1,
          verticalAlign: "top",
          height: "100%",
          ...(isSidebarOnLeftHand && { ml: open ? sidebar_width : 0 }),
          width: open ? `calc(100% - ${sidebar_width})` : "100%",
          overflow: "scroll",
        }}
      >
        <Box
          sx={{
            boxSizing: "border-box",
            width: "100%",
            height: "100%",
            pt: header_height,
            mx: "auto",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function NotFoundAlert({}) {
  return (
    <Box sx={{ maxWidth: "sm", alignItems: "center", m: "auto" }}>
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        The repo you are looking for is not found. Please check the URL. Go back
        your{" "}
        <Link component={ReactLink} to="/">
          dashboard
        </Link>
      </Alert>
    </Box>
  );
}

function RepoLoader({ id, children }) {
  // load the repo
  // FIXME this should be a mutation as it changes the last access time.
  const repoQuery = trpc.repo.repo.useQuery({ id });
  const store = useContext(RepoContext)!;
  const setRepoData = useStore(store, (state) => state.setRepoData);

  const me = trpc.user.me.useQuery();
  const setEditMode = useStore(store, (state) => state.setEditMode);

  useEffect(() => {
    if (repoQuery.data && me.data) {
      setRepoData(repoQuery.data);
      if (
        me.data?.id === repoQuery.data.userId ||
        repoQuery.data.collaborators.map(({ id }) => id).includes(me.data?.id)
      ) {
        setEditMode("edit");
      }
    }
  }, [repoQuery, me]);
  if (repoQuery.isLoading) return <Box>Loading</Box>;
  if (repoQuery.isError) {
    return <Box>Error: Repo not found</Box>;
  }
  if (!repoQuery.data) return <NotFoundAlert />;
  return children;
}

/**
 * This loads repo metadata.
 */
function ParserWrapper({ children }) {
  const store = useContext(RepoContext)!;
  const parseAllPods = useStore(store, (state) => state.parseAllPods);
  const resolveAllPods = useStore(store, (state) => state.resolveAllPods);
  const [parserLoaded, setParserLoaded] = useState(false);
  const scopedVars = useStore(store, (state) => state.scopedVars);

  useEffect(() => {
    initParser("/", () => {
      setParserLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (parserLoaded) {
      parseAllPods();
      resolveAllPods();
    }
  }, [parseAllPods, parserLoaded, resolveAllPods, scopedVars]);

  return children;
}

function WaitForProvider({ children, yjsWsUrl }) {
  const store = useContext(RepoContext)!;
  const providerSynced = useStore(store, (state) => state.providerSynced);
  const disconnectYjs = useStore(store, (state) => state.disconnectYjs);
  const connectYjs = useStore(store, (state) => state.connectYjs);
  const me = trpc.user.me.useQuery();
  useEffect(() => {
    connectYjs({ yjsWsUrl, name: me.data?.firstname || "Anonymous" });
    return () => {
      disconnectYjs();
    };
  }, [connectYjs, disconnectYjs]);
  if (!providerSynced) return <Box>Loading Yjs Doc ..</Box>;
  return children;
}

/**
 * This loads users.
 */
function UserWrapper({ children }) {
  const { isSignedIn } = useAuth();

  if (!isSignedIn()) return <Box>Not signed In</Box>;

  return children;
}

function ContainerTrpcProvider({ children }) {
  const { getAuthHeaders } = useAuth();
  const queryClient = new QueryClient();
  const trpcClient = containerTrpc.createClient({
    links: [
      httpBatchLink({
        // TODO replace with container url.
        // FIXME add auth
        url: "http://localhost:4001/trpc",
        headers: getAuthHeaders(),
      }),
    ],
  });
  return (
    <containerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient} context={containerContext}>
        {children}
      </QueryClientProvider>
    </containerTrpc.Provider>
  );
}

function CopilotTrpcProvider({ children }) {
  const { getAuthHeaders } = useAuth();
  const queryClient = new QueryClient();
  const trpcClient = copilotTrpc.createClient({
    links: [
      httpBatchLink({
        // TODO replace with copilot url.
        // FIXME add auth
        url: "http://localhost:4333/trpc",
        headers: getAuthHeaders(),
      }),
    ],
  });
  return (
    <copilotTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient} context={copilotContext}>
        {children}
      </QueryClientProvider>
    </copilotTrpc.Provider>
  );
}


export function Repo({ yjsWsUrl }) {
  let { id } = useParams();
  const store = useRef(createRepoStore()).current;

  const setRepo = useStore(store, (state) => state.setRepo);
  // console.log("load store", useRef(createRepoStore()));
  useEffect(() => {
    setRepo(id!);
  }, []);
  return (
    <RepoContext.Provider value={store}>
      <ContainerTrpcProvider>
        <CopilotTrpcProvider>
        <UserWrapper>
          <RepoLoader id={id}>
            <WaitForProvider yjsWsUrl={yjsWsUrl}>
              <ParserWrapper>
                <HeaderWrapper id={id}>
                  <Box
                    height="100%"
                    border="solid 3px black"
                    p={2}
                    boxSizing={"border-box"}
                    // m={2}
                    overflow="auto"
                  >
                    <Canvas />
                  </Box>
                </HeaderWrapper>
              </ParserWrapper>
            </WaitForProvider>
          </RepoLoader>
        </UserWrapper>
        </CopilotTrpcProvider>
      </ContainerTrpcProvider>
    </RepoContext.Provider>
  );
}
