export type PdfExtractionResult = {
    file: File;
    extracted: boolean;
};

export async function extractPdfPages(
    file: File,
    pageNumbers: number[]
): Promise<PdfExtractionResult> {
    if (file.type !== "application/pdf") {
        return { file, extracted: false };
    }

    const uniquePages = Array.from(
        new Set(pageNumbers.filter((page) => Number.isInteger(page) && page > 0))
    ).sort((a, b) => a - b);

    if (uniquePages.length === 0) {
        return { file, extracted: false };
    }

    try {
        const { PDFDocument } = await import("pdf-lib");
        const sourceBytes = await file.arrayBuffer();
        const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
        const totalPages = sourceDoc.getPageCount();

        const validPages = uniquePages.filter((page) => page <= totalPages);
        if (validPages.length === 0 || validPages.length === totalPages) {
            return { file, extracted: false };
        }

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(
            sourceDoc,
            validPages.map((page) => page - 1)
        );
        copiedPages.forEach((page) => newDoc.addPage(page));

        const newBytes = await newDoc.save();
        if (newBytes.byteLength >= sourceBytes.byteLength) {
            return { file, extracted: false };
        }

        const baseName = file.name.replace(/\.pdf$/i, "");
        const newName = `${baseName || "document"}-pages.pdf`;
        const newBuffer = new ArrayBuffer(newBytes.byteLength);
        new Uint8Array(newBuffer).set(newBytes);
        return { file: new File([newBuffer], newName, { type: "application/pdf" }), extracted: true };
    } catch (error) {
        console.warn("[PDF] Page extraction failed, using original PDF", error);
        return { file, extracted: false };
    }
}
