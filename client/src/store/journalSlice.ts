import { create } from 'zustand';

interface JournalModalState {
  isOpen: boolean;
  satelliteName: string;
  passTimestamp: string;
  
  openModal: (satelliteName: string, passTimestamp: string) => void;
  closeModal: () => void;
}

export const useJournalModalStore = create<JournalModalState>((set) => ({
  isOpen: false,
  satelliteName: '',
  passTimestamp: '',

  openModal: (satelliteName, passTimestamp) =>
    set({ isOpen: true, satelliteName, passTimestamp }),

  closeModal: () =>
    set({ isOpen: false, satelliteName: '', passTimestamp: '' }),
}));
