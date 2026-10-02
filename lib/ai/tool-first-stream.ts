import type { UIMessageChunk } from "ai";

/**
 * Tool traces replace the first-step preamble. Buffer it until we know whether
 * that step calls a tool; preserve it for text-only answers and on stream errors.
 * Subsequent findings stream normally. No phrase matching or prose rewriting.
 */
export function toolFirstStream() {
  let deciding = true;
  let calledTool = false;
  let pending: UIMessageChunk[] = [];
  const droppedIds = new Set<string>();
  const flushText = (
    controller: TransformStreamDefaultController<UIMessageChunk>,
  ) => {
    for (const chunk of pending) controller.enqueue(chunk);
    pending = [];
  };
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      const text =
        chunk.type === "text-start" ||
        chunk.type === "text-delta" ||
        chunk.type === "text-end";
      if (text && droppedIds.has(chunk.id)) {
        if (chunk.type === "text-end") droppedIds.delete(chunk.id);
        return;
      }
      if (deciding && text) {
        pending.push(chunk);
        return;
      }
      if (
        deciding &&
        (chunk.type === "tool-input-start" ||
          chunk.type === "tool-input-available" ||
          chunk.type === "tool-input-error")
      ) {
        calledTool = true;
        for (const part of pending) {
          if (part.type === "text-start" || part.type === "text-delta")
            droppedIds.add(part.id);
          if (part.type === "text-end") droppedIds.delete(part.id);
        }
        pending = [];
        deciding = false;
      }
      if (
        deciding &&
        (chunk.type === "finish-step" ||
          chunk.type === "finish" ||
          chunk.type === "error" ||
          chunk.type === "abort")
      ) {
        flushText(controller);
        deciding = false;
      }
      controller.enqueue(chunk);
    },
    flush(controller) {
      if (!calledTool) flushText(controller);
    },
  });
}
