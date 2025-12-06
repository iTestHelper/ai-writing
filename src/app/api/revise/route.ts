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
      (question.includes("Scenario:") ||
        question.includes("Recipient:") ||
        question.includes("Subject:") ||
        question.includes("Context:") ||
        question.includes("Purpose:") ||
        question.includes("Tone:"));

    // Calculate word count
    const wordCount = response.trim().split(/\s+/).filter(Boolean).length;

    // If custom prompt is provided, use it completely instead of default prompt
    const prompt = hasCustomPrompt
      ? `${customPrompt.trim()}

${questionText}Student's original response:
"""${response.trim()}"""
`.trim()
      : isEmailTask
      ? `You are an expert TOEFL iBT writing evaluator specializing in the new 2026 "Write an Email" task. 

Evaluate the student's email strictly according to the ETS Write-an-Email rubric AND the following four analytic categories, each scored from 0.0 to 7.5 (half-points allowed). Assume the student wrote the response in about 7 minutes, so minor non-disruptive errors should not heavily reduce scores.

Your goal: Provide professional, extremely clear, structured feedback including scores, analysis, corrections, and a revised higher-quality version of the email.

--------------------------------------------------------------------

THE TASK PROMPT

--------------------------------------------------------------------

${question && question.trim().length > 0 ? question.trim() : "No task prompt provided."}

--------------------------------------------------------------------

THE STUDENT'S EMAIL (${wordCount} words)

--------------------------------------------------------------------

${response.trim()}

--------------------------------------------------------------------

EVALUATION RULES

--------------------------------------------------------------------

SCORE EACH CATEGORY FROM 0.0 TO 7.5:

First, decide which ETS performance level (0–5) best describes the email in that category,

using the official "Write an Email" rubric (5 = fully successful, 4 = generally successful, etc.).

Then map that level to the 0.0–7.5 analytic range approximately as follows:

- ETS level 5 ("fully successful")      → 6.5–7.5

- ETS level 4 ("generally successful")  → 5.0–6.0

- ETS level 3 ("partially successful")  → 3.0–4.5

- ETS level 2 ("mostly unsuccessful")   → 1.5–3.0

- ETS level 1 ("unsuccessful")          → 0.5–1.5

- ETS level 0                           → 0.0

Do not be overly conservative with high scores: if the email clearly meets the ETS level-5 

description in a category and only has minor, timed-writing errors, you should choose scores in the 7.0–7.5 range for that category.

When all four categories clearly match ETS level 5, each should usually receive a score in the 7.0–7.5 range, so that the final score falls between 28 and 30. Reserve the absolute maximum score of 30 for responses that are clearly strong in content, structure, tone, and language, with only minor mistakes typical of timed writing.

1. Elaboration

   - How fully and clearly the email explains ideas.

   - How well it fulfills all required bullet points.

   - Use of specific, relevant details.

   - Depth of explanation.

2. Response Structure

   - Proper email format: greeting → intro → body → closing/thanks.

   - Logical ordering of ideas.

   - Coherence of paragraphs or sentence groups.

   - Clear beginning, middle, and end.

3. Appropriate Social Conventions

   - Polite, appropriate tone for the recipient.

   - Proper level of formality (academic / semi-formal).

   - Appropriate greetings and closings.

   - Clear, polite requests or offers.

4. Syntactic & Grammatical Effectiveness

   - Grammar accuracy and sentence structure.

   - Word choice and clarity.

   - Punctuation.

   - Fluency and readability.

${hasRubric ? `\n--------------------------------------------------------------------\n\nETS RUBRIC\n\n--------------------------------------------------------------------\n\n${etsRubric.trim()}\n\n` : ""}--------------------------------------------------------------------

YOUR OUTPUT FORMAT (JSON)

--------------------------------------------------------------------

Provide feedback in the following 5 sections:

============================================================

SECTION A — SCORES (0–7.5 each, plus total out of 30)

============================================================

Give each score clearly:

• Elaboration score:

• Response Structure score:

• Social Conventions score:

• Syntactic & Grammatical Effectiveness score:

• Final Score (sum out of 30):

============================================================

SECTION B — ELABORATION & TASK RESPONSE FEEDBACK

============================================================

Write a detailed, professional analysis of:

• How well the student addressed each required bullet.

• How fully ideas were developed.

• Which details were effective.

• What elaboration is missing or unclear.

• 2–4 strengths

• 2–4 weaknesses

Keep focus strictly on ideas and task completeness (not grammar).

============================================================

SECTION C — STRUCTURE & ORGANIZATION FEEDBACK

============================================================

Provide:

• A clear explanation of how well the email follows formal structure.

• Greeting evaluation

• Intro clarity

• Body organization

• Closing & thanks clarity

• 2–4 structural strengths

• 2–4 structural weaknesses

============================================================

SECTION D — SOCIAL CONVENTIONS FEEDBACK

============================================================

Provide:

• Evaluation of tone, politeness, formality, pragmatic appropriateness.

• Discussion of greetings, closings, and phrasing.

• Identify any expressions that are too informal, too direct, impolite, or inappropriate.

• For each problematic phrase: show "original → improved" with a brief reason.

• 2–4 strengths

• 2–4 weaknesses

============================================================

SECTION E — SYNTAX, GRAMMAR, AND REVISIONS

============================================================

Do ALL of the following:

1) Grammar & Language Analysis  

   - List the main grammar errors (with short examples).  

   - List the main punctuation issues.  

   - List unclear or incorrect word choices.  

   - List tone issues or informal expressions.  

2) Corrected Version  

   Provide a corrected version of the student's email:

   - Fix grammar, punctuation, capitalization.

   - Replace clearly wrong or informal words with appropriate ones.

   - Keep the original meaning, order of ideas, and overall length.

3) Revised High-Quality Version  

   Provide a more polished version that:

   - Strengthens elaboration,

   - Improves structure,

   - Uses fully appropriate social conventions,

   - Sounds natural and human,

   - Is realistic for a strong TOEFL writer within 7 minutes.

   Do NOT make it overly long or excessively perfect.

Return your answer in strict JSON format with this TypeScript type:
type Response = {
  correctedVersion: string; // The corrected version (Section E.2)
  revisedHighQualityVersion: string; // The revised high-quality version (Section E.3)
  feedback: {
    scores: {
      elaboration: number; // 0.0-7.5
      responseStructure: number; // 0.0-7.5
      socialConventions: number; // 0.0-7.5
      syntacticGrammaticalEffectiveness: number; // 0.0-7.5
      finalScore: number; // Sum out of 30
    };
    sectionB: {
      analysis: string; // Detailed analysis of elaboration and task response
      strengths: string[]; // 2-4 strengths
      weaknesses: string[]; // 2-4 weaknesses
    };
    sectionC: {
      analysis: string; // Analysis of structure and organization
      strengths: string[]; // 2-4 structural strengths
      weaknesses: string[]; // 2-4 structural weaknesses
    };
    sectionD: {
      analysis: string; // Analysis of social conventions
      problematicPhrases?: Array<{
        original: string;
        improved: string;
        reason: string;
      }>;
      strengths: string[]; // 2-4 strengths
      weaknesses: string[]; // 2-4 weaknesses
    };
    sectionE: {
      grammarErrors: string[]; // Main grammar errors with examples
      punctuationIssues: string[]; // Main punctuation issues
      wordChoiceIssues: string[]; // Unclear or incorrect word choices
      toneIssues: string[]; // Tone issues or informal expressions
      detailedCorrections: Array<{
        text: string; // The corrected text as it appears in correctedVersion. IMPORTANT: For single-word corrections (e.g., "in" -> "on"), include surrounding context (e.g., "focus on" not just "on") to enable accurate highlighting.
        original: string; // What it was in the original response (include context, e.g., "focus in" not just "in")
        explanation: string; // Why it was wrong/corrected
        type: "grammar" | "wordChoice" | "typo" | "punctuation";
      }>;
    };
  };
};

Do NOT add any explanation outside the JSON. Just return valid JSON.`.trim()
      : `You are an expert TOEFL iBT writing evaluator specializing in the 2026 "Academic Discussion" writing task. 

Your job is to evaluate and improve a human-written TOEFL response to a professor's discussion board prompt and two classmates' replies. The response was written in 10 minutes and is between 130 and 200 words.

--------------------------------------------------------------------

THE TASK PROMPT

--------------------------------------------------------------------

${question && question.trim().length > 0 ? question.trim() : "No task prompt provided."}

--------------------------------------------------------------------

THE STUDENT'S RESPONSE (${wordCount} words)

--------------------------------------------------------------------

${response.trim()}

--------------------------------------------------------------------

SCORING FRAMEWORK

--------------------------------------------------------------------

Evaluate the student's response using the following 4 scoring categories:

1. Contribution & Reasoning (0–12 points)  

   • Are the ideas original, relevant, and clearly elaborated?  

   • Are they supported with logical reasoning, explanations, or examples?  

   • Creativity and insight earn credit — repetition or vagueness lowers the score.  

   • Minor grammar errors should not reduce this score if the ideas are well-developed.

2. Task Response & Structure (0–8 points)  

   • Does the student directly and fully answer the professor's question?  

   • Is the structure logical, cohesive, and appropriate for a single-paragraph post?  

   • For two-sided prompts: does the student clearly choose a side and stay focused?  

   • For open-ended prompts: is the idea unique, and are there two well-developed reasons?

3. Grammar & Correctness (0–5 points)  

   • Is the grammar accurate enough to make the writing clear and readable?  

   • Are there distracting errors, or is meaning mostly preserved?  

   • Bonus credit for complex but correctly formed sentence structures.  

   • Avoid over-penalizing small, timed-writing errors (typos, missed plurals, etc.).

4. Word Choice & Diversity (0–5 points)  

   • Are words used naturally, accurately, and with variety?  

   • Is the tone academic, clear, and not overly simple or awkward?  

   • Avoid excessive repetition, and prefer precise vocabulary.  

   • Academic fluency is better than forced or robotic phrasing.

--------------------------------------------------------------------

TASK-TYPE RECOGNITION & RESPONSE STRATEGY

--------------------------------------------------------------------

🧭 First, detect whether the professor's question is:

• A two-sided question (asks the student to choose between A or B, agree or disagree)

• An open-ended question (asks the student to suggest an idea, solution, or strategy)

Then evaluate accordingly:

▶️ For two-sided questions:  

• The student must choose a clear side in the opening line  

• A strong response does one of the following:

  - Gives one strong reason + rebuts one point from the other side  

  - Gives two unique reasons without referring to the opposing student  

• Don't reward vague or neutral positions

▶️ For open-ended questions:  

• The student should offer a new idea, NOT just agree/disagree  

• The response must contain two distinct, fully developed reasons  

• Avoid overlaps with student posts or copying their ideas

--------------------------------------------------------------------

EVALUATION EXPECTATIONS

--------------------------------------------------------------------

• Do not punish small errors typical of timed writing  

• Do not give low scores for an answer that is polished and fluent — some students write well under pressure  

• Reward strong logic, direct task response, and language clarity  

• Penalize only when grammar, logic, or structure interferes with communication

${hasRubric ? `\n--------------------------------------------------------------------\n\nETS RUBRIC\n\n--------------------------------------------------------------------\n\n${etsRubric.trim()}\n\n` : ""}--------------------------------------------------------------------

YOUR OUTPUT FORMAT (JSON)

--------------------------------------------------------------------

Format your evaluation in 5 sections as follows:

============================================================

SECTION A — SCORES

============================================================

• Contribution & Reasoning score (0–12):  

• Task Response & Structure score (0–8):  

• Grammar & Correctness score (0–5):  

• Word Choice & Diversity score (0–5):  

• Final Score (sum out of 30):  

============================================================

SECTION B — CONTRIBUTION & REASONING FEEDBACK

============================================================

• Explain how strong the student's contribution was:  

   – Are the ideas logical, well-explained, and relevant?  

   – Is the reasoning original and specific or vague and generic?  

• List 2–4 strengths (e.g., strong idea, good support, unique example)  

• List 2–4 weaknesses (e.g., repetitive logic, underdeveloped reasoning)

============================================================

SECTION C — TASK RESPONSE & STRUCTURE FEEDBACK

============================================================

• Evaluate how well the student responded to the professor's prompt:  

   – Did they recognize the task type and use the right approach?  

   – Is the paragraph unified, cohesive, and logically ordered?  

• List 2–4 strengths (e.g., clear opening sentence, effective transitions)  

• List 2–4 weaknesses (e.g., off-topic, lack of cohesion, unclear structure)

============================================================

SECTION D — GRAMMAR & CORRECTNESS FEEDBACK

============================================================

• Analyze the grammar and mechanics:  

   – Are there errors that interfere with clarity?  

   – Are any complex structures used effectively?  

• Include 2–4 examples (positive or negative)

• Then provide:  

Corrected Version:  

(Rewrite the student's response with corrected grammar, punctuation, and spelling only. Preserve the original ideas, order, and tone.)

============================================================

SECTION E — WORD CHOICE & DIVERSITY FEEDBACK

============================================================

• Assess the quality of vocabulary:  

   – Is the language natural and academic?  

   – Are there strong words or awkward ones?  

   – Is vocabulary varied and appropriate?  

• List 2–4 strengths and 2–4 weaknesses  

• Then provide:  

Revised Version:  

(Rewrite the student's response with improved vocabulary, tone, and phrasing — keep all original content and structure. Make it sound like a more fluent TOEFL writer, not a robot.)

--------------------------------------------------------------------

DO NOT include anything outside these sections.

--------------------------------------------------------------------

Return your answer in strict JSON format with this TypeScript type:
type Response = {
  correctedVersion: string; // The corrected version (Section D)
  revisedVersion: string; // The revised version (Section E)
  feedback: {
    scores: {
      contributionReasoning: number; // 0-12
      taskResponseStructure: number; // 0-8
      grammarCorrectness: number; // 0-5
      wordChoiceDiversity: number; // 0-5
      finalScore: number; // Sum out of 30
    };
    sectionB: {
      analysis: string; // Explanation of contribution and reasoning
      strengths: string[]; // 2-4 strengths
      weaknesses: string[]; // 2-4 weaknesses
    };
    sectionC: {
      analysis: string; // Evaluation of task response and structure
      strengths: string[]; // 2-4 strengths
      weaknesses: string[]; // 2-4 weaknesses
    };
    sectionD: {
      analysis: string; // Analysis of grammar and mechanics
      examples: string[]; // 2-4 examples (positive or negative)
      detailedCorrections: Array<{
        text: string; // The corrected text as it appears in correctedVersion. IMPORTANT: For single-word corrections (e.g., "in" -> "on"), include surrounding context (e.g., "focus on" not just "on") to enable accurate highlighting.
        original: string; // What it was in the original response (include context, e.g., "focus in" not just "in")
        explanation: string; // Why it was wrong/corrected
        type: "grammar" | "wordChoice" | "typo" | "punctuation";
      }>;
    };
    sectionE: {
      analysis: string; // Assessment of vocabulary quality
      strengths: string[]; // 2-4 strengths
      weaknesses: string[]; // 2-4 weaknesses
    };
  };
};

Do NOT add any explanation outside the JSON. Just return valid JSON.`.trim();

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

    // Handle email task new format vs academic task new format
    if (isEmailTask && !hasCustomPrompt) {
      // Email task uses new format: correctedVersion, revisedHighQualityVersion, and 5-section feedback
      // Ensure all required fields exist
      if (!parsed.correctedVersion) {
        parsed.correctedVersion = parsed.revisedEssay || parsed.text || parsed.response || "";
      }
      if (!parsed.revisedHighQualityVersion) {
        parsed.revisedHighQualityVersion = parsed.correctedVersion || "";
      }
      if (!parsed.feedback) {
        parsed.feedback = {};
      }
      if (!parsed.feedback.scores) {
        parsed.feedback.scores = {
          elaboration: parsed.feedback.estimatedScore ? parsed.feedback.estimatedScore * 1.5 : 0,
          responseStructure: parsed.feedback.estimatedScore ? parsed.feedback.estimatedScore * 1.5 : 0,
          socialConventions: parsed.feedback.estimatedScore ? parsed.feedback.estimatedScore * 1.5 : 0,
          syntacticGrammaticalEffectiveness: parsed.feedback.estimatedScore ? parsed.feedback.estimatedScore * 1.5 : 0,
          finalScore: parsed.feedback.estimatedScore ? parsed.feedback.estimatedScore * 6 : 0,
        };
      }
      // Ensure all section fields exist
      if (!parsed.feedback.sectionB) {
        parsed.feedback.sectionB = {
          analysis: parsed.feedback.summary || "",
          strengths: parsed.feedback.strengths || [],
          weaknesses: parsed.feedback.improvements || [],
        };
      }
      if (!parsed.feedback.sectionC) {
        parsed.feedback.sectionC = {
          analysis: "",
          strengths: [],
          weaknesses: [],
        };
      }
      if (!parsed.feedback.sectionD) {
        parsed.feedback.sectionD = {
          analysis: "",
          strengths: [],
          weaknesses: [],
        };
      }
      if (!parsed.feedback.sectionE) {
        parsed.feedback.sectionE = {
          grammarErrors: parsed.feedback.grammarCorrections || [],
          punctuationIssues: parsed.feedback.punctuationCorrections || [],
          wordChoiceIssues: parsed.feedback.wordChoiceImprovements || [],
          toneIssues: [],
          detailedCorrections: parsed.feedback.detailedCorrections || [],
        };
      }
    } else {
      // Academic task or custom prompt: use old format
      // If custom prompt response doesn't match expected structure, wrap it
      if (hasCustomPrompt && (!parsed.revisedEssay || !parsed.feedback)) {
        parsed = {
          revisedEssay:
            parsed.revisedEssay || parsed.correctedVersion || parsed.text || parsed.response || content,
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
