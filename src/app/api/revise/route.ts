import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ReviseRequest = {
  response: string; // User's writing response
  question?: string;
  aiProvider?: "openai" | "gemini" | "deepseek" | "other";
  aiModel?: string;
  customPrompt?: string;
  etsRubric?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Missing OPENAI_API_KEY. Please add it to your environment variables.",
        }),
        { status: 500 }
      );
    }

    const body = (await req.json()) as ReviseRequest;
    const {
      response,
      question,
      aiProvider = "openai",
      aiModel,
      customPrompt,
      etsRubric,
    } = body;

    if (
      !response ||
      typeof response !== "string" ||
      response.trim().length < 50
    ) {
      return new Response(
        JSON.stringify({
          error: "Please paste a complete response (at least a few sentences).",
        }),
        { status: 400 }
      );
    }

    if (aiProvider !== "openai") {
      return new Response(
        JSON.stringify({
          error:
            "Right now this app only supports OpenAI (ChatGPT). Other providers are placeholders.",
        }),
        { status: 400 }
      );
    }

    const questionText =
      question && question.trim().length > 0
        ? `Question/Prompt:\n${question.trim()}\n\n`
        : "";

    const hasCustomPrompt = customPrompt && customPrompt.trim().length > 0;
    const hasRubric = etsRubric && etsRubric.trim().length > 0;

    // Detect task type from question content
    const isEmailTask =
      question &&
      (question.includes("Context:") ||
        question.includes("Recipient:") ||
        question.includes("Purpose:") ||
        question.includes("Tone:"));

    // If custom prompt is provided, use it completely instead of default prompt
    const prompt = hasCustomPrompt
      ? `${customPrompt.trim()}

${questionText}Student's original response:
"""${response.trim()}"""
`.trim()
      : `
You are an expert TOEFL iBT Writing tutor.

The student is writing a TOEFL-style ${
          isEmailTask ? "email" : "academic discussion"
        } response.

${
  isEmailTask
    ? `In the Write an Email task, test takers are presented with a scenario in text regarding either an academic or social setting. Test takers are asked to share information in writing for a specific communicative purpose—for example, making a recommendation, extending an invitation, or proposing a solution to a problem. Test takers have 7 minutes to complete this task. This writing task measures the test taker's ability to produce a multisentence written text that:
• achieves the designated communicative goal, following basic social conventions;
• is adequately elaborated, clear, and cohesive;
• makes accurate and appropriate use of a range of grammatical structures and vocabulary; and
• follows the mechanical conventions of English (spelling, punctuation, and capitalization).`
    : `In the Write for an Academic Discussion task, test takers are asked to state and support an opinion within the context of an online class discussion forum. A post from the professor briefly frames the topic and poses an opinion question related to the topic for the class to discuss. Brief posts from two students then provide different positions on the issue. The test takers contribute their own position on the question, supporting their opinion with their own reasoning, experiences, or knowledge. They have 10 minutes to complete this task. This task measures the test taker's ability to produce a multisentence written text that:
