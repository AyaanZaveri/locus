"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { motion } from "motion/react";
import { ArrowUpIcon, LensConcaveIcon, SquareIcon } from "lucide-react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * Presentational chat launcher. A future AI SDK integration can own the input
 * state and submit behavior without changing this shell.
 */
export function LocusChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const sessionId = useRef<string | null>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }

      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function getSessionId() {
    sessionId.current ??= crypto.randomUUID();
    return sessionId.current;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;

    sendMessage({ text }, { body: { sessionId: getSessionId() } });
    setInput("");
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center">
        {isOpen ? (
          <section
            aria-label="Ask Locus"
            className="mb-3 w-full rounded-xl! bg-background/85 p-2 text-popover-foreground shadow-2xl shadow-emerald-500/15 ring-1 ring-border/50 backdrop-blur-sm dark:bg-background/75"
          >
            {(messages.length > 0 || error) && (
              <div className="mb-3 h-fit max-h-72 space-y-3 overflow-y-auto px-1 py-2">
                {messages.map((message, index) => {
                  const text = message.parts
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("");
                  const hasPendingToolCall = message.parts.some(
                    (part) =>
                      isToolUIPart(part) &&
                      (part.state === "input-streaming" ||
                        part.state === "input-available" ||
                        part.state === "approval-requested" ||
                        part.state === "approval-responded"),
                  );
                  const isShortUserMessage =
                    message.role === "user" &&
                    text.length <= 48 &&
                    !text.includes("\n");

                  if (!text && !hasPendingToolCall) return null;

                  return (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className={
                        message.role === "user"
                          ? `ml-auto w-fit max-w-[80%] bg-emerald-500/10 px-3 py-1.5 text-emerald-950 backdrop-blur-sm dark:bg-emerald-400/10 dark:text-emerald-100 ${isShortUserMessage ? "rounded-full" : "rounded-2xl"}`
                          : "mr-auto w-fit max-w-[90%] px-3 py-2 text-foreground"
                      }
                      initial={{ opacity: 0, y: 10 }}
                      key={message.id}
                      transition={{ delay: index * 0.05 }}
                    >
                      {text ? (
                        message.role === "assistant" ? (
                          <Streamdown
                            animated={false}
                            className="break-words text-[15px] leading-6 [&>*]:first:mt-0 [&>*]:last:mb-0 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_p]:my-2 [&_pre]:text-sm [&_table]:text-sm"
                            mode={
                              isBusy && index === messages.length - 1
                                ? "streaming"
                                : "static"
                            }
                          >
                            {text}
                          </Streamdown>
                        ) : (
                          <p className="break-words whitespace-pre-wrap text-[15px] leading-6">
                            {text}
                          </p>
                        )
                      ) : null}
                      {hasPendingToolCall ? (
                        <p className="mt-1 text-xs font-medium">
                          <span
                            className="bg-clip-text text-transparent"
                            style={{
                              backgroundImage:
                                "linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer-text 1.4s linear infinite",
                            }}
                          >
                            Looking through Locus…
                          </span>
                        </p>
                      ) : null}
                    </motion.div>
                  );
                })}
                {error ? (
                  <p className="px-2 text-sm text-destructive" role="alert">
                    {error.message}
                  </p>
                ) : null}
              </div>
            )}
            <form onSubmit={submit}>
              <InputGroup className="h-10! rounded-lg! border-transparent bg-transparent shadow-none! ring-0 focus-within:border-transparent focus-within:ring-0 has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-transparent! has-[[data-slot=input-group-control]:focus-visible]:ring-0! dark:bg-transparent dark:has-disabled:bg-transparent">
                <LensConcaveIcon
                  aria-hidden="true"
                  className="ml-2 size-5 shrink-0 stroke-[1.5] text-muted-foreground"
                />
                <InputGroupInput
                  aria-label="Message Locus"
                  autoFocus
                  className="text-base!"
                  disabled={isBusy}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about a company, person, or role…"
                  value={input}
                />
                <InputGroupButton
                  aria-label={isBusy ? "Stop response" : "Send message"}
                  className="mr-1"
                  disabled={!isBusy && !input.trim()}
                  size="icon-sm"
                  type={isBusy ? "button" : "submit"}
                  onClick={isBusy ? stop : undefined}
                >
                  {isBusy ? (
                    <SquareIcon className="fill-current size-5" />
                  ) : (
                    <ArrowUpIcon className="size-5" />
                  )}
                </InputGroupButton>
              </InputGroup>
            </form>
          </section>
        ) : null}

        {!isOpen ? (
          <Button
            aria-expanded={isOpen}
            aria-keyshortcuts="Meta+J Control+J"
            className="h-9 rounded-full border bg-background! px-3.5 shadow-lg shadow-emerald-500/5 hover:bg-muted"
            onClick={() => setIsOpen(true)}
            type="button"
            variant="outline"
          >
            <LensConcaveIcon
              aria-hidden="true"
              className="size-4 stroke-[1.5]"
            />
            <span>Locus Focus</span>
            <KbdGroup className="ml-1 hidden sm:inline-flex">
              <Kbd>⌘</Kbd>
              <Kbd>J</Kbd>
            </KbdGroup>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
