import { createStore, StateCreator, StoreApi } from "zustand";
import { produce } from "immer";

import { MyState } from ".";

export interface RepoSlice {
  repoName: string | null;
  repoId: string | null;
  editMode: "view" | "edit";
  setEditMode: (mode: "view" | "edit") => void;
  setRepo: (repoId: string) => void;
  setRepoName: (name: string) => void;
  setRepoData: (repo: {
    id: string;
    name: string | null;
    userId: string;
    public: boolean;
    collaborators: {
      id: string;
      email: string;
      firstname: string;
      lastname: string;
    }[];
  }) => void;
  collaborators: any[];
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  isPublic: boolean;
}

export const createRepoSlice: StateCreator<MyState, [], [], RepoSlice> = (
  set,
  get
) => ({
  repoId: null,
  repoName: null,
  collaborators: [],
  isPublic: false,
  shareOpen: false,
  setShareOpen: (open: boolean) => set({ shareOpen: open }),

  editMode: "view",
  setEditMode: (mode) => set({ editMode: mode }),

  setRepo: (repoId: string) =>
    set(
      produce((state: MyState) => {
        state.repoId = repoId;
      })
    ),
  setRepoName: (name) => {
    set(
      produce((state: MyState) => {
        state.repoName = name;
      })
    );
  },
  // FIXME refactor out this function
  setRepoData: (repo) =>
    set(
      produce((state: MyState) => {
        state.repoName = repo.name;
        state.isPublic = repo.public;
        state.collaborators = repo.collaborators;
      })
    ),
});
