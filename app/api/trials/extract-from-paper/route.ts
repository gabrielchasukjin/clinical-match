import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { extractPaperCriteria } from '@/lib/matching/extract-paper-criteria';
import pdf from 'pdf-parse';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const text = formData.get('text') as string | null;
    const imageFile = formData.get('image') as File | null;
    const pdfFile = formData.get('pdf') as File | null;

    if (!text && !imageFile && !pdfFile) {
      return new Response(
        JSON.stringify({ error: 'Text, image, or PDF must be provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;

    if (imageFile) {
      // Convert image to base64
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      imageBase64 = buffer.toString('base64');
      imageMimeType = imageFile.type;

      console.log('Processing image:', {
        name: imageFile.name,
        type: imageFile.type,
        size: imageFile.size,
      });
    }

    // Extract text from PDF if provided
    let extractedPdfText: string | undefined;
    if (pdfFile) {
      try {
        console.log('Extracting text from PDF:', {
          name: pdfFile.name,
          type: pdfFile.type,
          size: pdfFile.size,
        });

        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfBytes);
        const pdfData = await pdf(pdfBuffer);
        
        extractedPdfText = pdfData.text;
        console.log('Extracted PDF text length:', extractedPdfText.length);
        console.log('PDF text preview:', extractedPdfText.substring(0, 300) + '...');
      } catch (pdfError: any) {
        console.error('PDF extraction failed:', pdfError);
        return new Response(
          JSON.stringify({ 
            error: `Failed to extract text from PDF: ${pdfError.message}` 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Combine text sources (user input text + extracted PDF text)
    const combinedText = [text, extractedPdfText].filter(Boolean).join('\n\n');

    if (combinedText) {
      console.log('Processing combined text:', combinedText.substring(0, 200) + '...');
    }

    // Extract criteria using Anthropic API
    const criteria = await extractPaperCriteria({
      text: combinedText || undefined,
      imageBase64,
      imageMimeType,
    });

    return Response.json({
      success: true,
      criteria,
    });
  } catch (error: any) {
    console.error('Extract criteria error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to extract criteria from paper',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

