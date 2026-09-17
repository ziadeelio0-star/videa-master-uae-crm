import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Static analysis invariant: forbid nested anchor tags in the client.
 *
 * In wouter, <Link> renders an internal <a>. Wrapping a <Button> (which renders <button>
 * but inside Radix/shadcn primitives can render <a>) — or nesting another <a> directly —
 * inside a Link causes a runtime "validateDOMNesting(<a> cannot be a descendant of <a>)"
 * warning and breaks navigation in some browsers.
 *
 * Rule enforced here:
 *   - No <Link ...> ... <Button ...> ... </Button> ... </Link>
 *   - No <Link ...> ... <a ...> ... </a> ... </Link>
 *
 * If you need a button-styled navigation control, use programmatic navigation via
 * `const [, setLocation] = useLocation();` and `<Button onClick={() => setLocation(href)}>`.
 */

const CLIENT_SRC = join(process.cwd(), "client", "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // skip generated/asset folders
      if (name === "node_modules" || name === "dist" || name === "build") continue;
      walk(full, acc);
    } else if (/\.(tsx|jsx)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

// Match a <Link ...> ... </Link> block (non-greedy, dot-all) and look for nested
// <Button ...> or a bare <a ...> inside it.
const LINK_BLOCK_RE = /<Link\b[^>]*>([\s\S]*?)<\/Link>/g;
const FORBIDDEN_INSIDE_RE = /<(Button|a)\b/;

describe("no nested anchors in client JSX", () => {
  const files = walk(CLIENT_SRC);

  it("scans at least a handful of client files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("does not wrap <Button> or <a> inside <Link>", () => {
    const offenders: { file: string; snippet: string }[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      LINK_BLOCK_RE.lastIndex = 0;
      while ((m = LINK_BLOCK_RE.exec(src)) !== null) {
        const inner = m[1];
        if (FORBIDDEN_INSIDE_RE.test(inner)) {
          offenders.push({
            file: file.replace(process.cwd() + "/", ""),
            snippet: m[0].slice(0, 200).replace(/\s+/g, " "),
          });
        }
      }
    }

    if (offenders.length > 0) {
      const msg = offenders
        .map((o) => `  - ${o.file}: ${o.snippet}`)
        .join("\n");
      throw new Error(
        `Found ${offenders.length} nested anchor offender(s). ` +
          `Use useLocation()/setLocation() instead of wrapping Button/a in Link:\n${msg}`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
