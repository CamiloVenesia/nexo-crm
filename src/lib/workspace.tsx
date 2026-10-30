
import {
  createContext,
  useContext,
} from 'react';

export type WorkspaceRole = 'admin' | 'member';

export interface ActiveWorkspace {
  organizationId: string;
  organizationName: string;
  userId: string;
  userEmail: string;
  role: WorkspaceRole;
}

const WorkspaceContext =
  createContext<ActiveWorkspace | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: ActiveWorkspace;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