• clearly elaborates an argument for a position, responding to arguments, and/or using information provided in short texts;
• is adequately supported, clear, and cohesive;
• makes accurate and appropriate use of a range of grammatical structures and vocabulary; and
• follows the mechanical conventions of English (spelling, punctuation, and capitalization).`
}

Your task is to revise the response focusing on:
1. Grammar corrections (sentence structure, verb tenses, subject-verb agreement, etc.)
2. Word choice improvements (using more appropriate vocabulary, avoiding repetition, etc.)
3. Typo corrections (spelling errors)
4. Punctuation corrections (commas, periods, apostrophes, quotation marks, etc.)

Keep the student's original ideas and structure. Only make corrections and improvements to grammar, word choice, typos, and punctuation.

${
  hasRubric
    ? `\nUse the following ETS scoring rubric to guide your evaluation:\n\n${etsRubric.trim()}\n`
    : ""
}

${questionText}Student's original response:
"""${response.trim()}"""

1) First, rewrite the text correcting all grammar errors, improving word choices, and fixing typos while keeping the student's original structure and ideas.

2) Then, provide feedback with:
- An overall estimated score from 0–5 based on the ETS rubric provided (where 5 = fully successful, 4 = generally successful, 3 = partially successful, 2 = mostly unsuccessful, 1 = unsuccessful, 0 = blank/invalid). Use the rubric criteria to determine the appropriate score level.
- Grammar corrections: List specific grammar errors that were fixed (3–5 items).
- Word choice improvements: List vocabulary/word choice improvements made (3–5 items).
- Typo corrections: List spelling errors that were corrected (if any).
- Punctuation corrections: List punctuation errors that were corrected (if any).
- Detailed corrections: For each correction made, provide the exact text from the revised essay, what it was originally, why it was wrong, and the type of correction. This is critical for visual highlighting.
- 3–5 bullet points of main strengths.
- 3–5 bullet points of the highest‑priority improvements for the next attempt.

Return your answer in strict JSON format with this TypeScript type:
type Response = {
  revisedEssay: string;
  feedback: {
    estimatedScore: number; // Score from 0-5 based on ETS rubric (5 = fully successful, 4 = generally successful, 3 = partially successful, 2 = mostly unsuccessful, 1 = unsuccessful, 0 = blank/invalid)
    grammarCorrections: string[];
    wordChoiceImprovements: string[];
    typoCorrections: string[];
    punctuationCorrections: string[];
    detailedCorrections: Array<{
      text: string; // The corrected text as it appears in revisedEssay. IMPORTANT: For single-word corrections (e.g., "in" -> "on"), include surrounding context (e.g., "focus on" not just "on") to enable accurate highlighting.
      original: string; // What it was in the original response (include context, e.g., "focus in" not just "in")
      explanation: string; // Why it was wrong/corrected
      type: "grammar" | "wordChoice" | "typo" | "punctuation";
    }>;
    strengths: string[];
    improvements: string[];
    summary: string;
  };
};

Do NOT add any explanation outside the JSON. Just return valid JSON.
    `.trim();

    const completion = await openai.chat.completions.create({
      model:
        aiModel && aiModel.trim().length > 0 ? aiModel.trim() : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: hasCustomPrompt
            ? "You are a helpful AI assistant. Follow the user's instructions carefully."
            : "You are a strict but encouraging TOEFL iBT Writing tutor who always responds in valid JSON as requested.",
        },
        { role: "user", content: prompt },
      ],
      // Only enforce JSON format when using default prompt
      ...(hasCustomPrompt ? {} : { response_format: { type: "json_object" } }),
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({
          error: "No response from the AI model.",
        }),
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // If custom prompt is used and response is not JSON, wrap it in a compatible format
      if (hasCustomPrompt) {
        parsed = {
          revisedEssay: content,
          feedback: {
            estimatedScore: 0,
            grammarCorrections: [],
            wordChoiceImprovements: [],
            typoCorrections: [],
            punctuationCorrections: [],
            detailedCorrections: [],
            strengths: ["Custom prompt response received"],
            improvements: [],
            summary:
              "The model returned a non-JSON response. Displaying raw output.",
          },
        };
      } else {
        return new Response(
          JSON.stringify({
            error: "Failed to parse AI response. Please try again.",
          }),
          { status: 500 }
        );
      }
    }

    // If custom prompt response doesn't match expected structure, wrap it
    if (hasCustomPrompt && (!parsed.revisedEssay || !parsed.feedback)) {
      parsed = {
        revisedEssay:
          parsed.revisedEssay || parsed.text || parsed.response || content,
        feedback: parsed.feedback || {
          estimatedScore: parsed.estimatedScore || parsed.score || 0,
          grammarCorrections: parsed.grammarCorrections || [],
          wordChoiceImprovements: parsed.wordChoiceImprovements || [],
          typoCorrections: parsed.typoCorrections || [],
          punctuationCorrections: parsed.punctuationCorrections || [],
          detailedCorrections: parsed.detailedCorrections || [],
          strengths: parsed.strengths || parsed.strength || [],
          improvements: parsed.improvements || parsed.improvement || [],
          summary:
            parsed.summary ||
            parsed.feedback ||
            parsed.comment ||
            "Custom prompt response processed.",
        },
      };
    }

    // Ensure backward compatibility: if new fields are missing, add empty arrays
    if (parsed.feedback) {
      parsed.feedback.grammarCorrections =
        parsed.feedback.grammarCorrections || [];
      parsed.feedback.wordChoiceImprovements =
        parsed.feedback.wordChoiceImprovements || [];
      parsed.feedback.typoCorrections = parsed.feedback.typoCorrections || [];
      parsed.feedback.punctuationCorrections =
        parsed.feedback.punctuationCorrections || [];
      parsed.feedback.detailedCorrections =
        parsed.feedback.detailedCorrections || [];
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[/api/revise] Error:", error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return new Response(
          JSON.stringify({
            error:
              "Invalid API key. Please check your OPENAI_API_KEY in .env.local",
          }),
          { status: 401 }
        );
      }
      if (error.message.includes("rate limit")) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in a moment.",
          }),
          { status: 429 }
        );
      }
      if (error.message.includes("insufficient_quota")) {
        return new Response(
          JSON.stringify({
            error:
              "Insufficient API quota. Please check your OpenAI account billing.",
          }),
          { status: 402 }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error. Please try again.",
      }),
      { status: 500 }
    );
  }
}
