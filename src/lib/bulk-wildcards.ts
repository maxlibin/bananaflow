export type WildcardExpansion = {
  prompts: string[];
  count: number;
  truncated: boolean;
};

type Token =
  | { kind: "literal"; value: string }
  | { kind: "group"; options: string[] };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let buf = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (
      ch === "\\" &&
      i + 1 < input.length &&
      (input[i + 1] === "{" || input[i + 1] === "}")
    ) {
      buf += input[i + 1];
      i += 2;
      continue;
    }
    if (ch === "{") {
      if (buf.length > 0) {
        tokens.push({ kind: "literal", value: buf });
        buf = "";
      }
      let j = i + 1;
      let inner = "";
      while (j < input.length && input[j] !== "}") {
        if (input[j] === "{" && !(input[j - 1] === "\\")) {
          throw new Error("nested braces are not supported");
        }
        if (
          input[j] === "\\" &&
          j + 1 < input.length &&
          (input[j + 1] === "{" || input[j + 1] === "}")
        ) {
          inner += input[j + 1];
          j += 2;
          continue;
        }
        inner += input[j];
        j++;
      }
      if (j >= input.length) {
        throw new Error("unclosed wildcard brace");
      }
      const options = inner.split("|");
      tokens.push({ kind: "group", options });
      i = j + 1;
      continue;
    }
    if (ch === "}") {
      throw new Error("unexpected closing brace");
    }
    buf += ch;
    i++;
  }
  if (buf.length > 0) tokens.push({ kind: "literal", value: buf });
  return tokens;
}

export function expandWildcards(
  input: string,
  maxExpansion: number,
): WildcardExpansion {
  const tokens = tokenize(input);

  let prompts: string[] = [""];
  for (const token of tokens) {
    if (token.kind === "literal") {
      prompts = prompts.map((p) => p + token.value);
    } else {
      const next: string[] = [];
      for (const p of prompts) {
        for (const opt of token.options) {
          next.push(p + opt);
        }
      }
      prompts = next;
    }
  }

  const count = prompts.length;
  if (count > maxExpansion) {
    return { prompts: prompts.slice(0, maxExpansion), count, truncated: true };
  }
  return { prompts, count, truncated: false };
}
