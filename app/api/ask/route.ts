import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { memory, question, flashcardMode, quizMode, count = 10, difficulty = "medium" } =
      await req.json();

    let prompt = "";

    // -----------------------------
    // FLASHCARD MODE
    // -----------------------------
    if (flashcardMode) {
      prompt = `
You are a flashcard generator.

Using ONLY the memory below, generate EXACTLY ${count} high‑quality flashcards with ${difficulty} difficulty level.

Each flashcard MUST follow this JSON format:
{
  "front": "question or term",
  "back": "clear, concise answer",
  "difficulty": "${difficulty}"
}

Rules:
- Return ONLY a valid JSON array.
- Do NOT include commentary.
- Do NOT shorten the list.
- Do NOT add extra fields.
- Ensure the JSON is valid and parseable.

Memory:
${memory}
      `;
    }

    // -----------------------------
    // QUIZ MODE
    // -----------------------------
    else if (quizMode) {
      prompt = `
You are a quiz generator.

Using ONLY the memory below, generate EXACTLY ${count} multiple‑choice questions with ${difficulty} difficulty level.

Each question MUST follow this JSON format:
{
  "question": "string",
  "choices": ["Full text of choice 1", "Full text of choice 2", "Full text of choice 3", "Full text of choice 4"],
  "correctIndex": 0,
  "explanation": "string"
}

Rules:
- Return ONLY a valid JSON array.
- Do NOT include commentary.
- Do NOT shorten the list.
- Do NOT add extra fields.
- The "choices" array must contain the FULL TEXT of each answer option, NOT just letters like "A", "B", "C", "D".
- Ensure the JSON is valid and parseable.

Memory:
${memory}
      `;
    }

    // -----------------------------
    // NORMAL ANSWER MODE
    // -----------------------------
    else {
      prompt = `
You are a study assistant. Use the memory below to answer the question clearly and helpfully.

Memory:
${memory}

Question:
${question}
      `;
    }

    // -----------------------------
    // CALL GROQ
    // -----------------------------
    const aiRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: flashcardMode || quizMode ? 0.2 : 0.5,
        }),
      }
    );

    const data = await aiRes.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message },
        { status: 500 }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI returned no content." },
        { status: 500 }
      );
    }

    // -----------------------------
    // FLASHCARD MODE RESPONSE
    // -----------------------------
    if (flashcardMode) {
      try {
        const cards = JSON.parse(content);
        return NextResponse.json({ flashcards: cards });
      } catch (err) {
        return NextResponse.json(
          { error: "Failed to parse flashcards JSON." },
          { status: 500 }
        );
      }
    }

    // -----------------------------
    // QUIZ MODE RESPONSE
    // -----------------------------
    if (quizMode) {
      try {
        const quiz = JSON.parse(content);
        return NextResponse.json({ quiz });
      } catch (err) {
        return NextResponse.json(
          { error: "Failed to parse quiz JSON." },
          { status: 500 }
        );
      }
    }

    // -----------------------------
    // NORMAL ANSWER MODE
    // -----------------------------
    return NextResponse.json({ answer: content });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}