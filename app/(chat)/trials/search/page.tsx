'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Component to display conditions with matching conditions first and expand/collapse functionality
function ConditionsCell({
  conditions,
  requestedConditions,
  hasMatch
}: {
  conditions: string[];
  requestedConditions: string[];
  hasMatch?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!conditions || conditions.length === 0) {
    return <span>-</span>;
  }

  // Sort conditions: matching ones first, then others
  const sortedConditions = [...conditions].sort((a, b) => {
    const aMatches = requestedConditions.some(req =>
      a.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(a.toLowerCase())
    );
    const bMatches = requestedConditions.some(req =>
      b.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(b.toLowerCase())
    );

    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return 0;
  });

  const displayLimit = 2;
  const hasMore = sortedConditions.length > displayLimit;
  const displayConditions = isExpanded ? sortedConditions : sortedConditions.slice(0, displayLimit);

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        {displayConditions.map((condition, idx) => {
          const isMatching = requestedConditions.some(req =>
            condition.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(condition.toLowerCase())
          );

          return (
            <div key={idx} className="flex items-center gap-1 mb-1">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs ${
                  isMatching
                    ? 'bg-blue-100 text-blue-800 font-semibold'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {condition}
              </span>
            </div>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
          >
            {isExpanded ? '- Show less' : `+ ${sortedConditions.length - displayLimit} more`}
          </button>
        )}
      </div>
      {hasMatch !== undefined && (
        <span className={hasMatch ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>
          {hasMatch ? '✓' : '✗'}
        </span>
      )}
    </div>
  );
}

export default function TrialSearchPage() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q');
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'age'>('match');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterMatch, setFilterMatch] = useState<'all' | 'high' | 'low'>('all');
  const hasSearchedRef = useRef(false);

  // Progress tracking state (from master)
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressStep, setProgressStep] = useState(0);
  const [extractingProgress, setExtractingProgress] = useState<{current: number, total: number} | null>(null);
  const [streamingResults, setStreamingResults] = useState<any[]>([]);
  const [parsedCriteria, setParsedCriteria] = useState<any>(null);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);

  const executeSearch = useCallback(async (searchText: string) => {
    if (!searchText.trim()) return;

    setLoading(true);
    setResults(null);
    setError(null);
    setProgressStatus('Starting search...');
    setProgressStep(0);
    setExtractingProgress(null);
    setStreamingResults([]);
    setSearchQueries([]);
    setParsedCriteria(null);

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

      // Handle Server-Sent Events stream (master's SSE format)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'status') {
              setProgressStatus(data.message);
              setProgressStep(data.step);
            } else if (data.type === 'criteria') {
              setParsedCriteria(data.data);
            } else if (data.type === 'queries') {
              setSearchQueries(data.data);
            } else if (data.type === 'extracting') {
              setExtractingProgress({ current: data.current, total: data.total });
              setProgressStatus(`Extracting patient data (${data.current}/${data.total}): ${data.url}`);
            } else if (data.type === 'patient_extracted') {
              // Add the newly extracted patient to streaming results
              setStreamingResults((prev) => [...prev, data.data]);
            } else if (data.type === 'complete') {
              setResults(data.data);
              setLoading(false);
            } else if (data.type === 'error') {
              setError(data.message);
              setLoading(false);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed. Please try again.');
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

  // Filter and sort matches (from michelle + streaming support)
  const getFilteredAndSortedMatches = () => {
    const matches = results?.matches || [];
    let filtered = [...matches];

    // Apply filter
    if (filterMatch === 'high') {
      filtered = filtered.filter((match: any) => match.matchScore >= 50);
    } else if (filterMatch === 'low') {
      filtered = filtered.filter((match: any) => match.matchScore < 50);
    }

    // Apply sort
    filtered.sort((a: any, b: any) => {
      if (sortBy === 'match') {
        return sortOrder === 'desc'
          ? b.matchScore - a.matchScore
          : a.matchScore - b.matchScore;
      } else if (sortBy === 'name') {
        const nameA = (a.patient.name || 'Unknown').toLowerCase();
        const nameB = (b.patient.name || 'Unknown').toLowerCase();
        return sortOrder === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      } else if (sortBy === 'age') {
        const ageA = a.patient.age || 0;
        const ageB = b.patient.age || 0;
        return sortOrder === 'asc'
          ? ageA - ageB
          : ageB - ageA;
      }
      return 0;
    });

    return filtered;
  };

  function exportToExcel() {
    const filteredMatches = getFilteredAndSortedMatches();
    if (filteredMatches.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const headers = ['#', 'Name', 'Age', 'Gender', 'Conditions', 'Location', 'Organizer', 'Match Score', 'URL'];
    const csvContent = [
      headers.join(','),
      ...filteredMatches.map((match: any, idx: number) => {
        return [
          idx + 1,
          `"${(match.patient.name || 'Unknown').replace(/"/g, '""')}"`,
          match.patient.age || '-',
          match.patient.gender || '-',
          `"${(match.patient.conditions?.join(', ') || '-').replace(/"/g, '""')}"`,
          `"${(match.patient.location || '-').replace(/"/g, '""')}"`,
          `"${(match.patient.organizerName || '-').replace(/"/g, '""')}"`,
          match.matchScore,
          `"${match.patient.campaign_url || ''}"`,
        ].join(',');
      }),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `patient_matches_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Main Content Area - Left Side */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden max-h-screen">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 19-7-7 7-7"/>
                  <path d="M19 12H5"/>
                </svg>
                Home
              </button>
              <h1 className="text-lg font-semibold">
                {description || 'Search Results'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-sm text-gray-600 hover:text-gray-900">Share</button>
              <button
                onClick={exportToExcel}
                disabled={!results || !results.matches || results.matches.length === 0}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Action Bar with Filter/Sort */}
        {results && !loading && (
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Filter Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter {filterMatch !== 'all' && <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5">1</span>}
                </button>
                <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[160px]">
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-700 px-2 py-1">Match Score</p>
                    <button
                      onClick={() => setFilterMatch('all')}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${filterMatch === 'all' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterMatch('high')}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${filterMatch === 'high' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      High Only (50%+)
                    </button>
                    <button
                      onClick={() => setFilterMatch('low')}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${filterMatch === 'low' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Low Only (&lt;50%)
                    </button>
                  </div>
                </div>
              </div>

              {/* Sort Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Sort
                </button>
                <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[180px]">
                  <div className="p-2">
                    <button
                      onClick={() => { setSortBy('match'); setSortOrder('desc'); }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${sortBy === 'match' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Match: High to Low
                    </button>
                    <button
                      onClick={() => { setSortBy('match'); setSortOrder('asc'); }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${sortBy === 'match' && sortOrder === 'asc' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Match: Low to High
                    </button>
                    <button
                      onClick={() => { setSortBy('name'); setSortOrder('asc'); }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${sortBy === 'name' && sortOrder === 'asc' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Name: A to Z
                    </button>
                    <button
                      onClick={() => { setSortBy('name'); setSortOrder('desc'); }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${sortBy === 'name' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Name: Z to A
                    </button>
                    <button
                      onClick={() => { setSortBy('age'); setSortOrder('asc'); }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${sortBy === 'age' && sortOrder === 'asc' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Age: Low to High
                    </button>
                    <button
                      onClick={() => { setSortBy('age'); setSortOrder('desc'); }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${sortBy === 'age' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Age: High to Low
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1" />
              <span className="text-sm text-gray-600">
                {getFilteredAndSortedMatches().length} of {results.matches.length} matches · {results.totalResults || 0} analyzed
              </span>
            </div>
          </div>
        )}

        {/* Results Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 max-h-full">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <div className="border border-red-500 bg-red-50 dark:bg-red-950/50 p-6 rounded-lg">
                  <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">Error</h3>
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
                className="w-full max-w-2xl mx-auto"
              >
                <div className="bg-white border border-gray-200 p-8 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl mb-4">🔍</div>
                    <p className="text-lg font-medium mb-2">
                      {progressStatus || 'Searching crowdfunding platforms...'}
                    </p>

                    {/* Step progress indicators (from master) */}
                    <div className="mt-6 flex justify-center gap-3">
                      {[
                        { num: 1, label: 'Parse' },
                        { num: 2, label: 'Query' },
                        { num: 3, label: 'Search' },
                        { num: 4, label: 'Extract' },
                        { num: 5, label: 'Match' },
                      ].map((step) => (
                        <div key={step.num} className="flex flex-col items-center">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                              step.num < progressStep
                                ? 'bg-green-600 text-white'
                                : step.num === progressStep
                                  ? 'bg-blue-600 text-white animate-pulse'
                                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {step.num < progressStep ? '✓' : step.num}
                          </div>
                          <span className="text-xs mt-1 text-gray-600">
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Campaign extraction progress bar (from master) */}
                    {extractingProgress && (
                      <div className="mt-8">
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-blue-600 h-3 transition-all duration-300 ease-out"
                            style={{
                              width: `${(extractingProgress.current / extractingProgress.total) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-sm text-gray-600 mt-3">
                          Processing campaign {extractingProgress.current} of{' '}
                          {extractingProgress.total}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-6">
                      This may take 10-30 seconds
                    </p>
                  </div>

                  {/* Show streaming results as they arrive (from master) */}
                  {streamingResults.length > 0 && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                        Found {streamingResults.length} patients so far...
                      </h3>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {streamingResults.slice(-5).map((match, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-sm p-2 bg-green-50 border-l-2 border-green-500 rounded"
                          >
                            <span className="font-medium">{match.patient.name || 'Anonymous'}</span>
                            <span className="text-gray-600 ml-2">({match.matchScore}% match)</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {results && !loading && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                {/* Results Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {getFilteredAndSortedMatches().length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <p className="text-lg text-gray-600 mb-2">
                        No patients found matching your criteria
                      </p>
                      <p className="text-sm text-gray-500">
                        Try broadening your search or adjusting filters
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-12">#</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Name</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Age</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Gender</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Conditions</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Location</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Organizer</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">Match</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700">URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredAndSortedMatches().map((match: any, idx: number) => (
                            <tr
                              key={idx}
                              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {match.patient.campaign_url?.includes('gofundme.com') ? (
                                  <a
                                    href={`${match.patient.campaign_url}?modal=contact`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 hover:underline"
                                  >
                                    {match.patient.name || 'Unknown'}
                                  </a>
                                ) : (
                                  <span>{match.patient.name || 'Unknown'}</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  {match.patient.age || '-'}
                                  {match.criteriaBreakdown?.age !== undefined && (
                                    <span className={match.criteriaBreakdown.age ? 'text-green-600' : 'text-red-600'}>
                                      {match.criteriaBreakdown.age ? '✓' : '✗'}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  {match.patient.gender || '-'}
                                  {match.criteriaBreakdown?.gender !== undefined && (
                                    <span className={match.criteriaBreakdown.gender ? 'text-green-600' : 'text-red-600'}>
                                      {match.criteriaBreakdown.gender ? '✓' : '✗'}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <ConditionsCell
                                  conditions={match.patient.conditions || []}
                                  requestedConditions={parsedCriteria?.conditions || []}
                                  hasMatch={match.criteriaBreakdown?.conditions}
                                />
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  {match.patient.location || '-'}
                                  {match.criteriaBreakdown?.location !== undefined && (
                                    <span className={match.criteriaBreakdown.location ? 'text-green-600' : 'text-red-600'}>
                                      {match.criteriaBreakdown.location ? '✓' : '✗'}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {match.patient.organizerName || '-'}
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {match.matchScore}%
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <a
                                  href={match.patient.campaign_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  View →
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
      </div>

      {/* Right Sidebar - Search Panel */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden max-h-screen">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <button className="text-sm text-gray-600 hover:text-gray-900">Feedback</button>
            <div className="flex items-center gap-2">
              <button className="text-sm text-gray-600 hover:text-gray-900">Credits</button>
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2 border-b border-gray-200">
            <button className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
              Search
            </button>
            <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Details
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Criteria Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Criteria</h3>
              <select className="text-xs border border-gray-200 rounded px-2 py-1">
                <option>Patients</option>
              </select>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., patients with Type 2 Diabetes in Boston"
              className="mb-3 min-h-[80px] text-sm"
            />

            {(parsedCriteria || results?.parsedCriteria) && (
              <div className="space-y-2 mb-3">
                {(parsedCriteria?.conditions || results?.parsedCriteria?.conditions) && (
                  <div className="flex items-start gap-2 p-2 bg-purple-50 border-l-2 border-purple-500 rounded text-xs">
                    <span className="text-gray-700">
                      Conditions: {(parsedCriteria?.conditions || results?.parsedCriteria?.conditions).join(', ')}
                    </span>
                  </div>
                )}
                {(parsedCriteria?.location || results?.parsedCriteria?.location) && (
                  <div className="flex items-start gap-2 p-2 bg-orange-50 border-l-2 border-orange-500 rounded text-xs">
                    <span className="text-gray-700">
                      Location: {parsedCriteria?.location || results?.parsedCriteria?.location}
                    </span>
                  </div>
                )}
                {(parsedCriteria?.age || results?.parsedCriteria?.age) && (
                  <div className="flex items-start gap-2 p-2 bg-blue-50 border-l-2 border-blue-500 rounded text-xs">
                    <span className="text-gray-700">
                      Age: {(parsedCriteria?.age || results?.parsedCriteria?.age).min || '0'} - {(parsedCriteria?.age || results?.parsedCriteria?.age).max || 'Any'}
                    </span>
                  </div>
                )}
                {(parsedCriteria?.gender || results?.parsedCriteria?.gender) && (
                  <div className="flex items-start gap-2 p-2 bg-pink-50 border-l-2 border-pink-500 rounded text-xs">
                    <span className="text-gray-700">
                      Gender: {(parsedCriteria?.gender || results?.parsedCriteria?.gender).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleSearch}
              disabled={loading || !description.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Results Summary */}
          {(loading || results) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {loading ? 'Searching...' : 'Results'}
              </h3>
              <div className="space-y-2 text-sm">
                {results && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matches:</span>
                      <span className="font-medium">{results.matches?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Analyzed:</span>
                      <span className="font-medium">{results.totalResults || 0}</span>
                    </div>
                  </>
                )}

                {/* Show search queries */}
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Search queries:</p>
                  {loading && searchQueries.length === 0 ? (
                    <div className="text-xs text-gray-600 pl-2 border-l-2 border-blue-500 bg-blue-50 p-2 rounded">
                      <p className="animate-pulse">Generating optimized queries...</p>
                    </div>
                  ) : (searchQueries.length > 0 || results?.searchQueries?.length > 0) ? (
                    <ul className="space-y-1">
                      {(searchQueries.length > 0 ? searchQueries : results?.searchQueries || []).map((q: string, i: number) => (
                        <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
                          {q}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No queries generated</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
