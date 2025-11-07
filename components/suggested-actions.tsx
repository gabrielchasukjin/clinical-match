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
      label: 'Stage 4 lung cancer patients in Boston',
      action: 'Find Stage 4 lung cancer patients in Boston',
    },
    {
      title: '',
      label: 'Type 2 Diabetes patients age 18-70 in California',
      action: 'Find Type 2 Diabetes patients age 18-70 in California',
    },
    {
      title: '',
      label: 'Heart failure patients in New York',
      action: 'Find heart failure patients in New York',
    },
    {
      title: '',
      label: 'Rheumatoid arthritis patients in Texas',
      action: 'Find rheumatoid arthritis patients in Texas',
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
