"use client";

import { useEffect, useRef } from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { RichTextEditor } from "@/components/editor/rte-text-editor";
import { Skeleton } from "@/components/ui/skeleton";
import {
  backgroundDocumentFromMarkdown,
  profileBackgroundExtensions,
} from "@/lib/profile-background-editor";
import { MAX_PROFILE_BACKGROUND_CHARACTERS } from "@/lib/user-profile";
import "@/components/editor/style.css";

export function ProfileBackgroundEditor({
  value,
  document,
  disabled = false,
  onChange,
}: {
  value: string;
  document: unknown;
  disabled?: boolean;
  onChange: (markdown: string, document: JSONContent) => void;
}) {
  const latest = useRef(onChange);
  latest.current = onChange;
  const lastEmitted = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...profileBackgroundExtensions(),
      Placeholder.configure({
        placeholder:
          "Share your experience, projects, education, or anything else that tells your story…",
      }),
    ],
    content: document
      ? (document as JSONContent)
      : backgroundDocumentFromMarkdown(value),
    contentType: "json",
    editable: !disabled,
    editorProps: {
      attributes: {
        id: "about",
        role: "textbox",
        "aria-label": "Your blueprint",
        "aria-multiline": "true",
        class: "soul-background-writing",
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();
      lastEmitted.current = markdown;
      latest.current(markdown, editor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    editor.commands.setContent(
      document
        ? (document as JSONContent)
        : backgroundDocumentFromMarkdown(value),
      {
        contentType: "json",
        emitUpdate: false,
      },
    );
    lastEmitted.current = value;
  }, [editor, value, document]);

  const tooLong = value.length > MAX_PROFILE_BACKGROUND_CHARACTERS;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {editor ? (
        <RichTextEditor
          editor={editor}
          editable={!disabled}
          className="soul-background-editor"
          variant="compact"
        >
          <RichTextEditor.Toolbar>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.H2 />
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content />
        </RichTextEditor>
      ) : (
        <Skeleton className="h-48 w-full rounded-lg" />
      )}
      {tooLong && (
        <p role="alert" className="text-sm text-destructive">
          Keep your background under{" "}
          {MAX_PROFILE_BACKGROUND_CHARACTERS.toLocaleString()} characters.
        </p>
      )}
    </div>
  );
}
