import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { clearPageHintsAfterAutoSplit, resolveAutoDocumentRoles, type ClassificationResponse } from "./documentRoleClassifier";

async function makePdf(pageCount: number): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    for (let index = 0; index < pageCount; index += 1) {
        pdf.addPage([200 + index, 300 + index]);
    }
    return Buffer.from(await pdf.save());
}

const page = (
    source_index: number,
    pageNumber: number,
    roles: Array<"answer" | "problem" | "model" | "other">,
    confidence = 0.95
) => ({
    source_index,
    page: pageNumber,
    roles,
    confidence,
    reason: "visual evidence",
    answer_isolation: roles.includes("answer") ? "clear" as const : "not_applicable" as const,
});

test("generic shuffled files are classified from runner output and manual files bypass classification", async () => {
    let calls = 0;
    const files = [
        { buffer: Buffer.from("printed problem"), mimeType: "image/png", name: "scan-c.png", role: "auto" },
        { buffer: Buffer.from("manual"), mimeType: "image/png", name: "fixed.png", role: "model" },
        { buffer: Buffer.from("handwriting"), mimeType: "image/png", name: "scan-a.png", role: "auto" },
    ];
    const result = await resolveAutoDocumentRoles(files, async sources => {
        calls += 1;
        assert.equal(sources.length, 2);
        assert.equal("name" in sources[0], false);
        return { pages: [page(0, 1, ["problem"]), page(1, 1, ["answer"])] } satisfies ClassificationResponse;
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.map(file => file.role), ["model", "problem", "answer"]);

    calls = 0;
    const manual = files.filter(file => file.role !== "auto");
    assert.equal(await resolveAutoDocumentRoles(manual, async () => { calls += 1; return { pages: [] }; }), manual);
    assert.equal(calls, 0);
});

test("manual answers satisfy the answer requirement and stale PDF hints are cleared only after auto splitting", async () => {
    const files = [
        { buffer: Buffer.from("handwriting"), mimeType: "image/png", name: "fixed.png", role: "answer" },
        { buffer: Buffer.from("printed problem"), mimeType: "image/png", name: "scan.png", role: "auto" },
    ];
    const result = await resolveAutoDocumentRoles(files, async () => ({ pages: [page(0, 1, ["problem"])] }));
    assert.deepEqual(result.map(file => file.role), ["answer", "problem"]);

    const hints = { answerPage: "3", problemPage: "1-2" };
    assert.equal(clearPageHintsAfterAutoSplit(true, hints), null);
    assert.equal(clearPageHintsAfterAutoSplit(false, hints), hints);
});

test("mixed PDF pages are physically grouped by role without dropping pages", async () => {
    const sourcePdf = await makePdf(4);
    const result = await resolveAutoDocumentRoles(
        [{ buffer: sourcePdf, mimeType: "application/pdf", name: "document.pdf", role: "auto" }],
        async () => ({ pages: [
            page(0, 4, ["model"]),
            page(0, 3, ["answer", "problem"]),
            page(0, 1, ["problem"]),
            page(0, 2, ["answer"]),
        ] })
    );
    const counts = new Map<string | undefined, number>();
    for (const part of result) {
        const pdf = await PDFDocument.load(part.buffer);
        counts.set(part.role, pdf.getPageCount());
        if (part.role === "answer") {
            assert.deepEqual(pdf.getPages().map(pdfPage => pdfPage.getSize().width), [201, 202]);
        }
    }
    assert.deepEqual(Object.fromEntries(counts), { answer: 2, problem: 2, model: 1 });
});

test("malformed, missing, and duplicate page results fail closed", async () => {
    const files = [{ buffer: await makePdf(2), mimeType: "application/pdf", name: "x.pdf", role: "auto" }];
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ nope: [] })), /解析できません/);
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [page(0, 1, ["answer"])] })), /確認できなかったページ/);
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [page(0, 1, ["answer"]), page(0, 1, ["problem"])] })), /重複ページ/);
});

test("uncertainty, missing answers, and ambiguous answer/model pages are actionable errors", async () => {
    const files = [{ buffer: Buffer.from("image"), mimeType: "image/png", name: "x.png", role: "auto" }];
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [page(0, 1, ["answer"], 0.2)] })), /十分な確信度/);
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [page(0, 1, ["problem"])] })), /答案を検出できません/);
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [{ ...page(0, 1, ["answer", "model"]), answer_isolation: "ambiguous" }] })), /安全に区別できません/);
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [{ ...page(0, 1, ["answer"]), answer_isolation: "not_applicable" }] })), /安全に区別できません/);
    await assert.rejects(resolveAutoDocumentRoles(files, async () => ({ pages: [{ ...page(0, 1, ["problem"]), answer_isolation: "clear" }] })), /識別情報と役割が一致しません/);
});

test("timeout and provider errors propagate as sanitized actionable errors", async () => {
    const files = [{ buffer: Buffer.from("image"), mimeType: "image/png", name: "x.png", role: "auto" }];
    await assert.rejects(
        resolveAutoDocumentRoles(files, async () => new Promise(() => undefined), { timeoutMs: 5 }),
        /タイムアウト/
    );
    await assert.rejects(
        resolveAutoDocumentRoles(files, async () => { throw new Error("secret provider payload"); }),
        error => error instanceof Error && /自動分類に失敗/.test(error.message) && !error.message.includes("secret provider payload")
    );
});
