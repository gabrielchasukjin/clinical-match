'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function TrialSearchPage() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q');

  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const hasSearchedRef = useRef(false);

  // Contact modal state
  const [contactModal, setContactModal] = useState<{
    isOpen: boolean;
    organizerName: string;
    campaignUrl: string;
  }>({ isOpen: false, organizerName: '', campaignUrl: '' });
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });

  const executeSearch = useCallback(async (searchText: string) => {
    if (!searchText.trim()) return;

    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const response = await fetch('/api/trials/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialDescription: searchText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-populate and search when query parameter is present
  useEffect(() => {
    if (queryParam && queryParam.trim() && !hasSearchedRef.current) {
      hasSearchedRef.current = true;
      setDescription(queryParam);
      executeSearch(queryParam);
    }
  }, [queryParam, executeSearch]);

  async function handleSearch() {
    hasSearchedRef.current = true;
    executeSearch(description);
  }

  function openContactModal(organizerName: string, campaignUrl: string) {
    setContactModal({ isOpen: true, organizerName, campaignUrl });
    setContactForm({ name: '', email: '', message: '' });
  }

  function closeContactModal() {
    setContactModal({ isOpen: false, organizerName: '', campaignUrl: '' });
  }

  function handleSendMessage() {
    // Copy message to clipboard
    const fullMessage = `From: ${contactForm.name}\nEmail: ${contactForm.email}\n\nMessage:\n${contactForm.message}`;
    navigator.clipboard.writeText(fullMessage);

    // Open campaign page in new tab
    window.open(contactModal.campaignUrl, '_blank');

    // Show confirmation
    alert(
      'Message copied to clipboard! The campaign page will open in a new tab. Look for the "Contact" button on the campaign page and paste your message.',
    );
    closeContactModal();
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <div className="flex flex-col items-center justify-center px-4 pt-20 pb-8 md:pt-24">
        <h1 className="text-4xl font-bold mb-3">
          Clinical Trial Patient Matching
        </h1>
        <p className="text-muted-foreground text-center max-w-2xl">
          Find patients on crowdfunding platforms who match your trial criteria
        </p>
      </div>

      {/* Results Area */}
      <div className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll px-4 pb-4">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto w-full md:max-w-3xl"
            >
              <div className="border border-red-500 bg-red-50 dark:bg-red-950/50 p-6">
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">
                  Error
                </h3>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto w-full md:max-w-3xl"
            >
              <div className="border bg-card p-8">
                <div className="text-center">
                  <div className="text-2xl mb-4">🔍</div>
                  <p className="text-lg font-medium">
                    Searching crowdfunding platforms...
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This may take 10-30 seconds
                  </p>
                  <div className="mt-6 text-sm text-muted-foreground space-y-2">
                    <p className="flex items-center justify-center gap-2">
                      <span className="text-green-600">✓</span> Parsing your
                      criteria with AI...
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <span className="text-green-600">✓</span> Generating
                      optimized search queries...
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <span className="text-green-600">✓</span> Searching
                      GoFundMe, GiveSendGo, and other platforms...
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <span className="text-green-600">✓</span> Extracting
                      patient data...
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <span className="text-green-600">✓</span> Calculating
                      match scores...
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {results && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto w-full md:max-w-5xl space-y-6"
            >
              {/* Parsed Criteria */}
              <div className="border bg-card p-6">
                <h3 className="font-semibold mb-4 text-lg">Parsed Criteria</h3>
                <div className="bg-muted p-4">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {results.parsedCriteria.age && (
                      <div>
                        <dt className="font-medium mb-1">Age Range</dt>
                        <dd className="text-muted-foreground">
                          {results.parsedCriteria.age.min || '0'} -{' '}
                          {results.parsedCriteria.age.max || 'Any'}
                        </dd>
                      </div>
                    )}
                    {results.parsedCriteria.gender && (
                      <div>
                        <dt className="font-medium mb-1">Gender</dt>
                        <dd className="text-muted-foreground">
                          {results.parsedCriteria.gender.join(', ')}
                        </dd>
                      </div>
                    )}
                    {results.parsedCriteria.conditions && (
                      <div>
                        <dt className="font-medium mb-1">Conditions</dt>
                        <dd className="text-muted-foreground">
                          {results.parsedCriteria.conditions.join(', ')}
                        </dd>
                      </div>
                    )}
                    {results.parsedCriteria.location && (
                      <div>
                        <dt className="font-medium mb-1">Location</dt>
                        <dd className="text-muted-foreground">
                          {results.parsedCriteria.location}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Debug Info */}
              <div className="border bg-card p-6">
                <h3 className="font-semibold mb-4 text-lg">
                  Search Debug Info
                </h3>
                <div className="bg-muted p-4 space-y-3">
                  <div>
                    <dt className="font-medium mb-1 text-sm">
                      Search Queries Used
                    </dt>
                    <dd className="text-muted-foreground text-xs">
                      {results.searchQueries &&
                      results.searchQueries.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {results.searchQueries.map((q: string, i: number) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      ) : (
                        'No search queries generated'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium mb-1 text-sm">
                      Total Campaigns Found
                    </dt>
                    <dd className="text-muted-foreground text-xs">
                      {results.totalResults || 0} campaigns from Tavily
                    </dd>
                  </div>
                  {results.message && (
                    <div>
                      <dt className="font-medium mb-1 text-sm">Message</dt>
                      <dd className="text-muted-foreground text-xs">
                        {results.message}
                      </dd>
                    </div>
                  )}
                </div>
              </div>

              {/* Results Table */}
              <div className="border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold">
                    {results.matches.length > 0
                      ? `Found ${results.matches.length} Matching Patient${results.matches.length !== 1 ? 's' : ''}`
                      : 'No Matching Patients Found'}
                  </h2>
                  {results.totalResults > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Searched {results.totalResults} campaigns
                    </p>
                  )}
                </div>

                {results.matches.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground mb-2">
                      No patients found matching your criteria
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try broadening your search (remove location, widen age
                      range, or use different condition names)
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th className="text-left p-3 font-semibold">
                            Organizer
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Patient
                          </th>
                          <th className="text-left p-3 font-semibold">Age</th>
                          <th className="text-left p-3 font-semibold">
                            Gender
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Conditions
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Location
                          </th>
                          <th className="text-left p-3 font-semibold">Match</th>
                          <th className="text-left p-3 font-semibold">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.matches.map((match: any, idx: number) => (
                          <tr
                            key={idx}
                            className="border-b border-border hover:bg-muted/50 transition-colors"
                          >
                            <td className="p-3">
                              {match.patient.organizerName ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openContactModal(
                                      match.patient.organizerName ||
                                        'Organizer',
                                      match.patient.campaign_url,
                                    )
                                  }
                                  className="text-blue-600 hover:underline font-medium text-left"
                                >
                                  {match.patient.organizerName}
                                </button>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  Unknown
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {match.patient.name || (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1">
                                {match.patient.age || (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                                {match.criteriaBreakdown.age !== undefined && (
                                  <span
                                    className={
                                      match.criteriaBreakdown.age
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {match.criteriaBreakdown.age ? '✓' : '✗'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1">
                                {match.patient.gender &&
                                match.patient.gender !== 'unknown' ? (
                                  <span className="capitalize">
                                    {match.patient.gender}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                                {match.criteriaBreakdown.gender !==
                                  undefined && (
                                  <span
                                    className={
                                      match.criteriaBreakdown.gender
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {match.criteriaBreakdown.gender ? '✓' : '✗'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1">
                                <span className="max-w-xs truncate">
                                  {match.patient.conditions &&
                                  match.patient.conditions.length > 0 ? (
                                    match.patient.conditions.join(', ')
                                  ) : (
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                  )}
                                </span>
                                {match.criteriaBreakdown.conditions !==
                                  undefined && (
                                  <span
                                    className={
                                      match.criteriaBreakdown.conditions
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {match.criteriaBreakdown.conditions
                                      ? '✓'
                                      : '✗'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1">
                                {match.patient.location &&
                                match.patient.location.toLowerCase() !==
                                  'null' &&
                                match.patient.location.toLowerCase() !==
                                  'unknown' &&
                                match.patient.location !== '<UNKNOWN>' ? (
                                  match.patient.location
                                ) : (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                                {match.criteriaBreakdown.location !==
                                  undefined && (
                                  <span
                                    className={
                                      match.criteriaBreakdown.location
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {match.criteriaBreakdown.location
                                      ? '✓'
                                      : '✗'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`font-bold text-lg ${
                                  match.matchScore >= 80
                                    ? 'text-green-600'
                                    : match.matchScore >= 50
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                }`}
                              >
                                {match.matchScore}%
                              </span>
                            </td>
                            <td className="p-3">
                              <a
                                href={match.patient.campaign_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-medium"
                              >
                                View Campaign →
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contact Modal */}
      {contactModal.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeContactModal}
        >
          <div
            className="bg-background border rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Write {contactModal.organizerName} a message
              </h2>
              <button
                type="button"
                onClick={closeContactModal}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Organizer:{' '}
                <span className="font-medium text-foreground">
                  {contactModal.organizerName}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-sm font-medium mb-1"
                >
                  Your name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-sm font-medium mb-1"
                >
                  Your email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium mb-1"
                >
                  Your message
                </label>
                <Textarea
                  id="contact-message"
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, message: e.target.value })
                  }
                  className="w-full min-h-[120px]"
                  placeholder="I'm interested in learning more about your campaign..."
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={handleSendMessage}
                disabled={
                  !contactForm.name ||
                  !contactForm.email ||
                  !contactForm.message
                }
                className="flex-1"
              >
                Copy & Open Campaign
              </Button>
              <Button onClick={closeContactModal} variant="outline">
                Cancel
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Your message will be copied to clipboard. The campaign page will
              open where you can paste it in the contact form.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
