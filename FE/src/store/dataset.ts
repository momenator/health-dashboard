// Workspace state. In the new multi-project app, datasets are assumed to
// be loaded from cloud storage, so `loaded` is true by default. We keep
// the legacy shape so older guards still pass.

import { create } from "zustand";

type WorkspaceState = {
  loaded: boolean;
  activeProjectId: string | null;
  setActiveProject: (id: string | null) => void;
};

export const useDataset = create<WorkspaceState>((set) => ({
  loaded: true,
  activeProjectId: null,
  setActiveProject: (id) => set({ activeProjectId: id }),
}));
