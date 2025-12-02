"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 md:px-8 lg:py-14">
        <header className="space-y-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            TOEFL writing prompt playground
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Use these tools to experiment with prompts, providers, and models
            for revising TOEFL-style emails and academic discussion responses.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <Link
            href="/email"
            className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:bg-accent/40"
          >
            <div className="space-y-3">
              <h2 className="text-lg font-semibold md:text-xl">
                Write an Email
              </h2>
              <p className="text-sm text-muted-foreground">
                Draft or paste emails to professors or offices and iterate on AI
                prompts, providers, and models that rewrite them.
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-fit text-xs">
              Get started...
            </Button>
          </Link>

          <Link
            href="/academic"
            className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:bg-accent/40"
          >
            <div className="space-y-3">
              <h2 className="text-lg font-semibold md:text-xl">
                Write for an Academic Discussion
              </h2>
              <p className="text-sm text-muted-foreground">
                Paste academic-style discussion responses and try different
                revision prompts and models before shipping them to production.
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-fit text-xs">
              Get started...
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
