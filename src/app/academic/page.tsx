"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type Correction = {
  text: string;
  original: string;
  explanation: string;
  type: "grammar" | "wordChoice" | "typo" | "punctuation";
};

type ReviseResponse = {
  revisedEssay: string;
  feedback: {
    estimatedScore: number;
    grammarCorrections?: string[];
    wordChoiceImprovements?: string[];
    typoCorrections?: string[];
    punctuationCorrections?: string[];
    detailedCorrections?: Correction[];
    strengths: string[];
    improvements: string[];
    summary: string;
  };
};

import { EyeIcon, EyeOffIcon, SettingsIcon, FileTextIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const professorImage: Record<"Dr. Achebe" | "Dr. Diaz" | "Dr. Gupta", string> =
  {
    "Dr. Achebe": "/toefl/writing/image/professor_Achebe.png",
    "Dr. Diaz": "/toefl/writing/image/professor_Diaz.png",
    "Dr. Gupta": "/toefl/writing/image/professor_Gupta.png",
  };

const studentImage: Record<"Andrew" | "Paul" | "Claire" | "Kelly", string> = {
  Andrew: "/toefl/writing/image/student_Andrew.png",
  Paul: "/toefl/writing/image/student_Paul.png",
  Claire: "/toefl/writing/image/student_Claire.png",
  Kelly: "/toefl/writing/image/student_Kelly.png",
};

import { aiProviders, type AIProviderId } from "@/lib/ai-providers";
import { countWords } from "@/lib/utils";

const SETTINGS_STORAGE_KEY = "academic-ai-settings";
const FORM_DATA_STORAGE_KEY = "academic-form-data";
const RESULT_STORAGE_KEY = "academic-revision-result";
const RUBRIC_STORAGE_KEY = "academic-ets-rubric";

// Helper function to highlight corrections in text
function highlightCorrections(
  text: string,
  corrections: Correction[]
): React.ReactNode[] {
  if (!corrections || corrections.length === 0) {
    return text
      .split(/\n{2,}/)
      .map((para, idx) => <span key={idx}>{para.trim()}</span>);
  }

  // Sort corrections by position in text (longest first to handle nested matches)
  const sortedCorrections = [...corrections].sort(
    (a, b) => b.text.length - a.text.length
  );

  // Split by paragraphs first
  const paragraphs = text.split(/\n{2,}/);
  const result: React.ReactNode[] = [];

  paragraphs.forEach((para, paraIdx) => {
    if (!para.trim()) {
      result.push(<span key={paraIdx}>{"\n\n"}</span>);
      return;
    }

    const paraText = para.trim();
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    const matches: Array<{
      start: number;
      end: number;
      correction: Correction;
    }> = [];

    // Find all correction matches in this paragraph
    sortedCorrections.forEach((correction) => {
      const searchText = correction.text.trim();
      if (!searchText) return;

      // Common short words that appear frequently - need context to match correctly
      const commonWords = new Set([
        "on",
        "in",
        "at",
        "to",
        "for",
        "of",
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
      ]);

      const isCommonWord = commonWords.has(searchText.toLowerCase());
      const originalText = correction.original?.trim() || "";

      let regex: RegExp;
      let searchPattern: string;

      // If it's a common word and we have original context, try to match with context
      if (isCommonWord && originalText) {
        // Try to find a phrase that includes both original and corrected text
        // For "focus in" -> "focus on", search for "focus on"
        const wordsBefore = originalText.split(/\s+/);
        if (wordsBefore.length > 1) {
          // Use the words before the correction as context
          const contextWords = wordsBefore.slice(0, -1).join(" ");
          const contextPattern = `${contextWords}\\s+${searchText}`;
          const escapedContext = contextPattern.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );
          regex = new RegExp(`\\b${escapedContext}\\b`, "gi");
          searchPattern = `${contextWords} ${searchText}`;
        } else {
          // Fall back to just the corrected word with word boundaries
          const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          regex = new RegExp(`\\b${escapedText}\\b`, "gi");
          searchPattern = searchText;
        }
      } else {
        // For longer phrases or less common words, use word boundaries
        const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(`\\b${escapedText}\\b`, "gi");
        searchPattern = searchText;
      }

      let match;
      while ((match = regex.exec(paraText)) !== null) {
        const start = match.index;
        const matchedText = match[0];
        const end = start + matchedText.length;

        // Verify this is the exact match (case-insensitive)
        if (matchedText.toLowerCase() === searchPattern.toLowerCase()) {
          // For context-based matches, adjust to only highlight the corrected part
          if (isCommonWord && originalText && searchPattern !== searchText) {
            // Find where the corrected word starts within the matched phrase
            const correctedWordStart = matchedText
              .toLowerCase()
              .lastIndexOf(searchText.toLowerCase());
            if (correctedWordStart !== -1) {
              matches.push({
                start: start + correctedWordStart,
                end: start + correctedWordStart + searchText.length,
                correction,
              });
            }
          } else {
            matches.push({
              start,
              end,
              correction,
            });
          }
        }
      }
    });

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep first occurrence)
    const nonOverlapping: typeof matches = [];
    matches.forEach((match) => {
      const overlaps = nonOverlapping.some(
        (existing) =>
          (match.start >= existing.start && match.start < existing.end) ||
          (match.end > existing.start && match.end <= existing.end) ||
          (match.start <= existing.start && match.end >= existing.end)
      );
      if (!overlaps) {
        nonOverlapping.push(match);
      }
    });

    // Sort again after removing overlaps
    nonOverlapping.sort((a, b) => a.start - b.start);

    // Build React elements
    nonOverlapping.forEach((match) => {
      // Add text before match
      if (match.start > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {paraText.slice(lastIndex, match.start)}
          </span>
        );
      }

      // Add highlighted match with tooltip
      const highlightColor =
        match.correction.type === "typo"
          ? "bg-red-200 dark:bg-red-900/40"
          : match.correction.type === "punctuation"
          ? "bg-orange-200 dark:bg-orange-900/40"
          : match.correction.type === "grammar"
          ? "bg-yellow-200 dark:bg-yellow-900/40"
          : "bg-blue-200 dark:bg-blue-900/40";

      elements.push(
        <Tooltip key={`correction-${match.start}`}>
          <TooltipTrigger asChild>
            <mark
              className={`cursor-help rounded px-0.5 font-medium underline decoration-2 underline-offset-2 ${highlightColor}`}
            >
              {paraText.slice(match.start, match.end)}
            </mark>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold capitalize">
                {match.correction.type === "typo"
                  ? "Spelling Error"
                  : match.correction.type === "punctuation"
                  ? "Punctuation Error"
                  : match.correction.type === "grammar"
                  ? "Grammar Error"
                  : "Word Choice"}
              </div>
              <div className="text-xs opacity-90">
                <div>
                  <span className="font-medium">Was:</span>{" "}
                  {match.correction.original}
                </div>
                <div className="mt-1">
                  <span className="font-medium">Why:</span>{" "}
                  {match.correction.explanation}
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );

      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < paraText.length) {
      elements.push(
        <span key={`text-${lastIndex}`}>{paraText.slice(lastIndex)}</span>
      );
    }

    result.push(
      <span key={paraIdx} className="whitespace-pre-line">
        {elements.length > 0 ? elements : paraText}
      </span>
    );
  });

  return result;
}

