# pi-sam Header Logo Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current small symbol header with a compact block-style text logo while keeping existing startup metadata and rendering behavior.

**Architecture:** Keep the existing branding extension lifecycle intact (`session_start` + `setHeader`) and only replace the static header line content returned by `getPiSamHeaderLines()`. Add a focused test that validates compact size/style constraints so future edits do not regress visual intent.

**Tech Stack:** TypeScript, Node test runner (`node:test`), existing extension module (`src/extensions/branding-header.ts`).

---

### Task 1: Add failing test for compact block logo constraints

**Files:**
- Modify: `src/extensions/branding-header.test.ts`
- Test: `src/extensions/branding-header.test.ts`

**Step 1: Write the failing test**

```ts
it("compact 블록형 로고 제약을 만족해야 한다", () => {
  const lines = getPiSamHeaderLines("0.1.0");
  const logoLines = lines.slice(0, 3);

  assert.equal(logoLines.length, 3);
  assert.ok(logoLines.every((line) => line.length <= 28), "로고 폭은 28자 이하여야 함");
  assert.ok(logoLines.some((line) => line.includes("█") || line.includes("▀")), "블록 문자 포함 필요");
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/extensions/branding-header.test.ts`
Expected: FAIL (현재 로고가 새 compact 블록 제약을 만족하지 않음)

**Step 3: Commit**

```bash
git add src/extensions/branding-header.test.ts
git commit -m "test: add compact block logo constraints for header"
```

---

### Task 2: Implement compact block text logo in branding header

**Files:**
- Modify: `src/extensions/branding-header.ts`
- Test: `src/extensions/branding-header.test.ts`

**Step 1: Replace header lines with compact block logo**

```ts
export function getPiSamHeaderLines(version: string): string[] {
  return [
    "  █▀█ █ █▄▄ █ ▄▀ █▀ ▄▀▄ █▄ ▄█",
    "  █▀▀ █ █▄█ █▀▄  █ █▀█ █ ▀ █",
    "  ▀   ▀ ▀   ▀ ▀ ▀▀ ▀ ▀ ▀   ▀",
    "   pi-sam",
    `   /help · /model · /resume  v${version}`,
  ];
}
```

(문자열은 실제 렌더 확인 후 폭 20~28 기준으로 미세 조정)

**Step 2: Keep color mapping compatible with line structure**

```ts
return lines.map((line, index) => {
  if (index <= 2) return theme.fg("accent", line);
  if (index === 3) return theme.fg("accent", theme.bold(line));
  return theme.fg("muted", line);
});
```

**Step 3: Run test to verify it passes**

Run: `node --import tsx --test src/extensions/branding-header.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/extensions/branding-header.ts src/extensions/branding-header.test.ts
git commit -m "feat: refresh pi-sam startup header with compact block logo"
```

---

### Task 3: Full verification and visual smoke check

**Files:**
- Verify only (no required file changes)

**Step 1: Run build + tests**

Run: `npm run build && node --import tsx --test src/extensions/branding-header.test.ts`
Expected: PASS

**Step 2: Manual TUI smoke check**

Run: `npm run dev`
Expected:
- 헤더 상단이 compact 블록형 텍스트 로고로 표시
- `pi-sam` 라인과 `/help · /model · /resume  v<version>` 라인 유지
- 줄바꿈/깨짐 없이 1화면 내 표시

**Step 3: Commit final polish if needed**

```bash
git add -A
git commit -m "chore: verify pi-sam header logo refresh"
```
