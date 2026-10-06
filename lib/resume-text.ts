import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const MAX_RESUME_BYTES = 3 * 1024 * 1024;
export const MAX_RESUME_CHARACTERS = 40000;

export class ResumeInputError extends Error {}

// Inspect the central directory before DOCX decompression. Reject ZIP64,
// oversized expanded documents, and malformed archives instead of exhausting memory.
function checkDocxArchive(buffer: Buffer) {
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0)
    throw new ResumeInputError(
      "This DOCX couldn’t be read. Export it as PDF or text and try again.",
    );
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  if (count > 200 || offset === 0xffffffff)
    throw new ResumeInputError(
      "This DOCX is too complex. Export a simpler resume as PDF or text.",
    );
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new ResumeInputError(
        "Invalid DOCX file. Export it again and retry.",
      );
    expanded += buffer.readUInt32LE(offset + 24);
    if (expanded > 10 * 1024 * 1024)
      throw new ResumeInputError(
        "This DOCX expands to more than 10 MB. Export a simpler resume.",
      );
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
}

export async function readResumeText(file: File) {
  if (!file.size || file.size > MAX_RESUME_BYTES)
    throw new ResumeInputError("Choose a non-empty resume under 3 MB.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!["pdf", "docx", "txt"].includes(extension ?? ""))
    throw new ResumeInputError("Upload a PDF, DOCX, or TXT resume.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (extension === "pdf") {
    if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-")))
      throw new ResumeInputError(
        "This file isn’t a valid PDF. Export it again and retry.",
      );
    let document;
    try {
      document = await getDocumentProxy(new Uint8Array(buffer));
      if (document.numPages > 15)
        throw new ResumeInputError("Use a resume of 15 pages or fewer.");
      text = (await extractText(document, { mergePages: true })).text;
    } catch (error) {
      if (error instanceof ResumeInputError) throw error;
      throw new ResumeInputError(
        "Couldn’t read this PDF. Try an unlocked PDF or a TXT version.",
      );
    } finally {
      await document?.loadingTask.destroy();
    }
  } else if (extension === "docx") {
    checkDocxArchive(buffer);
    try {
      text = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new ResumeInputError(
        "Couldn’t read this DOCX. Export it as PDF or text and retry.",
      );
    }
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new ResumeInputError("Use a UTF-8 TXT file, PDF, or DOCX.");
    }
  }
  text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (text.length < 80)
    throw new ResumeInputError(
      "There isn’t enough readable text. Scanned resumes need a text-based PDF or TXT version.",
    );
  if (text.length > MAX_RESUME_CHARACTERS)
    throw new ResumeInputError(
      "This resume has too much text. Use a shorter version under 40,000 characters.",
    );
  return text;
}
