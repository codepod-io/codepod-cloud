import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

import {
  useEffect,
  useState,
  useRef,
  useContext,
  memo,
  createContext,
  useCallback,
} from "react";

import debounce from "lodash/debounce";

import { Canvas } from "@/components/Canvas";
import { UserProfile } from "@/components/Header";
import { SidebarLeft, SidebarRight } from "@/components/Sidebar";
import { Typography } from "@mui/material";

import { Link as RadixLink, TextField } from "@radix-ui/themes";

import { initParser } from "@/lib/parser";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";
import { Provider, atom, useAtom, useSetAtom } from "jotai";
import {
  ATOM_connectYjs,
  ATOM_disconnectYjs,
  ATOM_providerSynced,
} from "@/lib/store/yjsSlice";
import {
  ATOM_collaborators,
  ATOM_editMode,
  ATOM_isPublic,
  ATOM_repoId,
  ATOM_repoName,
  ATOM_shareOpen,
} from "@/lib/store/atom";
import {
  ATOM_parseAllPods,
  ATOM_resolveAllPods,
} from "@/lib/store/runtimeSlice";
import { MyKBar } from "@/components/MyKBar";
import { Container, Flex } from "@radix-ui/themes";

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
  const setRepoName = useSetAtom(ATOM_repoName);

  const me = trpc.user.me.useQuery();
  const setEditMode = useSetAtom(ATOM_editMode);
  const setRepoId = useSetAtom(ATOM_repoId);
  const setIsPublic = useSetAtom(ATOM_isPublic);
  const setCollaborators = useSetAtom(ATOM_collaborators);

  // console.log("load store", useRef(createRepoStore()));
  useEffect(() => {
    setRepoId(id!);
  }, []);

  useEffect(() => {
    if (repoQuery.data && me.data) {
      setRepoName(repoQuery.data.name);
      setIsPublic(repoQuery.data.public);
      setCollaborators(repoQuery.data.collaborators);
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
  const parseAllPods = useSetAtom(ATOM_parseAllPods);
  // const resolveAllPods = useStore(store, (state) => state.resolveAllPods);
  const resolveAllPods = useSetAtom(ATOM_resolveAllPods);
  const [parserLoaded, setParserLoaded] = useState(false);

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
  }, [parseAllPods, parserLoaded, resolveAllPods]);

  return children;
}

function WaitForProvider({ children }) {
  const [providerSynced] = useAtom(ATOM_providerSynced);
  const disconnectYjs = useSetAtom(ATOM_disconnectYjs);
  const connectYjs = useSetAtom(ATOM_connectYjs);
  const me = trpc.user.me.useQuery();
  useEffect(() => {
    connectYjs(me.data?.firstname || "Anonymous");
    return () => {
      disconnectYjs();
    };
  }, [connectYjs, disconnectYjs]);
  if (!providerSynced)
    return (
      <Box>
        {/* Show the header while loading yjs doc. */}
        <Header> </Header>
        <Box>Loading Yjs Doc ..</Box>
      </Box>
    );
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

/**
 * A editable text field.
 */
function Title() {
  const [repoName, setRepoName] = useAtom(ATOM_repoName);
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) return null;

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
  return (
    <TextField.Root
      variant="surface"
      value={repoName || ""}
      placeholder="Untitled"
      onChange={(e) => {
        const name = e.target.value;
        setRepoName(name);
        debouncedUpdateRepo(name);
      }}
    />
  );
}

function Header({ children }) {
  return (
    <Box>
      {/* maxWidth container */}
      <Container
        size="4"
        style={{
          border: "2px solid lightgray",
          backgroundColor: "white",
        }}
      >
        {/* The header items */}
        <Flex align="center" my="2" gap="3">
          <RadixLink asChild>
            <ReactLink to="/">
              <Typography noWrap>CodePod</Typography>
            </ReactLink>
          </RadixLink>
          {children}
          {/* The right side */}
          <Box flexGrow="1" />
          <UserProfile />
        </Flex>
      </Container>
    </Box>
  );
}

export function Repo() {
  let { id } = useParams();

  return (
    <Provider>
      <UserWrapper>
        <RepoLoader id={id}>
          <WaitForProvider>
            <ParserWrapper>
              <Flex direction="column" height="100vh">
                <Header>
                  {/* The  left side*/}
                  <Box>/</Box>
                  {/* <HeaderItem /> */}
                  <Title />
                </Header>
                <Flex height="100%">
                  <MyKBar />
                  {/* Left sidebar */}
                  <SidebarLeft />
                  {/* The Canvas */}
                  <Box
                    height="100%"
                    width="100%"
                    border="solid 3px black"
                    boxSizing={"border-box"}
                    overflow="auto"
                  >
                    <Canvas />
                  </Box>
                  {/* Right sidebar */}
                  <SidebarRight />
                </Flex>
              </Flex>
            </ParserWrapper>
          </WaitForProvider>
        </RepoLoader>
      </UserWrapper>
    </Provider>
  );
}
