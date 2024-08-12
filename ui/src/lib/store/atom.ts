import { atom } from "jotai";

export const ATOM_repoName = atom<string | null>(null);
export const ATOM_repoId = atom<string | null>(null);
export const INIT_ZOOM = 1.001;
export const ATOM_repoZoom = atom<number>(INIT_ZOOM);
export const ATOM_repoX = atom<number>(0);
export const ATOM_repoY = atom<number>(0);

export const ATOM_editMode = atom<"view" | "edit">("view");
export const ATOM_shareOpen = atom<boolean>(false);

export const ATOM_collaborators = atom<any[]>([]);

export const ATOM_isPublic = atom(false);

export const ATOM_error = atom<{ type: string; msg: string } | null>(null);
