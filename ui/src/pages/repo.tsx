import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";

import { useEffect, useState, useCallback } from "react";

import debounce from "lodash/debounce";

import { Canvas } from "@/components/Canvas";
import { UserProfile } from "@/components/Header";
import { SidebarLeft, SidebarRight } from "@/components/Sidebar";

import {
  Text,
  Link as RadixLink,
  TextField,
  Callout,
  Avatar,
  Box,
} from "@radix-ui/themes";

import {
  ATOM_loadParser as ATOM_loadParser_python,
  ATOM_parserReady as ATOM_parserReady_python,
} from "@/lib/parser";
import {
  ATOM_loadParser as ATOM_loadParser_racket,
  ATOM_parserReady as ATOM_parserReady_racket,
} from "@/lib/parserRacket";
import {
  ATOM_loadParser as ATOM_loadParser_javascript,
  ATOM_parserReady as ATOM_parserReady_javascript,
} from "@/lib/parserJavascript";

import {
  ATOM_loadParser as ATOM_loadParser_julia,
  ATOM_parserReady as ATOM_parserReady_julia,
} from "@/lib/parserJulia";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
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
  ATOM_repoX,
  ATOM_repoY,
  ATOM_repoZoom,
  ATOM_shareOpen,
} from "@/lib/store/atom";
import {
  ATOM_parseAllPods,
  ATOM_propagateAllST,
  ATOM_resolveAllPods,
} from "@/lib/store/runtimeSlice";
import { MyKBar } from "@/components/MyKBar";
import { Container, Flex } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { ShareProjDialog } from "@/components/ShareProjDialog";
import { StarButton } from "./dashboard";
import { env } from "@/lib/vars";
import { Header } from "@/components/Header";

function NotFoundAlert({}) {
  return (
    <Callout.Root color="red">
      <Callout.Icon>
        <InfoCircledIcon /> Error
      </Callout.Icon>
      <Callout.Text>
        The repo you are looking for is not found. Please check the URL. Go back
        your{" "}
        <RadixLink asChild>
          <ReactLink to="/">dashboard</ReactLink>
        </RadixLink>
      </Callout.Text>
    </Callout.Root>
  );
}

function RepoLoader({ children }) {
  const { id } = useParams();
  if (!id) throw "Id is null";
  const setRepoId = useSetAtom(ATOM_repoId);
  setRepoId(id);

  // load the repo
  // FIXME this should be a mutation as it changes the last access time.
  const repoQuery = trpc.repo.repo.useQuery({ id }, { retry: false });
  const setRepoName = useSetAtom(ATOM_repoName);
  const setRepoZoom = useSetAtom(ATOM_repoZoom);
  const setRepoX = useSetAtom(ATOM_repoX);
  const setRepoY = useSetAtom(ATOM_repoY);

  const me = trpc.user.me.useQuery();
  const setEditMode = useSetAtom(ATOM_editMode);
  const setIsPublic = useSetAtom(ATOM_isPublic);
  const setCollaborators = useSetAtom(ATOM_collaborators);

  useEffect(() => {
    if (repoQuery.data && me.data) {
      setRepoName(repoQuery.data.name);
      setIsPublic(repoQuery.data.public);
      setCollaborators(repoQuery.data.collaborators);
      // set initial viewport zoom and position
      const userRepoData = repoQuery.data.UserRepoData;
      if (userRepoData.length > 0) {
        const zoom = userRepoData[0].zoom;
        if (zoom) setRepoZoom(zoom);
        const x = userRepoData[0].x;
        if (x) setRepoX(x);
        const y = userRepoData[0].y;
        if (y) setRepoY(y);
      }
      if (
        me.data?.id === repoQuery.data.userId ||
        repoQuery.data.collaborators.map(({ id }) => id).includes(me.data?.id)
      ) {
        setEditMode("edit");
      }
    }
  }, [repoQuery, me]);
  if (repoQuery.isLoading) return <>Loading</>;
  if (repoQuery.isError) {
    console.log("repoQuery.isError");
    return <NotFoundAlert />;
  }
  if (!repoQuery.data) {
    console.log("repoQuery.data is null");
    return <NotFoundAlert />;
  }
  return children;
}

/**
 * This loads repo metadata.
 */
