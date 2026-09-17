import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { ClassificationRunner } from "./documentRoleClassifier";

async function makePdf(pageCount: number): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    for (let index = 0; index < pageCount; index += 1) pdf.addPage([200 + index, 300 + index]);
    return Buffer.from(await pdf.save());
}

async function loadGrader() {
    process.env.GEMINI_API_KEY ||= "test-only-key";
    return import("./grader");
}

test("public OCR entry clears stale hints, isolates answer pages, and classifies shared files once", async () => {
    const { TaskalGrader } = await loadGrader();
    const grader = new TaskalGrader();
    let classificationCalls = 0;
    const runner: ClassificationRunner = async () => {
        classificationCalls += 1;
        return {
            pages: [
                { source_index: 0, page: 3, roles: ["model"], confidence: 0.99, reason: "printed solution", answer_isolation: "not_applicable" },
                { source_index: 0, page: 1, roles: ["problem"], confidence: 0.99, reason: "question", answer_isolation: "not_applicable" },
                { source_index: 0, page: 2, roles: ["answer"], confidence: 0.99, reason: "handwriting", answer_isolation: "clear" },
            ],
        };
    };
    Reflect.set(grader, "runDocumentRoleClassification", runner);

    let ocrCalls = 0;
    Reflect.set(grader, "performOcr", async (...args: unknown[]) => {
        ocrCalls += 1;
        const categorized = args[2] as {
            studentFiles: Array<{ buffer: Buffer }>;
            problemFiles: unknown[];
            modelAnswerFiles: unknown[];
            otherFiles: unknown[];
        };
        assert.equal(args[3], null);
        assert.equal(categorized.studentFiles.length, 1);
        assert.equal(categorized.problemFiles.length, 1);
        assert.equal(categorized.modelAnswerFiles.length, 1);
        assert.equal(categorized.otherFiles.length, 0);
        assert.equal((await PDFDocument.load(categorized.studentFiles[0].buffer)).getPageCount(), 1);
        return { text: "答案", fullText: "答案", matchedTarget: true };
    });

    const files = [{
        buffer: await makePdf(3),
        mimeType: "application/pdf",
        name: "generic.pdf",
        role: "auto" as const,
    }];
    await Promise.all([
        grader.performOcrOnly("問1", files, { answerPage: "3" }),
        grader.performOcrOnly("問2", files, { answerPage: "3" }),
    ]);
    assert.equal(classificationCalls, 1);
    assert.equal(ocrCalls, 2);
});

test("confirmed-text grading accepts a manual answer with an auto-classified problem", async () => {
    const { TaskalGrader } = await loadGrader();
    const grader = new TaskalGrader();
    Reflect.set(grader, "runDocumentRoleClassification", (async () => ({
        pages: [{
            source_index: 0,
            page: 1,
            roles: ["problem"],
            confidence: 0.99,
            reason: "printed question",
            answer_isolation: "not_applicable",
        }],
    })) satisfies ClassificationRunner);
    Reflect.set(grader, "executeGradingWithText", async (...args: unknown[]) => {
        assert.equal(args[3], null);
        return { status: "success" };
    });

    const result = await grader.gradeWithConfirmedText("問1", "確認済み答案", [
        { buffer: Buffer.from("answer"), mimeType: "image/png", name: "manual.png", role: "answer" },
        { buffer: Buffer.from("problem"), mimeType: "image/png", name: "auto.png", role: "auto" },
    ], { problemPage: "9" });
    assert.deepEqual(result, { status: "success" });
});
