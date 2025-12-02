"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileTextIcon, SettingsIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aiProviders, type AIProviderId } from "@/lib/ai-providers";
import { countWords } from "@/lib/utils";
import React from "react";

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

const RESULT_STORAGE_KEY = "email-revision-result";
const RUBRIC_STORAGE_KEY = "email-ets-rubric";
const FORM_DATA_STORAGE_KEY = "email-form-data";

// Helper function to load form data from localStorage
function loadFormData() {
  if (typeof window === "undefined") {
    return {
      scenario: "",
      recipient: "",
      subject: "",
      emailBody: "",
    };
  }
  try {
    const raw = window.localStorage.getItem(FORM_DATA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        scenario?: string;
        recipient?: string;
        subject?: string;
        emailBody?: string;
      };
      return {
        scenario: parsed.scenario || "",
        recipient: parsed.recipient || "",
        subject: parsed.subject || "",
        emailBody: parsed.emailBody || "",
      };
    }
  } catch {
    // ignore parse errors
  }
  return {
    scenario: "",
    recipient: "",
    subject: "",
    emailBody: "",
  };
}

export default function EmailPage() {
  const formData = loadFormData();
  const [scenario, setScenario] = useState(formData.scenario);
  const [recipient, setRecipient] = useState(formData.recipient);
  const [subject, setSubject] = useState(formData.subject);
  const [emailBody, setEmailBody] = useState(formData.emailBody);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showWordCount, setShowWordCount] = useState(true);
  // Load settings from localStorage
  const loadSettings = () => {
    if (typeof window === "undefined") {
      return {
        aiProvider: "openai" as const,
        aiModel: "gpt-4o-mini",
        customPrompt: "",
      };
    }
    try {
      const raw = window.localStorage.getItem("email-ai-settings");
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
  };

  const settings = loadSettings();
  const [aiProvider, setAiProvider] = useState<AIProviderId>(
    settings.aiProvider
  );
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviseResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Default ETS rubric for "Write an Email"
  const defaultRubric = `Score 5 - A fully successful response
The response is effective, is clearly expressed, and shows consistent facility in the use of language.
A typical response displays the following:
- Elaboration that effectively supports the communicative purpose
- Effective syntactic variety and precise, idiomatic word choice
- Consistent use of appropriate social conventions (e.g., politeness, register, organization of information and formulation of actions such as requests, refusals, criticisms, etc.)
- Almost no lexical or grammatical errors other than those expected from a competent writer writing under timed conditions (e.g., common typos or common misspellings or substitutions like there/their)

Score 4 - A generally successful response
The response is mostly effective and easily understood. Language facility is adequate to the task.
A typical response displays the following:
- Adequate elaboration to support the communicative purpose
- Syntactic variety and appropriate word choice
- Mostly appropriate social conventions
- Few lexical or grammatical errors

Score 3 - A partially successful response
The response generally accomplishes the task. Limitations in language facility may prevent parts of the message from being fully clear and effective.
A typical response displays the following:
- Elaboration that partially supports the communicative purpose
- A moderate range of syntax and vocabulary
- Some noticeable errors in structure, word forms, use of idiomatic language and/or social conventions

Score 2 - A mostly unsuccessful response
The response reflects an attempt to address the task, but it is mostly ineffective. The message may be limited or difficult to interpret. A typical response exhibits one or more of the following:
- Limited or irrelevant elaboration
- Some connected sentence-level language, with a limited range of syntax and vocabulary
- An accumulation of errors in sentence structure and/or language use

Score 1 - An unsuccessful response
The response reflects an ineffective attempt to address the task. The message may be limited to the point of being unintelligible. A typical response exhibits one or more of the following:
- Very little elaboration, if any
- Telegraphic language (i.e., short and/or disconnected phrases and sentences) with a very limited range of vocabulary
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

  // Mark as loaded after initial render
  useEffect(() => {
    setHasLoaded(true);
  }, []);

  // Auto-save form data to localStorage whenever it changes (but not during initial render)
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoaded) return;
    try {
      const formDataToSave = {
        scenario,
        recipient,
        subject,
        emailBody,
      };
      window.localStorage.setItem(
        FORM_DATA_STORAGE_KEY,
        JSON.stringify(formDataToSave)
      );
    } catch {
      // ignore storage errors
    }
  }, [hasLoaded, scenario, recipient, subject, emailBody]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!emailBody || emailBody.trim().length < 20) {
      toast.error("Please write at least a few full sentences for your email.");
      return;
    }

    const combinedPrompt = [
      scenario && `Scenario: ${scenario}`,
      recipient && `Recipient: ${recipient}`,
      subject && `Subject: ${subject}`,
    ]
      .filter(Boolean)
      .join("\n");

    setLoading(true);
    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider,
          aiModel,
          customPrompt,
          response: emailBody,
          question: combinedPrompt,
          etsRubric: etsRubric,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to revise email.");
      }

      const data = (await res.json()) as ReviseResponse;
      setResult(data);
      toast.success("Email revised successfully");
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

  const wordCount = countWords(emailBody);

  const handleSaveSettings = () => {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        aiProvider,
        aiModel,
        customPrompt,
      };
      window.localStorage.setItem("email-ai-settings", JSON.stringify(payload));
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
    } catch (err) {
      toast.error("Failed to save rubric");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 lg:py-12">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Email writing playground
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Draft any academic or professional-style email and refine it using
              your own prompts and model settings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              className="h-8 w-8 cursor-pointer"
              onClick={() => setRubricOpen(true)}
              aria-label="Open ETS rubric"
              title="Edit ETS rubric"
            >
              <FileTextIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              className="h-8 w-8 cursor-pointer"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open AI settings"
              title="AI settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <Dialog open={rubricOpen} onOpenChange={setRubricOpen}>
          <DialogContent className="lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>ETS Rubric for Write an Email</DialogTitle>
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
          <DialogContent className="lg:max-w-5xl md:max-w-3xl border-0 bg-card p-0 shadow-2xl">
            <div className="flex h-full flex-col md:flex-row">
              {/* Left column: Scenario */}
              <div className="flex w-full flex-col gap-y-4 rounded-xl border border-border p-4 md:w-[40%]">
                <h2 className="text-base font-semibold">Scenario</h2>
                <div className="flex-1 overflow-y-auto text-sm leading-relaxed whitespace-break-spaces">
                  {scenario || (
                    <p className="text-muted-foreground">
                      No scenario provided
                    </p>
                  )}
                </div>
              </div>

              {/* Right column: Email editor */}
              <div className="flex w-full flex-col bg-background md:w-[60%]">
                <div className="px-4 flex flex-1 flex-col gap-2">
                  <h2 className="text-base font-semibold">Your Response</h2>
                  <div className="mb-4 space-y-3">
                    <div className="flex gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        To:
                      </Label>
                      <Input
                        value={recipient}
                        disabled
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder=""
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Subject:
                      </Label>
                      <Input
                        value={subject}
                        disabled
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder=""
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
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
                                  {wordCount}
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
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      readOnly
                      placeholder="Your response preview will appear here (read-only)."
                      className="h-72 w-full resize-none border border-input rounded-none rounded-b-lg px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/60"
                    />
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Scenario
              </Label>
              <Textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Provide the scenario..."
                className="min-h-[120px] text-sm"
              />
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  To
                </Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder=""
                  className="text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subject
                </Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder=""
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Your Response</Label>
              </div>
              <div className="relative">
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your email here..."
                  className="h-96 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
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
                    <Spinner />
                    Revising…
                  </>
                ) : (
                  <>Revise</>
                )}
              </Button>
            </div>
          </form>

          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                AI‑revised email
              </h2>
              <div className="mt-2 h-px bg-linear-to-r from-primary/40 via-border to-transparent" />
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
                  The improved version of your email will appear here after you
                  submit it.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Feedback on clarity & tone
              </h2>
              <div className="mt-2 h-px bg-linear-to-r from-primary/30 via-border to-transparent" />
              {result ? (
                <div className="mt-3 space-y-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Overall comment
                  </p>
                  <p className="text-sm text-foreground">
                    {result.feedback.summary}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                        What you did well
                      </h3>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                        {result.feedback.strengths.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                        How to improve
                      </h3>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground md:text-sm">
                        {result.feedback.improvements.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  You will see feedback on clarity, politeness, and tone here
                  after you submit an email.
                </p>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
