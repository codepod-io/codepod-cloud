import { useParams, useNavigate } from "react-router-dom";
import { Link as ReactLink } from "react-router-dom";

import { useEffect, useState, useCallback } from "react";

import debounce from "lodash/debounce";

import { Canvas } from "@/components/Canvas";
import { UserProfile } from "@/components/Header";
import { SidebarLeft, SidebarRight } from "@/components/Sidebar";

import * as Y from "yjs";

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

import { trpc, yjsTrpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";
import { atom, Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_connectYjs,
  ATOM_disconnectYjs,
  ATOM_providerSynced,
} from "@/lib/store/yjsSlice";
import {
  ATOM_collaborators,
  ATOM_editMode,
  ATOM_repoData,
  INIT_ZOOM,
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
import { StarButton } from "./dashboard_buttons";
import { env } from "@/lib/vars";
import { Header } from "@/components/Header";
import { myassert } from "@/lib/utils/utils";
import { ATOM_debugMode, ATOM_showLineNumbers } from "@/lib/store/settingSlice";
import { ATOM_updateView } from "@/lib/store/canvasSlice";

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
  // NOTE: do not get the value of ATOM_repoData here, as it will trigger
  // infinite loop of re-rendering.
  const setRepoData = useSetAtom(ATOM_repoData);
  const [loaded, setLoaded] = useState(false);

  // load the repo
  // FIXME this should be a mutation as it changes the last access time.
  const repoQuery = trpc.repo.repo.useQuery({ id }, { retry: false });

  const me = trpc.user.me.useQuery();
  const setEditMode = useSetAtom(ATOM_editMode);
  const setCollaborators = useSetAtom(ATOM_collaborators);

  const setDebugMode = useSetAtom(ATOM_debugMode);
  const setShowLineNumbers = useSetAtom(ATOM_showLineNumbers);

  useEffect(() => {
    if (repoQuery.data && me.data) {
      setCollaborators(repoQuery.data.collaborators);
      // set initial viewport zoom and position
      const userRepoData = repoQuery.data.UserRepoData;
      setRepoData({
        ...repoQuery.data,
        x: userRepoData[0]?.x || 0,
        y: userRepoData[0]?.y || 0,
        zoom: userRepoData[0]?.zoom || INIT_ZOOM,
      });
      if (
        me.data.id === repoQuery.data.userId ||
        repoQuery.data.collaborators.map(({ id }) => id).includes(me.data.id)
      ) {
        setEditMode("edit");
      }
      // set settings
      setDebugMode(me.data.setting?.debugMode || false);
      setShowLineNumbers(me.data.setting?.showLineNumbers || false);
      setLoaded(true);
    }
  }, [repoQuery, me]);
  if (repoQuery.isLoading) return <>Loading repo metadata</>;
  if (repoQuery.isError) {
    console.log("repoQuery.isError");
    return <NotFoundAlert />;
  }
  if (!repoQuery.data) {
    console.log("repoQuery.data is null");
    return <NotFoundAlert />;
  }
  // FIXME set data in useEffect is buggy, the children might be rendered before the data is set.
  if (!loaded) {
    // show unknown error, and a button to go back to dashboard.
    return (
      <Callout.Root color="red">
        <Callout.Icon>
          <InfoCircledIcon /> Error
        </Callout.Icon>
        <Callout.Text>
          Unknown error. Please go back to the{" "}
          <ReactLink to="/">dashboard</ReactLink>.
        </Callout.Text>
      </Callout.Root>
    );
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
  const updateView = useSetAtom(ATOM_updateView);

  useEffect(() => {
    async function func() {
      if (
        parserReady_python &&
        parserReady_racket &&
        parserReady_javascript &&
        parserReady_julia
      ) {
        await parseAllPods();
        propagateAllST();
        resolveAllPods();
        updateView();
      }
    }
    func();
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

function WaitForYjs({ children }) {
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
  if (!providerSynced) {
    // show "Loading Yjs" at the center of screen.
    return (
      <Flex
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Text>Loading Yjs</Text>
      </Flex>
    );
  }
  return children;
}

/**
 * A editable text field.
 */
function Title() {
  const [repoData, setRepoData] = useAtom(ATOM_repoData);
  if (!repoData) return null;

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
        updateRepo.mutate({ id: repoData.id, name });
      },
      1000,
      { maxWait: 5000 }
    ),
    []
  );
  return (
    <TextField.Root
      variant="surface"
      value={repoData.name || ""}
      placeholder="Untitled"
      onChange={(e) => {
        const name = e.target.value;
        setRepoData({ ...repoData, name });
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
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
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
      <StarButton repo={repoData} />

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

export const ATOM_previousVersion = atom<Y.Doc | null | "init">(null);

function PreviousVersionLoader() {
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const previousVersion = yjsTrpc.getPreviousVersion.useQuery({
    repoId: repoData.id,
  });
  const setPreviousVersion = useSetAtom(ATOM_previousVersion);
  useEffect(() => {
    if (previousVersion.isSuccess) {
      if (previousVersion.data) {
        // setPreviousVersion(previousVersion.data);
        // load into ydoc
        const ydoc = new Y.Doc();
        // The data was Buffer, but trpc converts it into {type: "Buffer"; data: number[];}.
        // We need to convert it back to Buffer.
        // const buf = Buffer.from(previousVersion.data.blob.data);
        // but Buffer is not available in browser, so we use Uint8Array.
        const buf = new Uint8Array(previousVersion.data.blob.data);
        Y.applyUpdate(ydoc, buf);
        // now this ydoc has codeMap ready to use.
        setPreviousVersion(ydoc);
      } else {
        setPreviousVersion("init");
      }
    }
  }, [previousVersion]);
  return null;
}

export function Repo() {
  return (
    <Provider>
      <RepoLoader>
        <PreviousVersionLoader />
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
            <WaitForYjs>
              <ParserWrapper>
                <MyKBar />
                <SidebarLeft />
                <Canvas />
                {/* Right sidebar */}
                <SidebarRight />
              </ParserWrapper>
            </WaitForYjs>
          </Flex>
        </Flex>
      </RepoLoader>
    </Provider>
  );
}
