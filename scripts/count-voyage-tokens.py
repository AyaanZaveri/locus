#!/usr/bin/env -S uv run --with tokenizers --with huggingface-hub python
"""Count Voyage 4 Large tokens locally; reads/writes one JSON document on stdio."""

import json
import sys

MODEL = "voyageai/voyage-4-large"
DOCUMENT_PROMPT = "Represent the document for retrieval: "


def main() -> None:
    from tokenizers import Tokenizer
    from huggingface_hub import HfApi

    payload = json.load(sys.stdin)
    texts = payload.get("texts") if isinstance(payload, dict) else None
    if not isinstance(texts, list) or any(not isinstance(text, str) for text in texts):
        raise ValueError('input must be JSON object {"texts": [string, ...]}')

    revision = HfApi().model_info(MODEL).sha
    tokenizer = Tokenizer.from_pretrained(MODEL, revision=revision)
    tokenizer.no_truncation()
    tokenizer.no_padding()
    counts = [len(encoded.ids) for encoded in tokenizer.encode_batch(texts, add_special_tokens=False)]
    result = {
        "model": MODEL,
        "counts": counts,
        "documentPromptTokens": len(tokenizer.encode(DOCUMENT_PROMPT, add_special_tokens=False).ids),
        "revision": revision,
        "maxTokens": max(counts, default=0),
        "totalTokens": sum(counts),
    }
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
