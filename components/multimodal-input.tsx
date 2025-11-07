'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { useRouter } from 'next/navigation';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  selectedVisibilityType: VisibilityType;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      // Filter out placeholder text from localStorage
      const storedValue = localStorageInput === 'your-secure-password-here' ? '' : localStorageInput;
      const finalValue = domValue || storedValue || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  // Helper function to detect if text looks like a research paper
  const looksLikeResearchPaper = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    const keywords = [
      'inclusion criteria',
      'exclusion criteria',
      'eligibility criteria',
      'study population',
      'participants',
      'clinical trial',
      'recruitment',
      'enrolled',
    ];
    
    // Check if text is long enough and contains research paper keywords
    return text.length > 200 && keywords.some(keyword => lowerText.includes(keyword));
  };

  const submitForm = useCallback(async () => {
    // Check if this looks like a research paper submission
    const hasImage = attachments.some(att => att.contentType?.startsWith('image/'));
    const hasPDF = attachments.some(att => att.contentType === 'application/pdf');
    const isPaper = looksLikeResearchPaper(input);
    
    // PDF uploads are now supported!
    
    // If user uploaded an image/PDF (even without text) or pasted research paper text, extract criteria
    if (messages.length === 0 && (hasImage || hasPDF || isPaper)) {
      try {
        toast.info('Extracting patient criteria from research paper...');
        
        const formData = new FormData();
        
        if (input.trim()) {
          formData.append('text', input.trim());
        }
        
        // If there's an image attachment, fetch it and add to formData
        if (hasImage) {
          const imageAttachment = attachments.find(att => att.contentType?.startsWith('image/'));
          if (imageAttachment) {
            try {
              // Fetch the blob from the local URL
              const response = await fetch(imageAttachment.url);
              if (!response.ok) {
                throw new Error('Failed to fetch image blob');
              }
              const blob = await response.blob();
              formData.append('image', blob, imageAttachment.name);
            } catch (fetchError) {
              console.error('Failed to fetch image:', fetchError);
              toast.error('Failed to process uploaded image. Please try again.');
              return;
            }
          }
        }
        
        // If there's a PDF attachment, fetch it and add to formData
        if (hasPDF) {
          const pdfAttachment = attachments.find(att => att.contentType === 'application/pdf');
          if (pdfAttachment) {
            try {
              // Fetch the blob from the local URL
              const response = await fetch(pdfAttachment.url);
              if (!response.ok) {
                throw new Error('Failed to fetch PDF blob');
              }
              const blob = await response.blob();
              formData.append('pdf', blob, pdfAttachment.name);
            } catch (fetchError) {
              console.error('Failed to fetch PDF:', fetchError);
              toast.error('Failed to process uploaded PDF. Please try again.');
              return;
            }
          }
        }
        
        const extractResponse = await fetch('/api/trials/extract-from-paper', {
          method: 'POST',
          body: formData,
        });
        
        if (!extractResponse.ok) {
          let errorMessage = 'Failed to extract criteria from paper';
          try {
            const errorData = await extractResponse.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            console.error('Extract API error:', errorData);
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
          }
          throw new Error(errorMessage);
        }
        
        const { criteria } = await extractResponse.json();
        console.log('Extracted criteria:', criteria);
        
        // Build search query from extracted criteria
        const parts: string[] = [];
        if (criteria.conditions && criteria.conditions.length > 0) {
          parts.push(`patients with ${criteria.conditions.join(', ')}`);
        }
        if (criteria.gender && criteria.gender.length > 0) {
          parts.push(criteria.gender.join(' or '));
        }
        if (criteria.age) {
          if (criteria.age.min && criteria.age.max) {
            parts.push(`aged ${criteria.age.min}-${criteria.age.max}`);
          } else if (criteria.age.min) {
            parts.push(`aged ${criteria.age.min}+`);
          }
        }
        // Only add location if it's valid and not a placeholder
        if (criteria.location && criteria.location.trim() && !criteria.location.includes('<')) {
          parts.push(`in ${criteria.location}`);
        }
        
        const searchQuery = parts.join(', ');
        
        // Clear attachments and input before redirecting
        setAttachments([]);
        setInput('');
        
        toast.success('Criteria extracted! Searching for matching patients...');
        router.push(`/trials/search?q=${encodeURIComponent(searchQuery)}`);
        return;
      } catch (error: any) {
        console.error('Extract criteria error:', error);
        toast.error(error.message || 'Failed to extract criteria. Using text as search query.');
        // Fall through to regular search if there's text
        if (!input.trim()) {
          return;
        }
      }
    }
    
    // If this is a new chat (no messages), redirect to trial search page
    if (messages.length === 0 && input.trim()) {
      router.push(`/trials/search?q=${encodeURIComponent(input.trim())}`);
      return;
    }

    window.history.replaceState({}, '', `/chat/${chatId}`);

    sendMessage({
      role: 'user',
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: 'text',
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    messages,
    router,
  ]);

  const uploadFile = async (file: File) => {
    // For images and PDFs (research papers), create a local blob URL instead of uploading to Vercel Blob
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      try {
        const blobUrl = URL.createObjectURL(file);
        return {
          url: blobUrl,
          name: file.name,
          contentType: file.type,
        };
      } catch (error) {
        console.error('Failed to create blob URL:', error);
        toast.error('Failed to process file');
        return undefined;
      }
    }

    // For other files, try to upload to Vercel Blob
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      // Show info for PDF files
      const hasPDF = files.some(file => file.type === 'application/pdf');
      if (hasPDF) {
        toast.success('PDF uploaded! Text will be automatically extracted.', {
          duration: 3000,
        });
      }

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // Drag and drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // Show info for PDF files
      const hasPDF = files.some(file => file.type === 'application/pdf');
      if (hasPDF) {
        toast.success('PDF uploaded! Text will be automatically extracted.', {
          duration: 3000,
        });
      }

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            setInput={setInput}
          />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <div 
        className={cx(
          "relative bg-white rounded-2xl shadow-lg border-2 transition-colors",
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-blue-100 bg-opacity-50 rounded-2xl flex items-center justify-center z-10 pointer-events-none">
            <div className="text-blue-600 font-medium text-lg">
              📎 Drop your research paper image or PDF here (text will be auto-extracted)
            </div>
          </div>
        )}
        <Textarea
          data-testid="multimodal-input"
          ref={textareaRef}
          placeholder="Paste research paper abstract, or drop an image/PDF (text will be auto-extracted)..."
          value={input}
          onChange={handleInput}
          className={cx(
            'min-h-[60px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-t-2xl !text-base bg-transparent border-0 focus:ring-0 focus:outline-none px-4 pt-4 pb-2',
            className,
          )}
          rows={1}
          autoFocus
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();

              if (status !== 'ready') {
                toast.error('Please wait for the model to finish its response!');
              } else {
                submitForm();
              }
            }
          }}
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              data-testid="search-button"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                if (status === 'ready' && (input.trim() || attachments.length > 0)) {
                  submitForm();
                }
              }}
              disabled={status !== 'ready' || (!input.trim() && attachments.length === 0)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg h-9 text-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              Search
            </button>
            <AttachmentsButton fileInputRef={fileInputRef} status={status} />
          </div>

          <div>
            {status === 'submitted' ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <SendButton
                input={input}
                submitForm={submitForm}
                uploadQueue={uploadQueue}
                attachments={attachments}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
}) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-lg px-3 py-2 h-9 text-sm text-gray-600 hover:bg-gray-100 border-0"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <PaperclipIcon size={16} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-lg p-2 h-9 w-9 bg-red-500 hover:bg-red-600 text-white border-0"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={16} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  attachments,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachments: Array<Attachment>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-lg p-2 h-9 w-9 bg-gray-100 hover:bg-gray-200 border-0"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={(input.length === 0 && attachments.length === 0) || uploadQueue.length > 0}
      variant="ghost"
    >
      <ArrowUpIcon size={16} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.attachments.length !== nextProps.attachments.length) return false;
  return true;
});
