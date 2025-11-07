'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import { useRouter } from 'next/navigation';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { ChatMessage } from '@/lib/types';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const router = useRouter();

  const suggestedActions = [
    {
      title: '',
      label: 'Patients with Type 2 Diabetes in Boston',
      action: 'Find patients with Type 2 Diabetes in Boston',
    },
    {
      title: '',
      label: 'Patients with heart disease in California',
      action: 'Find patients with heart disease in California',
    },
    {
      title: '',
      label: 'Stage 2 Cancer patients in New York',
      action: 'Find Stage 2 Cancer patients in New York',
    },
    {
      title: '',
      label: 'Patients with mental health in New York',
      action: 'Find patients with mental health issues in New York',
    },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-3 w-full max-w-4xl mx-auto"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className="block"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              router.push(`/trials/search?q=${encodeURIComponent(suggestedAction.action)}`);
            }}
            className="text-left border border-gray-200 rounded-lg px-5 py-4 text-base w-full h-auto justify-start items-start hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
          >
            <span className="text-gray-700">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
