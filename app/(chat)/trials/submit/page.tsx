'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type InputMethod = 'text' | 'image' | 'pdf';

export default function SubmitResearchPaperPage() {
  const router = useRouter();
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [abstractText, setAbstractText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedCriteria, setExtractedCriteria] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!abstractText && !selectedFile) {
      setError('텍스트를 입력하거나 파일을 업로드해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedCriteria(null);

    try {
      // Step 1: Extract criteria from paper
      const formData = new FormData();
      if (abstractText) {
        formData.append('text', abstractText);
      }
      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      const extractResponse = await fetch('/api/trials/extract-from-paper', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.error || '기준 추출 실패');
      }

      const { criteria } = await extractResponse.json();
      setExtractedCriteria(criteria);

      // Step 2: Navigate to search page with the extracted criteria
      // Convert criteria to a natural language description for the search
      const criteriaDescription = buildCriteriaDescription(criteria);
      router.push(`/trials/search?q=${encodeURIComponent(criteriaDescription)}`);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || '제출 실패. 다시 시도해주세요.');
      setLoading(false);
    }
  };

  const buildCriteriaDescription = (criteria: any): string => {
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
      } else if (criteria.age.max) {
        parts.push(`aged under ${criteria.age.max}`);
      }
    }

    if (criteria.location) {
      parts.push(`in ${criteria.location}`);
    }

    return parts.join(', ');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
                뒤로가기
              </button>
              <h1 className="text-lg font-semibold">연구 논문 제출</h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 border border-red-500 bg-red-50 p-4 rounded-lg"
                >
                  <p className="text-red-700">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Method Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">
                논문을 어떻게 제출하시겠습니까?
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    inputMethod === 'text'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">📝</div>
                  <div className="font-medium">텍스트 붙여넣기</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Abstract 복사 & 붙여넣기
                  </div>
                </button>

                <button
                  onClick={() => setInputMethod('image')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    inputMethod === 'image'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">📸</div>
                  <div className="font-medium">스크린샷 업로드</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Abstract 스크린샷
                  </div>
                </button>

                <button
                  onClick={() => setInputMethod('pdf')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    inputMethod === 'pdf'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled
                >
                  <div className="text-3xl mb-2">📄</div>
                  <div className="font-medium">PDF 업로드</div>
                  <div className="text-xs text-gray-500 mt-1">곧 지원 예정</div>
                </button>
              </div>

              {/* Text Input */}
              {inputMethod === 'text' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <label className="block text-sm font-medium mb-2">
                    연구 논문 Abstract 또는 Eligibility Criteria 섹션:
                  </label>
                  <Textarea
                    value={abstractText}
                    onChange={(e) => setAbstractText(e.target.value)}
                    placeholder="예시:&#10;&#10;Inclusion Criteria:&#10;- Adults aged 18-65 years&#10;- Diagnosed with Type 2 Diabetes&#10;- Located in Boston, MA area&#10;- HbA1c levels between 7-10%&#10;&#10;Exclusion Criteria:&#10;- Pregnant or breastfeeding women&#10;- History of diabetic ketoacidosis"
                    className="min-h-[300px] text-sm font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    논문의 inclusion/exclusion criteria 섹션을 복사하여
                    붙여넣으세요.
                  </p>
                </motion.div>
              )}

              {/* Image Upload */}
              {inputMethod === 'image' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <label className="block text-sm font-medium mb-2">
                    Abstract 스크린샷 업로드:
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                  >
                    {previewUrl ? (
                      <div className="space-y-4">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-96 mx-auto rounded border border-gray-200"
                        />
                        <p className="text-sm text-gray-600">
                          {selectedFile?.name}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setPreviewUrl(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                        >
                          다른 이미지 선택
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-5xl mb-3">📸</div>
                        <p className="text-gray-600 mb-2">
                          클릭하여 이미지 업로드
                        </p>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, WebP 지원
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </motion.div>
              )}

              {/* PDF Upload */}
              {inputMethod === 'pdf' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-center py-12 text-gray-500"
                >
                  <div className="text-5xl mb-3">🚧</div>
                  <p>PDF 업로드 기능은 곧 지원될 예정입니다.</p>
                </motion.div>
              )}

              {/* Submit Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    loading || (!abstractText && !selectedFile) || inputMethod === 'pdf'
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      처리 중...
                    </span>
                  ) : (
                    '환자 찾기'
                  )}
                </Button>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4">작동 방식</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
                    1
                  </div>
                  <div>
                    <strong>논문 제출:</strong> Abstract 또는 Eligibility
                    Criteria 섹션을 텍스트로 붙여넣거나 스크린샷을 업로드합니다.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
                    2
                  </div>
                  <div>
                    <strong>AI 분석:</strong> Anthropic Claude가 논문에서 환자
                    선정 기준(나이, 성별, 질환, 위치)을 자동으로 추출합니다.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">
                    3
                  </div>
                  <div>
                    <strong>환자 매칭:</strong> 크라우드펀딩 플랫폼에서 기준에
                    맞는 환자를 찾아 매칭 점수와 함께 표시합니다.
                  </div>
                </div>
              </div>
            </div>

            {/* Example Section */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold mb-3 text-blue-900">예시</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p className="font-medium">Inclusion Criteria:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Adults aged 18-65 years</li>
                  <li>Diagnosed with Type 2 Diabetes</li>
                  <li>Located in Boston, MA area</li>
                  <li>HbA1c levels between 7-10%</li>
                </ul>
                <p className="font-medium mt-3">Exclusion Criteria:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Pregnant or breastfeeding women</li>
                  <li>History of diabetic ketoacidosis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

