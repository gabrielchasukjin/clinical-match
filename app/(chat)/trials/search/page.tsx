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
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [parsedCriteria, setParsedCriteria] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'age'>('match');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterMatch, setFilterMatch] = useState<'all' | 'high' | 'low'>('all');
  const hasSearchedRef = useRef(false);

  const executeSearch = useCallback(async (searchText: string) => {
    if (!searchText.trim()) return;

    setLoading(true);
    setResults(null);
    setSearchQueries([]);
    setParsedCriteria(null);
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

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Add new chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split by newlines
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const message = JSON.parse(line);
            
            if (message.type === 'queries') {
              // Update search queries immediately
              setSearchQueries(message.data.searchQueries);
              setParsedCriteria(message.data.parsedCriteria);
            } else if (message.type === 'complete') {
              // Final results
              setResults(message.data);
            } else if (message.type === 'error') {
              throw new Error(message.data.error);
            }
          } catch (parseError) {
            console.error('Failed to parse message:', line, parseError);
          }
        }
      }
      
      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const message = JSON.parse(buffer);
          if (message.type === 'complete') {
            setResults(message.data);
          }
        } catch (parseError) {
          console.error('Failed to parse final message:', parseError);
        }
      }
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

  // Filter and sort matches
  const getFilteredAndSortedMatches = () => {
    if (!results?.matches) return [];

    let filtered = [...results.matches];

    // Apply filter
    if (filterMatch === 'high') {
      filtered = filtered.filter((match: any) => match.matchScore >= 30);
    } else if (filterMatch === 'low') {
      filtered = filtered.filter((match: any) => match.matchScore < 30);
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
    const headers = ['#', 'Name', 'Age', 'Gender', 'Conditions', 'Location', 'Match', 'URL'];
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
          match.matchScore >= 30 ? 'High' : 'Low',
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
            <div className="flex items-center gap-2">
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

        {/* Action Bar */}
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
                      High Only
                    </button>
                    <button
                      onClick={() => setFilterMatch('low')}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50 ${filterMatch === 'low' ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      Low Only
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
                  <div className="text-center mb-6">
                    <div className="text-2xl mb-4">🔍</div>
                    <p className="text-lg font-medium">Searching crowdfunding platforms...</p>
                    <p className="text-sm text-gray-600 mt-2">
                      This may take 10-30 seconds
                    </p>
                  </div>
                  
                  {/* Search Queries Section */}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Search Queries</h3>
                    {searchQueries.length === 0 ? (
                      <div className="text-sm text-gray-600 pl-3 border-l-2 border-blue-500 bg-blue-50 p-3 rounded">
                        <p className="animate-pulse">Generating optimized queries...</p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {searchQueries.map((q: string, i: number) => (
                          <motion.li 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="text-sm text-gray-700 pl-3 border-l-2 border-green-500 bg-green-50 p-3 rounded flex items-start gap-2"
                          >
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{q}</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}
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
                        Try broadening your search (remove location, widen age range, or use different condition names)
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-12">#</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-24">Name</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-16">Age</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-20">Gender</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-48">Conditions</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-24">Location</th>
                            <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 w-20">Match</th>
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
                                {match.patient.name || 'Unknown'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  {match.patient.age || '-'}
                                  {match.criteriaBreakdown.age !== undefined && (
                                    <span className={match.criteriaBreakdown.age ? 'text-green-600' : 'text-red-600'}>
                                      {match.criteriaBreakdown.age ? '✓' : '✗'}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  {match.patient.gender || '-'}
                                  {match.criteriaBreakdown.gender !== undefined && (
                                    <span className={match.criteriaBreakdown.gender ? 'text-green-600' : 'text-red-600'}>
                                      {match.criteriaBreakdown.gender ? '✓' : '✗'}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <span className="max-w-xs truncate">
                                    {match.patient.conditions?.join(', ') || '-'}
                                  </span>
                                  {match.criteriaBreakdown.conditions !== undefined && (
                                    <span className={match.criteriaBreakdown.conditions ? 'text-green-600' : 'text-red-600'}>
                                      {match.criteriaBreakdown.conditions ? '✓' : '✗'}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  {match.patient.location || '-'}
                                  {(!match.patient.location || match.patient.location === '-') && (
                                    <span className="text-red-600">
                                      ✗
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                                    match.matchScore >= 30
                                      ? 'bg-green-100 text-green-700 border border-green-300'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                  }`}
                                >
                                  {match.matchScore >= 30 ? 'High' : 'Low'}
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

          {/* Search Queries - Show during loading and after results */}
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
                      <span className="font-medium">{results.matches.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Analyzed:</span>
                      <span className="font-medium">{results.totalResults || 0}</span>
                    </div>
                  </>
                )}
                
                {/* Show search queries during loading and after results */}
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