// Helper function to load form data from localStorage
function loadFormData() {
  if (typeof window === "undefined") {
    return {
      courseName: "a class on sociology",
      professorName: "Dr. Gupta" as const,
      professorQuestion: "",
      student1Name: "Kelly" as const,
      student1Post: "",
      student2Name: "Andrew" as const,
      student2Post: "",
      response: "",
    };
  }
  try {
    const raw = window.localStorage.getItem(FORM_DATA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        courseName?: string;
        professorName?: "Dr. Achebe" | "Dr. Diaz" | "Dr. Gupta";
        professorQuestion?: string;
        student1Name?: "Andrew" | "Paul" | "Claire" | "Kelly";
        student1Post?: string;
        student2Name?: "Andrew" | "Paul" | "Claire" | "Kelly";
        student2Post?: string;
        response?: string;
        essay?: string; // Support legacy key for migration
      };
      return {
        courseName: parsed.courseName || "a class on sociology",
        professorName:
          parsed.professorName &&
          ["Dr. Achebe", "Dr. Diaz", "Dr. Gupta"].includes(parsed.professorName)
            ? parsed.professorName
            : ("Dr. Gupta" as const),
        professorQuestion: parsed.professorQuestion || "",
        student1Name:
          parsed.student1Name &&
          ["Andrew", "Paul", "Claire", "Kelly"].includes(parsed.student1Name)
            ? parsed.student1Name
            : ("Kelly" as const),
        student1Post: parsed.student1Post || "",
        student2Name:
          parsed.student2Name &&
          ["Andrew", "Paul", "Claire", "Kelly"].includes(parsed.student2Name)
            ? parsed.student2Name
            : ("Andrew" as const),
        student2Post: parsed.student2Post || "",
        response: parsed.response || parsed.essay || "", // Support legacy key
      };
    }
  } catch {
    // ignore malformed local storage
  }
  return {
    courseName: "a class on sociology",
    professorName: "Dr. Gupta" as const,
    professorQuestion: "",
    student1Name: "Kelly" as const,
    student1Post: "",
    student2Name: "Andrew" as const,
    student2Post: "",
    essay: "",
  };
}

