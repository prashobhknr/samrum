/**
 * Phase 4: State Management (Zustand)
 * 
 * Global state for authentication, processes, tasks, doors
 */

import { create } from 'zustand';
import { User } from './auth';
import { Process, Task, DoorInstance } from './api';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  
  // Processes
  processes: Process[];
  selectedProcess: Process | null;
  
  // Tasks
  myTasks: Task[];
  selectedTask: Task | null;
  
  // Doors
  doors: DoorInstance[];
  selectedDoor: DoorInstance | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setProcesses: (processes: Process[]) => void;
  setSelectedProcess: (process: Process | null) => void;
  setMyTasks: (tasks: Task[]) => void;
  setSelectedTask: (task: Task | null) => void;
  setDoors: (doors: DoorInstance[]) => void;
  setSelectedDoor: (door: DoorInstance | null) => void;
  setIsLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  isAuthenticated: false,
  processes: [],
  selectedProcess: null,
  myTasks: [],
  selectedTask: null,
  doors: [],
  selectedDoor: null,
  isLoading: false,
  error: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setProcesses: (processes) => set({ processes }),
  setSelectedProcess: (selectedProcess) => set({ selectedProcess }),
  setMyTasks: (myTasks) => set({ myTasks }),
  setSelectedTask: (selectedTask) => set({ selectedTask }),
  setDoors: (doors) => set({ doors }),
  setSelectedDoor: (selectedDoor) => set({ selectedDoor }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
