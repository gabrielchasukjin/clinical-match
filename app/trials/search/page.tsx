'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function TrialSearchPage() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!description.trim()) return;

    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const response = await fetch('/api/trials/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialDescription: description }),
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
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Clinical Trial Patient Matching</h1>
        <p className="text-muted-foreground">
          Find patients on crowdfunding platforms who match your trial criteria
        </p>
      </div>

      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Enter Trial Criteria</h2>
        <Textarea
          placeholder="Example: Looking for female patients over 50 with Type 2 Diabetes in Boston area..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="mb-4 text-base"
        />
        <Button
          onClick={handleSearch}
          disabled={loading || !description.trim()}
          className="w-full text-base py-6"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Searching... (10-30 seconds)
            </span>
          ) : (
            'Search for Matching Patients'
          )}
        </Button>
      </Card>

      {error && (
        <Card className="p-6 mb-4 border-red-500 bg-red-50">
          <h3 className="font-semibold text-red-900 mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {loading && (
        <Card className="p-8">
          <div className="text-center">
            <div className="text-2xl mb-4">🔍</div>
            <p className="text-lg font-medium">Searching crowdfunding platforms...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take 10-30 seconds
            </p>
            <div className="mt-4 text-sm text-muted-foreground space-y-1">
              <p>✓ Parsing your criteria with AI...</p>
              <p>✓ Generating optimized search queries...</p>
              <p>✓ Searching GoFundMe, GiveSendGo, and other platforms...</p>
              <p>✓ Extracting patient data...</p>
              <p>✓ Calculating match scores...</p>
            </div>
          </div>
        </Card>
      )}

      {results && !loading && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Parsed Criteria:</h3>
            <div className="bg-muted p-4 rounded-lg overflow-auto">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {results.parsedCriteria.age && (
                  <div>
                    <dt className="font-medium">Age Range:</dt>
                    <dd className="text-muted-foreground">
                      {results.parsedCriteria.age.min || '0'} -{' '}
                      {results.parsedCriteria.age.max || 'Any'}
                    </dd>
                  </div>
                )}
                {results.parsedCriteria.gender && (
                  <div>
                    <dt className="font-medium">Gender:</dt>
                    <dd className="text-muted-foreground">
                      {results.parsedCriteria.gender.join(', ')}
                    </dd>
                  </div>
                )}
                {results.parsedCriteria.conditions && (
                  <div>
                    <dt className="font-medium">Conditions:</dt>
                    <dd className="text-muted-foreground">
                      {results.parsedCriteria.conditions.join(', ')}
                    </dd>
                  </div>
                )}
                {results.parsedCriteria.location && (
                  <div>
                    <dt className="font-medium">Location:</dt>
                    <dd className="text-muted-foreground">
                      {results.parsedCriteria.location}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Card>

          <Card className="p-6">
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
                  Try broadening your search (remove location, widen age range, or use different
                  condition names)
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Age</th>
                      <th className="text-left p-3 font-semibold">Gender</th>
                      <th className="text-left p-3 font-semibold">Conditions</th>
                      <th className="text-left p-3 font-semibold">Location</th>
                      <th className="text-left p-3 font-semibold">Match</th>
                      <th className="text-left p-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.matches.map((match: any, idx: number) => (
                      <tr
                        key={idx}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">{match.patient.name || 'Unknown'}</td>
                        <td className="p-3">
                          <span className="flex items-center gap-1">
                            {match.patient.age || '-'}
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
                            {match.patient.gender || '-'}
                            {match.criteriaBreakdown.gender !== undefined && (
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
                              {match.patient.conditions?.join(', ') || '-'}
                            </span>
                            {match.criteriaBreakdown.conditions !== undefined && (
                              <span
                                className={
                                  match.criteriaBreakdown.conditions
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }
                              >
                                {match.criteriaBreakdown.conditions ? '✓' : '✗'}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="flex items-center gap-1">
                            {match.patient.location || '-'}
                            {match.criteriaBreakdown.location !== undefined && (
                              <span
                                className={
                                  match.criteriaBreakdown.location
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }
                              >
                                {match.criteriaBreakdown.location ? '✓' : '✗'}
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
          </Card>
        </div>
      )}
    </div>
  );
}
