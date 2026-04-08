import { memo } from 'react';
import { useJournalModalStore } from '../../store/journalSlice';
import JournalEntryModal from './JournalEntryModal';

function JournalEntryModalWrapper() {
  const { isOpen, satelliteName, passTimestamp, closeModal } = useJournalModalStore();

  return (
    <JournalEntryModal
      isOpen={isOpen}
      onClose={closeModal}
      satelliteName={satelliteName}
      passTimestamp={passTimestamp}
    />
  );
}

export default memo(JournalEntryModalWrapper);
