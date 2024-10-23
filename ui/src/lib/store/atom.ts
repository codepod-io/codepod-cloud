import { atom } from "jotai";

export const INIT_ZOOM = 1.001;

type RepoData = {
  name: string | null;
  id: string;
  x: number;
  y: number;
  zoom: number;
  numLikes: number;
  versions: {
    repoId: string;
    message: string;
    id: string;
    time: string;
  }[];
};
export const ATOM_repoData = atom<RepoData | null>(null);

export const ATOM_editMode = atom<"view" | "edit">("view");
export const ATOM_shareOpen = atom<boolean>(false);

export const ATOM_collaborators = atom<any[]>([]);

export const ATOM_error = atom<{ type: string; msg: string } | null>(null);

export const ATOM_cutId = atom<string | null>(null);

export const ATOM_currentPage = atom<string | undefined>(undefined);
