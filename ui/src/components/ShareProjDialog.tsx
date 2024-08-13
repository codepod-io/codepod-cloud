import { useRef } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { trpc } from "@/lib/trpc";
import { ATOM_repoId } from "@/lib/store/atom";
import { useAtom, useAtomValue } from "jotai";
import {
  Dialog,
  Flex,
  Text,
  TextField,
  Button,
  Box,
  Card,
  Avatar,
  DropdownMenu,
} from "@radix-ui/themes";
import { toast, ToastContainer } from "react-toastify";
import { Check, Earth, Link, Lock } from "lucide-react";

function CollaboratorList({
  repoId,
  owner,
  collaborators,
}: {
  repoId: string;
  owner: { id: string; firstname: string; lastname: string; email: string };
  collaborators: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  }[];
}) {
  const utils = trpc.useUtils();
  const deleteCollaborator = trpc.repo.deleteCollaborator.useMutation({
    onSuccess: (data, { collaboratorId }) => {
      toast.success(`Remove the collaborator ${collaboratorId} successfully!`);
      // invalidate the query to get the latest data
      utils.repo.repo.invalidate({ id: repoId });
    },
    onError: (error) => {
      toast.error("Remove collaborator failed: " + error.message);
    },
  });

  return (
    <Flex direction="column" gap="2">
      {/* Owner */}
      <Card variant="ghost" style={{ margin: 0 }}>
        <Flex gap="3" align="center">
          <Avatar
            size="3"
            // src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
            radius="full"
            fallback={owner.firstname[0] + owner.lastname[0]}
          />
          <Box>
            <Text as="div" size="2" weight="bold">
              {owner.firstname + " " + owner.lastname}
            </Text>
            <Text as="div" size="2" color="gray">
              {owner.email}
            </Text>
          </Box>
          {/* role */}
          <Flex flexGrow="1" />
          <Text as="div" size="2" color="gray">
            Owner
          </Text>
        </Flex>
      </Card>
      {collaborators?.map((collab) => (
        <Card key={collab.id} variant="ghost" style={{ margin: 0 }}>
          <Flex gap="3" align="center">
            <Avatar
              size="3"
              // src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
              radius="full"
              fallback={collab.firstname[0] + collab.lastname[0]}
            />
            <Box>
              <Text as="div" size="2" weight="bold">
                {collab.firstname + " " + collab.lastname}
              </Text>
              <Text as="div" size="2" color="gray">
                {collab.email}
              </Text>
            </Box>
            <Flex flexGrow="1" />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="soft">
                  Editor
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item disabled>
                  <Check style={{ opacity: 0 }} />
                  Viewer
                </DropdownMenu.Item>
                <DropdownMenu.Item>
                  <Check /> Editor
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item color="red" disabled>
                  Transfer Ownership
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  color="red"
                  onClick={() => {
                    deleteCollaborator.mutate({
                      repoId: repoId,
                      collaboratorId: collab.id,
                    });
                  }}
                >
                  Remove Access
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}

export function ShareProjDialog() {
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) throw new Error("repoId is null");

  const { isLoading, isError, isSuccess, data } = trpc.repo.repo.useQuery(
    { id: repoId },
    { retry: false }
  );
  if (isLoading) return <>Loading</>;
  if (isError) return <>Error</>;
  if (!data) return <>No data</>;
  const { collaborators, owner, public: isPublic, name } = data;

  const url = `${window.location.protocol}//${window.location.host}/repo/${repoId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const addCollaborator = trpc.repo.addCollaborator.useMutation({
    onSuccess: () => {
      toast.success("Invitation is sent successfully!");
      // invalidate the query to get the latest data
      utils.repo.repo.invalidate({ id: repoId });
    },
    onError: (error) => {
      toast.error("Invitation failed: " + error.message);
    },
  });

  const updateVisibility = trpc.repo.updateVisibility.useMutation({
    onSuccess: () => {
      toast.success("Change visibility successfully!");
      // invalidate the query to get the latest data
      utils.repo.repo.invalidate({ id: repoId });
    },
    onError: (error) => {
      toast.error("Change visibility failed: " + error.message);
    },
  });

  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger>
          <Button variant="soft">Share</Button>
        </Dialog.Trigger>

        <Dialog.Content maxWidth="600px">
          {/* So that the toast message appear on the Portal. */}
          <ToastContainer pauseOnFocusLoss={false} />
          <Dialog.Title>
            Share Project:{" "}
            <span
              style={{
                fontFamily: "monospace",
                color: "blue",
                marginLeft: "5px",
              }}
            >
              {name || "Untitled"}
            </span>
          </Dialog.Title>

          {/* ==== Add people by email */}

          <label>
            <Flex gap="3">
              <TextField.Root
                placeholder="Add people by email"
                ref={inputRef}
                style={{
                  flexGrow: 1,
                }}
              />
              <Button
                variant="soft"
                onClick={() => {
                  const email = inputRef?.current?.value;
                  if (!email) {
                    toast.error("Email cannot be empty");
                    return;
                  }
                  addCollaborator.mutate({ repoId, email });
                }}
              >
                Invite
              </Button>
            </Flex>
          </label>

          {/* People with access */}

          <Text as="div" mt="5" weight="bold">
            People with access
          </Text>

          <CollaboratorList
            repoId={repoId}
            owner={owner}
            collaborators={collaborators}
          />

          {/* General Access Setting */}
          <Text as="div" size="2" mb="1" weight="bold" mt="5">
            General access
          </Text>
          <Card variant="ghost" style={{ margin: 0 }}>
            <Flex gap="3" align="center">
              <Avatar
                size="3"
                // src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
                radius="full"
                fallback={isPublic ? <Earth color="green" /> : <Lock />}
              />
              <Box>
                <Text as="div" size="2" weight="bold">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      {isPublic ? (
                        <Button variant="ghost">
                          Anyone with the link
                          <DropdownMenu.TriggerIcon />
                        </Button>
                      ) : (
                        <Button variant="ghost">
                          Restricted
                          <DropdownMenu.TriggerIcon />
                        </Button>
                      )}
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        onSelect={() => {
                          updateVisibility.mutate({
                            repoId,
                            isPublic: false,
                          });
                        }}
                      >
                        <Check style={{ opacity: isPublic ? 0 : 1 }} />
                        Restricted
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => {
                          updateVisibility.mutate({
                            repoId,
                            isPublic: true,
                          });
                        }}
                      >
                        <Check style={{ opacity: isPublic ? 1 : 0 }} />
                        Anyone with the link
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Text>
                <Text as="div" size="2" color="gray">
                  Only people with access can open with the link
                </Text>
              </Box>
            </Flex>
          </Card>

          <Flex gap="3" mt="4" justify="end">
            <CopyToClipboard
              text={url}
              onCopy={() => {
                // enqueueSnackbar(`copy success`, {
                //   variant: "success",
                // });
                toast.success("Link is copied to clipboard!");
              }}
            >
              <Button variant="outline">
                <Link /> Copy Link
              </Button>
            </CopyToClipboard>
            <Flex flexGrow={"1"} />
            <Dialog.Close>
              <Button>Done</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
