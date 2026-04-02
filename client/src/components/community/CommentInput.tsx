import { memo, useState } from 'react';
import { useCreateComment } from '../../hooks/useComments';
import { useAuthStore } from '../../store/authStore';

interface CommentInputProps {
  sightingId: string;
}

function CommentInput({ sightingId }: CommentInputProps) {
  const [text, setText] = useState('');
  const { mutate: createComment, isPending } = useCreateComment();
  const user = useAuthStore((s) => s.user);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isPending) return;

    createComment(
      { sightingId, text: text.trim() },
      {
        onSuccess: () => setText(''),
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!user) {
    return (
      <div className="p-3 bg-bg-secondary/50 rounded-lg text-center">
        <p className="text-text-secondary text-sm">
          <a href="/login" className="text-accent-blue hover:underline">
            Sign in
          </a>{' '}
          to leave a comment
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 200))}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        maxLength={200}
        disabled={isPending}
        className="flex-1 px-3 py-2 bg-bg-secondary border border-border-glow rounded-lg text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-blue disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!text.trim() || isPending}
        className="px-4 py-2 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue text-sm font-medium hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? '...' : 'Post'}
      </button>
    </form>
  );
}

export default memo(CommentInput);