// Helper function to load settings from localStorage
function loadSettings() {
  if (typeof window === "undefined") {
    return {
      aiProvider: "openai" as const,
      aiModel: "gpt-4o-mini",
      customPrompt: "",
    };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        aiProvider?: AIProviderId;
        aiModel?: string;
        customPrompt?: string;
      };
      return {
        aiProvider:
          parsed.aiProvider &&
          aiProviders.some((p) => p.id === parsed.aiProvider)
            ? parsed.aiProvider
            : ("openai" as const),
        aiModel: parsed.aiModel || "gpt-4o-mini",
        customPrompt: parsed.customPrompt || "",
      };
    }
  } catch {
    // ignore malformed local storage
  }
  return {
    aiProvider: "openai" as const,
    aiModel: "gpt-4o-mini",
    customPrompt: "",
  };
}

export default function AcademicPage() {
  const formData = loadFormData();
  const settings = loadSettings();

  const [response, setResponse] = useState(formData.response);
  const [courseName, setCourseName] = useState(formData.courseName);
  const [professorName, setProfessorName] = useState(formData.professorName);
  const [professorQuestion, setProfessorQuestion] = useState(
    formData.professorQuestion
  );
  const [student1Name, setStudent1Name] = useState(formData.student1Name);
  const [student1Post, setStudent1Post] = useState(formData.student1Post);
  const [student2Name, setStudent2Name] = useState(formData.student2Name);
  const [student2Post, setStudent2Post] = useState(formData.student2Post);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState(settings.aiProvider);
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviseResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showWordCount, setShowWordCount] = useState(true);

  // Default ETS rubric for "Write for an Academic Discussion"
  const defaultRubric = `Score 5 - A fully successful response
The response is a relevant and very clearly expressed contribution to the online discussion, and it demonstrates consistent facility in the use of language.
A typical response displays the following:
- Relevant and well-elaborated explanations, exemplifications and/or details
- Effective use of a variety of syntactic structures and precise, idiomatic word choice
- Almost no lexical or grammatical errors other than those expected from a competent writer writing under timed conditions (e.g., common typos or common misspellings or substitutions like there/their)

Score 4 - A generally successful response
The response is a relevant contribution to the online discussion, and facility in the use of language allows the writer's ideas to be easily understood.
A typical response displays the following:
- Relevant and adequately elaborated explanations, exemplifications and/or details
- A variety of syntactic structures and appropriate word choice
- Few lexical or grammatical errors

Score 3 - A partially successful response
The response is a mostly relevant and mostly understandable contribution to the online discussion, and there is some facility in the use of language.
A typical response displays the following:
- Elaboration in which part of an explanation, example or detail may be missing, unclear or irrelevant
- Some variety in syntactic structures and a range of vocabulary
- Some noticeable lexical and grammatical errors in sentence structure, word form or use of idiomatic language

Score 2 - A mostly unsuccessful response
The response reflects an attempt to contribute to the online discussion, but limitations in the use of language may make ideas hard to follow.
A typical response displays the following:
- Ideas that may be poorly elaborated or only partially relevant
- A limited range of syntactic structures and vocabulary
- An accumulation of errors in sentence structure, word forms or use

Score 1 - An unsuccessful response
The response reflects an ineffective attempt to contribute to the online discussion, and limitations in the use of language may prevent the expression of ideas.
A typical response displays the following:
- Words and phrases that indicate an attempt to address the task, but with few or no coherent ideas
- Severely limited range of syntactic structures and vocabulary
- Serious and frequent errors in the use of language
- Minimal original language; any coherent language is mostly borrowed from the stimulus

Score 0 - The response is blank, rejects the topic, is not in English, is entirely copied from the prompt, is entirely unconnected to the prompt or consists of arbitrary keystrokes.`;

  // Load rubric from localStorage
  const loadRubric = () => {
    if (typeof window === "undefined") return defaultRubric;
    try {
      const saved = window.localStorage.getItem(RUBRIC_STORAGE_KEY);
      return saved || defaultRubric;
    } catch {
      return defaultRubric;
    }
  };

  const [etsRubric, setEtsRubric] = useState(loadRubric());

  // Load saved result from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(RESULT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ReviseResponse;
        setResult(parsed);
      }
    } catch (err) {
      console.error("Failed to load saved result:", err);
    }
  }, []);

  // Save result to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !result) return;
    try {
      window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
    } catch (err) {
      console.error("Failed to save result:", err);
    }
  }, [result]);

  // Mark as loaded after initial render
  useEffect(() => {
    setHasLoaded(true);
  }, []);

  // Auto-save form data to localStorage whenever it changes (but not during initial render)
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoaded) return;
    try {
      const formDataToSave = {
        courseName,
        professorName,
        professorQuestion,
        student1Name,
        student1Post,
        student2Name,
        student2Post,
        response,
      };
      window.localStorage.setItem(
        FORM_DATA_STORAGE_KEY,
        JSON.stringify(formDataToSave)
      );
    } catch {
      // ignore storage errors
    }
  }, [
    hasLoaded,
    courseName,
    professorName,
    professorQuestion,
    student1Name,
    student1Post,
    student2Name,
    student2Post,
    response,
  ]);

  const handleSaveSettings = () => {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        aiProvider,
        aiModel,
        customPrompt,
      };
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(payload)
      );
      toast.success("Settings saved successfully");
      setSettingsOpen(false);
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleSaveRubric = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RUBRIC_STORAGE_KEY, etsRubric);
      toast.success("Rubric saved successfully");
      setRubricOpen(false);
    } catch {
      toast.error("Failed to save rubric");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!response || response.trim().length < 50) {
      toast.error(
        "Please paste a reasonably long response (at least a few sentences)."
      );
      return;
    }

    setLoading(true);
    try {
      const directionBlock = [
        `Your professor is teaching ${courseName}. Write a post responding to the professor's question.`,
        "",
        "In your response, you should do the following.",
        "● Express and support your opinion.",
        "● Make a contribution to the discussion in your own words.",
        "",
        "An effective response will contain at least 100 words.",
      ].join("\n");

      const professorBlock = professorQuestion.trim()
        ? `${professorName} asks:\n${professorQuestion.trim()}`
        : "";

      const studentsBlockParts: string[] = [];
      if (student1Post.trim()) {
        studentsBlockParts.push(
          `${student1Name} says:\n${student1Post.trim()}`
        );
      }
      if (student2Post.trim()) {
        studentsBlockParts.push(
          `${student2Name} says:\n${student2Post.trim()}`
        );
      }
      const studentsBlock =
        studentsBlockParts.length > 0
          ? `Student posts:\n${studentsBlockParts.join("\n\n")}`
          : "";

      const assembledQuestion = [directionBlock, professorBlock, studentsBlock]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider,
          aiModel,
          customPrompt,
          response,
          question: assembledQuestion,
          etsRubric: etsRubric,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to revise response.");
      }

      const data = (await res.json()) as ReviseResponse;
      setResult(data);
      toast.success("Response revised successfully");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 lg:py-12">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Write for an Academic Discussion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Use this page to test prompts, providers, and models for revising
              TOEFL academic discussion task.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => setRubricOpen(true)}
              aria-label="Open ETS rubric"
              title="Edit ETS rubric"
            >
              <FileTextIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open AI settings"
              title="AI settings"
            >
              <SettingsIcon />
            </Button>
          </div>
        </header>

        <Dialog open={rubricOpen} onOpenChange={setRubricOpen}>
          <DialogContent className="lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>ETS Rubric for Academic Discussion</DialogTitle>
              <DialogDescription>
                Enter or edit the ETS scoring rubric. This will be included in
                the AI prompt to guide the revision and scoring process.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Textarea
                value={etsRubric}
                onChange={(e) => setEtsRubric(e.target.value)}
                placeholder="Paste the ETS rubric here..."
                className="h-96 w-full text-xs md:text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The rubric will be included in the AI prompt to help evaluate
                responses according to ETS standards.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEtsRubric(defaultRubric)}
              >
                Reset to default
              </Button>
              <Button type="button" onClick={handleSaveRubric}>
                Save rubric
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>AI settings</DialogTitle>
              <DialogDescription>
                Configure which provider, model, and extra instructions you want
                to use for this page.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex-1 space-y-2 pr-0 md:pr-6">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Custom prompt
                </Label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Paste any extra instructions you want to prepend to the model prompt (e.g. style rules, constraints, etc.)"
                  className="mt-1 h-80 w-full text-xs md:text-sm"
                />
              </div>

              <div className="mt-1 flex w-full flex-col gap-3 md:mt-0 md:w-64">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    AI provider
                  </Label>
                  <Select
                    value={aiProvider}
                    onValueChange={(value) =>
                      setAiProvider(value as typeof aiProvider)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiProviders.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Currently only OpenAI is implemented in the backend; others
                    are for local testing/UI.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Model identifier
                  </Label>
                  {aiProviders.find((p) => p.id === aiProvider)?.models
                    .length ? (
                    <Select
                      value={aiModel}
                      onValueChange={(value) => setAiModel(value)}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {aiProviders
                          .find((p) => p.id === aiProvider)
                          ?.models.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="Enter model name"
                      className="h-8 px-2 text-xs md:text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleSaveSettings}>
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogTitle>Preview question</DialogTitle>
          <DialogContent className="lg:max-w-5xl border-0 bg-card p-0 shadow-2xl">
            <div className="flex h-full flex-col md:flex-row">
              {/* Left column: direction + professor */}
              <div className="flex w-full text-sm flex-col gap-y-4 border border-border rounded-xl p-4 md:w-[40%]">
                <div className="space-y-3">
                  <p>
                    Your professor is teaching {courseName}. Write a post
                    responding to the professor&apos;s question.
                  </p>
                  <div>
                    <p className="font-semibold">
                      In your response, you should do the following.
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      <li>Express and support your opinion.</li>
                      <li>
                        Make a contribution to the discussion in your own words.
                      </li>
                    </ul>
                  </div>
                  <p>An effective response will contain at least 100 words.</p>
                </div>

                <div className="flex flex-col items-center gap-y-4">
                  <div className="flex flex-col items-center gap-1">
                    <Image
                      src={professorImage[professorName]}
                      alt={professorName}
                      width={112}
                      height={112}
                      className="size-28 rounded-full object-cover"
                    />
                    <p>{professorName}</p>
                  </div>
                  {professorQuestion.trim() && <p>{professorQuestion}</p>}
                </div>
              </div>

              {/* Right column: students + response area */}
              <div className="flex text-sm w-full justify-between flex-1 flex-col gap-2 md:w-[60%]">
                <div className="p-4">
                  <div className="space-y-4">
                    {student1Post.trim() && (
                      <div className="flex w-full items-center gap-3">
                        <div className="size-18 flex flex-col items-center shrink-0">
                          <Image
                            src={studentImage[student1Name]}
                            alt={student1Name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover rounded-full"
                          />
                          <p>{student1Name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-foreground">{student1Post}</p>
                        </div>
                      </div>
                    )}

                    {student2Post.trim() && (
                      <div className="flex w-full items-center gap-3">
                        <div className="size-18 flex flex-col items-center shrink-0">
                          <Image
                            src={studentImage[student2Name]}
                            alt={student2Name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover rounded-full"
                          />
                          <p>{student2Name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-foreground">{student2Post}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col px-4">
                  <div className="bg-gray-100 dark:bg-inherit border border-border border-b-0 rounded-t-lg p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs cursor-pointer bg-teal-700/90 text-white hover:bg-teal-700 hover:text-white"
                        >
                          Cut
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs cursor-pointer bg-teal-700/90 text-white hover:bg-teal-700 hover:text-white"
                        >
                          Paste
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs cursor-pointer bg-teal-700/90 text-white hover:bg-teal-700 hover:text-white"
                        >
                          Undo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="text-xs cursor-pointer bg-teal-700/90 text-white hover:bg-gray-300 hover:text-black disabled:bg-gray-400/90 disabled:text-gray-800 dark:disabled:text-white"
                        >
                          Redo
                        </Button>
                      </div>
                      <div className="ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer h-8 text-xs"
                          onClick={() => setShowWordCount(!showWordCount)}
                        >
                          {showWordCount ? (
                            <>
                              <EyeOffIcon className="text-teal-700 h-3 w-3" />
                              <span className="text-teal-700">
                                Hide Word Count
                              </span>
                              <span className="font-semibold text-sm">
                                {countWords(response || "")}
                              </span>
                            </>
                          ) : (
                            <>
                              <EyeIcon className="text-teal-700 h-3 w-3" />
                              <span className="text-teal-700">
                                Show Word Count
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Textarea
                    value={response}
                    readOnly
                    placeholder="Your response preview will appear here (read-only)."
                    className="h-60 w-full resize-none border border-input rounded-none rounded-b-lg px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/60"
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <section className="flex flex-col gap-4">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm backdrop-blur"
          >
            <div className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">
                Question structure
              </h2>
              <p className="text-xs text-muted-foreground">
                These fields define the question context sent to the model
                (direction, professor question, and student posts).
              </p>
              <div className="flex gap-10">
                <div className="w-1/2 flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Course name
                      </Label>
                      <Input
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        placeholder="a class on sociology"
                        className="h-9 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Professor
                      </Label>
                      <Select
                        value={professorName}
                        onValueChange={(value) =>
                          setProfessorName(value as typeof professorName)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dr. Achebe">Dr. Achebe</SelectItem>
                          <SelectItem value="Dr. Diaz">Dr. Diaz</SelectItem>
                          <SelectItem value="Dr. Gupta">Dr. Gupta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 h-full">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Professor question
                    </Label>
                    <Textarea
                      value={professorQuestion}
                      onChange={(e) => setProfessorQuestion(e.target.value)}
                      placeholder="Type the professor's discussion question here..."
                      className="max-h-80 h-full text-sm resize-none"
                    />
                  </div>
                </div>
                <div className="w-1/2 grid gap-6 md:grid-rows-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Student 1
                    </Label>
                    <Select
                      value={student1Name}
                      onValueChange={(value) =>
                        setStudent1Name(value as typeof student1Name)
                      }
                    >
                      <SelectTrigger className="w-32!">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Andrew">Andrew</SelectItem>
                        <SelectItem value="Paul">Paul</SelectItem>
                        <SelectItem value="Claire">Claire</SelectItem>
                        <SelectItem value="Kelly">Kelly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={student1Post}
                      onChange={(e) => setStudent1Post(e.target.value)}
                      placeholder="First student post..."
                      className="mt-1 resize-none h-32 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Student 2
                    </Label>
                    <Select
                      value={student2Name}
                      onValueChange={(value) =>
                        setStudent2Name(value as typeof student2Name)
                      }
                    >
                      <SelectTrigger className="w-32!">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paul">Paul</SelectItem>
                        <SelectItem value="Andrew">Andrew</SelectItem>
                        <SelectItem value="Claire">Claire</SelectItem>
                        <SelectItem value="Kelly">Kelly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={student2Post}
                      onChange={(e) => setStudent2Post(e.target.value)}
                      placeholder="Second student post..."
                      className="mt-1 resize-none h-32 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Your response</Label>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Write or paste your academic discussion response here..."
                  className="h-48 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex gap-2 ms-auto">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                >
                  Preview
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Spinner /> Revising…
                    </>
                  ) : (
                    <>Revise</>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <Card className="gap-4!">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                AI‑revised response
              </CardTitle>
              <CardDescription>
                The rewritten version of the candidate&apos;s response based on
                your current prompt and model configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-px bg-linear-to-r from-primary/40 via-border to-transparent" />
              {result ? (
                <TooltipProvider>
                  <article className="mt-3 max-h-[340px] space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed">
                    {highlightCorrections(
                      result.revisedEssay,
                      result.feedback.detailedCorrections || []
                    ).map((para, idx) => (
                      <p key={idx} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                  </article>
                </TooltipProvider>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  The improved version of your response will appear here after
                  you submit it.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4!">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                Model feedback
              </CardTitle>
              <CardDescription>
                Detailed corrections and feedback from the model.
              </CardDescription>
              <CardAction>
                {result && (
                  <div className="text-right">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Overall Score
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {result.feedback.estimatedScore}
                      <span className="text-sm font-normal text-muted-foreground">
                        /5
                      </span>
                    </div>
                  </div>
                )}
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="h-px bg-linear-to-r from-primary/30 via-border to-transparent" />
              {result ? (
                <Tabs defaultValue="summary" className="mt-3">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="summary" className="text-xs">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="grammar" className="text-xs">
                      Grammar
                    </TabsTrigger>
                    <TabsTrigger value="wordchoice" className="text-xs">
                      Word Choice
                    </TabsTrigger>
                    <TabsTrigger value="typos" className="text-xs">
                      Typos
                    </TabsTrigger>
                    <TabsTrigger value="punctuation" className="text-xs">
                      Punctuation
                    </TabsTrigger>
                  </TabsList>
                  <div className="h-80 overflow-y-auto">
                    <TabsContent
                      value="summary"
                      className="mt-3 space-y-3 text-sm"
                    >
                      <p className="text-sm text-foreground">
                        {result.feedback.summary}
                      </p>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                            Strengths
                          </h3>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                            {result.feedback.strengths.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                            Improvements
                          </h3>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                            {result.feedback.improvements.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="grammar" className="mt-3">
                      {result.feedback.grammarCorrections &&
                      result.feedback.grammarCorrections.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                          {result.feedback.grammarCorrections.map(
                            (item, idx) => (
                              <li key={idx}>{item}</li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground md:text-sm">
                          No grammar corrections to display.
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="wordchoice" className="mt-3">
                      {result.feedback.wordChoiceImprovements &&
                      result.feedback.wordChoiceImprovements.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                          {result.feedback.wordChoiceImprovements.map(
                            (item, idx) => (
                              <li key={idx}>{item}</li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground md:text-sm">
                          No word choice improvements to display.
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="typos" className="mt-3">
                      {result.feedback.typoCorrections &&
                      result.feedback.typoCorrections.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                          {result.feedback.typoCorrections.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground md:text-sm">
                          No typo corrections to display.
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="punctuation" className="mt-3">
                      {result.feedback.punctuationCorrections &&
                      result.feedback.punctuationCorrections.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                          {result.feedback.punctuationCorrections.map(
                            (item, idx) => (
                              <li key={idx}>{item}</li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground md:text-sm">
                          No punctuation corrections to display.
                        </p>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  You will see model feedback here after you submit a response.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
