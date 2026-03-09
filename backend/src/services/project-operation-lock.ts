const activeProjectOperations = new Set<string>();

export interface ProjectOperationLock {
  acquired: boolean;
  release: () => void;
}

export function acquireProjectOperationLock(projectId: string): ProjectOperationLock {
  if (activeProjectOperations.has(projectId)) {
    return {
      acquired: false,
      release: () => {},
    };
  }

  activeProjectOperations.add(projectId);

  return {
    acquired: true,
    release: () => {
      activeProjectOperations.delete(projectId);
    },
  };
}
