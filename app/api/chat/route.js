import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function readFilesRecursively(dir, baseDir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (
      stat.isDirectory() &&
      !fullPath.includes("node_modules") &&
      !fullPath.includes(".next")
    ) {
      readFilesRecursively(fullPath, baseDir, allFiles);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      const relativePath = path.relative(baseDir, fullPath);
      allFiles.push({
        path: relativePath,
        content: fs.readFileSync(fullPath, "utf-8"),
      });
    }
  }
  return allFiles;
}

const projectRoot = process.cwd();
const projectFiles = readFilesRecursively(projectRoot, projectRoot);

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1].content;

    // Select first few files (can upgrade with embeddings later)
    const context = projectFiles
      .slice(0, 5)
      .map(f => `File: ${f.path}\n${f.content}`)
      .join("\n\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
You are the AI assistant for a project called **SageAI**.
Always refer to the project by its name ("SageAI") instead of just "Next.js project".
Use the provided project files as context to answer user questions.
`;

    const prompt = `
${systemPrompt}

Project files:
${context}

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

Answer the user's latest question:
${userMessage}
`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json({ reply: "⚠️ Error: Gemini API request failed." });
  }
}
