import { EduShiftGrader } from "./core/grader";
import path from 'path';

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 4) {
        console.log("Usage: ts-node src/index.ts <target_label> <student_image_path> <answer_key_image_path> <problem_image_path>");
        process.exit(1);
    }

    const [targetLabel, studentImagePath, answerKeyImagePath, problemImagePath] = args;

    // Resolve absolute paths if relative are provided
    const absStudentPath = path.resolve(studentImagePath);
    const absAnswerKeyPath = path.resolve(answerKeyImagePath);
    const absProblemPath = path.resolve(problemImagePath);

    console.log(`Initializing EduShift AI...`);
    console.log(`Target: ${targetLabel}`);
    console.log(`Student Image: ${absStudentPath}`);
    console.log(`Answer Key Image: ${absAnswerKeyPath}`);
    console.log(`Problem Image: ${absProblemPath}`);

    try {
        const grader = new EduShiftGrader();
        console.log("Analyzing...");
        const result = await grader.gradeAnswer(targetLabel, absStudentPath, absAnswerKeyPath, absProblemPath);

        console.log("\n--- Result ---\n");
        console.log(JSON.stringify(result, null, 2));

    } catch (error: any) {
        console.error("Fatal Error:", error.message);
    }
}

main();