function ParserWrapper({ children }) {
  const parseAllPods = useSetAtom(ATOM_parseAllPods);
  const propagateAllST = useSetAtom(ATOM_propagateAllST);
  const resolveAllPods = useSetAtom(ATOM_resolveAllPods);

  const loadParser_python = useSetAtom(ATOM_loadParser_python);
  loadParser_python();
  const parserReady_python = useAtomValue(ATOM_parserReady_python);

  const loadParser_racket = useSetAtom(ATOM_loadParser_racket);
  loadParser_racket();
  const parserReady_racket = useAtomValue(ATOM_parserReady_racket);

  const loadParser_javascript = useSetAtom(ATOM_loadParser_javascript);
  loadParser_javascript();
  const parserReady_javascript = useAtomValue(ATOM_parserReady_javascript);

  const loadParser_julia = useSetAtom(ATOM_loadParser_julia);
  loadParser_julia();
  const parserReady_julia = useAtomValue(ATOM_parserReady_julia);

  useEffect(() => {
    if (
      parserReady_python &&
      parserReady_racket &&
      parserReady_javascript &&
      parserReady_julia
    ) {
      parseAllPods();
      propagateAllST();
      resolveAllPods();
    }
  }, [
    parseAllPods,
    resolveAllPods,
    parserReady_python,
    parserReady_racket,
    parserReady_javascript,
    parserReady_julia,
  ]);

  return children;
}

function WaitForProvider({ children }) {
  const [providerSynced] = useAtom(ATOM_providerSynced);
  const disconnectYjs = useSetAtom(ATOM_disconnectYjs);
  const connectYjs = useSetAtom(ATOM_connectYjs);
  const me = trpc.user.me.useQuery(undefined, { retry: false });
  useEffect(() => {
    connectYjs(me.data?.firstname || "Anonymous");
    return () => {
      disconnectYjs();
    };
  }, [connectYjs, disconnectYjs]);
  if (!providerSynced)
    return (
      <>
        {/* Show the header while loading yjs doc. */}
        <HeaderWithItems />
        <>Loading Yjs Doc ..</>
      </>
    );
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

function ActiveEditors() {
  return (
    // Active editors. Tricks: row-reverse AND position: relative.
    <Flex direction="row-reverse">
      <Avatar
        size="3"
        // src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
        radius="full"
        fallback="+12"
        style={{
          // marginRight: "-10px",
          border: "2px solid white",
          backgroundColor: "lightgray",
          position: "relative",
        }}
      />
      <Avatar
        size="3"
        src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
        radius="full"
        fallback="T"
        style={{
          marginRight: "-10px",
          border: "2px solid white",
          position: "relative",
        }}
      />
      <Avatar
        size="3"
        src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
        radius="full"
        fallback="T"
        style={{
          marginRight: "-10px",
          border: "2px solid white",
          position: "relative",
        }}
      />
      <Avatar
        size="3"
        src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
        radius="full"
        fallback="T"
        style={{
          marginRight: "-10px",
          border: "2px solid white",
          position: "relative",
        }}
      />
    </Flex>
  );
}

function HeaderWithItems() {
  const repoId = useAtomValue(ATOM_repoId);
  if (!repoId) throw "repoId is null";
  const {
    isLoading,
    isError,
    isSuccess,
    data: repo,
  } = trpc.repo.repo.useQuery({ id: repoId }, { retry: false });
  if (isLoading) return <>Loading</>;
  if (isError) return <>Error</>;
  if (!isSuccess) return <>No data</>;
  if (!repo) return <>Repo not found</>;
  return (
    <Header>
      <RadixLink asChild>
        <ReactLink to="/">
          <Text>CodePod</Text>
        </ReactLink>
      </RadixLink>
      {/* The  left side*/}
      <>/</>
      {/* <HeaderItem /> */}
      <Title />
      {/* thumbsup */}
      <StarButton repo={repo} />

      <Flex flexGrow="1" />

      {env.READ_ONLY && (
        <Box style={{ color: "red", backgroundColor: "yellow" }}>
          READ ONLY MODE
        </Box>
      )}

      {/* === The right side */}
      <Flex flexGrow="1" />

      {/* <ActiveEditors /> */}

      <ShareProjDialog />
      <UserProfile />
    </Header>
  );
}

export function Repo() {
  return (
    <Provider>
      <RepoLoader>
        <WaitForProvider>
          <ParserWrapper>
            <Flex direction="column" height="100vh">
              <Flex>
                <HeaderWithItems />
              </Flex>
              <Flex
                flexGrow={"1"}
                // The main content is filled to the entire height.
                // Overflow="hidden" is required to make the canvas full height
                // without scroll.
                overflow={"hidden"}
              >
                <MyKBar />
                <SidebarLeft />
                <Canvas />
                {/* Right sidebar */}
                <SidebarRight />
              </Flex>
            </Flex>
          </ParserWrapper>
        </WaitForProvider>
      </RepoLoader>
    </Provider>
  );
}
