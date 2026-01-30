"use client";

import React, { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import FlashcardViewer from "@/app/study/FlashcardViewer";

// Type definitions
interface Flashcard {
  front: string;
  back: string;
  difficulty: string;
}

interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export default function StudyPage() {
  const { data: session } = useSession();

  const [uploadedText, setUploadedText] = useState("");
  const [question, setQuestion] = useState("");

  // Modes: "answer" | "flashcards" | "quiz"
  const [mode, setMode] = useState("answer");

  const [answer, setAnswer] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);

  // Quiz state variables
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Flashcard state variables
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  // Generation options modal state
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);
  const [generateDifficulty, setGenerateDifficulty] = useState("medium");
  const [showOptionsSidebar, setShowOptionsSidebar] = useState(false);

  // Loading states
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load Google API script for Picker
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => console.log("Google API loaded");
    document.body.appendChild(script);
  }, []);

  // Open Google Drive Picker
  const openPicker = () => {
    if (!session?.accessToken) {
      alert("Please sign in with Google first.");
      return;
    }

    (window as any).gapi.load("picker", () => {
      const view = new (window as any).google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const picker = new (window as any).google.picker.PickerBuilder()
        .setOAuthToken(session.accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
        .addView(view)
        .setCallback(async (data: any) => {
          if (data.action === "picked") {
            const fileId = data.docs[0].id;
            
            setIsImporting(true);

            try {
              const res = await fetch("/api/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId }),
              });

              const result = await res.json();

              if (result.error) {
                alert("Import failed: " + result.error);
                setIsImporting(false);
                return;
              }

              setUploadedText((prev) => prev + "\n\n" + result.text);
              setIsImporting(false);
            } catch (error) {
              alert("Import failed: Network error");
              setIsImporting(false);
            }
          }
        })
        .build();

      picker.setVisible(true);
    });
  };

  // Ask AI (supports all 3 modes)
  const handleAsk = async () => {
    setAnswer("");
    setIsGenerating(true);
    
    // Don't reset if we're adding more cards/questions
    const isAddingMore = showGenerateOptions || showOptionsSidebar;
    
    if (!isAddingMore) {
      setFlashcards([]);
      setQuiz([]);
      
      // Reset quiz state when generating new quiz
      setCurrentQuestion(0);
      setSelectedChoice(null);
      setShowExplanation(false);
      setScore(0);
      setQuizFinished(false);

      // Reset flashcard state when generating new flashcards
      setCurrentCard(0);
      setIsFlipped(false);
      setReviewMode(false);
    }

    setShowGenerateOptions(false);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory: uploadedText,
          question,
          flashcardMode: mode === "flashcards",
          quizMode: mode === "quiz",
          count: generateCount,
          difficulty: generateDifficulty,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setAnswer("Error: " + data.error);
        setIsGenerating(false);
        return;
      }

      if (mode === "flashcards" && data.flashcards) {
        // Add to existing flashcards if adding more
        setFlashcards((prev) => isAddingMore ? [...prev, ...data.flashcards] : data.flashcards);
        setShowOptionsSidebar(true);
      } else if (mode === "quiz" && data.quiz) {
        // Add to existing quiz if adding more
        setQuiz((prev) => isAddingMore ? [...prev, ...data.quiz] : data.quiz);
        setShowOptionsSidebar(true);
      } else {
        setAnswer(data.answer);
      }
      
      setIsGenerating(false);
    } catch (error) {
      setAnswer("Error: Network error occurred");
      setIsGenerating(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
        
        .chat-message {
          animation: slideUp 0.3s ease-out;
        }
        
        .glass {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .glass-dark {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .hover-lift {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        /* AdSense Container Styles */
        .ad-container {
          position: sticky;
          top: 100px;
        }

        @media (max-width: 1400px) {
          .desktop-ad-left {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .mobile-ad-bottom {
            display: block;
          }
        }

        @media (min-width: 769px) {
          .mobile-ad-bottom {
            display: none;
          }
        }
      `}</style>

      {/* Left Sidebar Ad (Desktop Only - Skyscraper 160x600 or Wide Skyscraper 300x600) */}
      <div className="desktop-ad-left" style={{
        position: "fixed",
        left: "20px",
        top: "120px",
        width: "160px",
        zIndex: 100,
      }}>
        <div className="ad-container glass" style={{
          padding: "1rem",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
        }}>
          <div style={{
            fontSize: "0.65rem",
            fontWeight: "600",
            color: "rgba(102, 126, 234, 0.6)",
            textAlign: "center",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Advertisement
          </div>
          
          {/* REPLACE THIS SECTION WITH REAL ADSENSE CODE */}
          <div style={{
            width: "160px",
            height: "600px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Decorative background pattern */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.1,
              background: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)",
            }} />
            
            {/* Fake Ad Content */}
            <div style={{
              position: "relative",
              zIndex: 1,
              textAlign: "center",
            }}>
              <div style={{
                width: "60px",
                height: "60px",
                background: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                fontSize: "2rem",
              }}>
                🎓
              </div>
              <h4 style={{
                margin: "0 0 0.5rem 0",
                color: "white",
                fontSize: "1rem",
                fontWeight: "800",
              }}>
                Study Smarter
              </h4>
              <p style={{
                margin: "0 0 1rem 0",
                color: "rgba(255,255,255,0.9)",
                fontSize: "0.75rem",
                lineHeight: "1.4",
              }}>
                Boost your grades with AI-powered learning tools
              </p>
              <div style={{
                padding: "0.5rem 1rem",
                background: "white",
                color: "#667eea",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: "700",
                display: "inline-block",
              }}>
                Learn More
              </div>
              
              <div style={{
                position: "absolute",
                bottom: "-200px",
                left: "50%",
                transform: "translateX(-50%)",
                color: "rgba(255,255,255,0.3)",
                fontSize: "0.7rem",
                marginTop: "2rem",
                whiteSpace: "nowrap",
              }}>
                Premium Study Tools
              </div>
            </div>
          </div>
          {/* END REPLACE SECTION - Insert AdSense code like:
          <ins className="adsbygoogle"
            style={{display:"inline-block",width:"160px",height:"600px"}}
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
            data-ad-slot="XXXXXXXXXX"></ins>
          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
          */}
        </div>
      </div>

      {/* Header */}
      <div style={{
        padding: "1.5rem 2rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "2rem",
              fontWeight: "800",
              background: "linear-gradient(135deg, #fff 0%, #f0f0f0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}>
              StuddyAI
            </h1>
            <p style={{
              margin: "0.25rem 0 0 0",
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "0.875rem",
              fontWeight: "500",
            }}>
              Your intelligent study companion
            </p>
          </div>

          {session ? (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.5rem 1rem",
                background: "rgba(255, 255, 255, 0.15)",
                borderRadius: "50px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "700",
                  fontSize: "0.875rem",
                }}>
                  {session.user?.name?.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: "white", fontWeight: "600", fontSize: "0.875rem" }}>
                  {session.user?.name}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="hover-lift"
                style={{
                  padding: "0.625rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.2)",
                  color: "white",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="hover-lift"
              style={{
                padding: "0.75rem 1.5rem",
                background: "white",
                color: "#667eea",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              }}
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Container */}
      <div style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "2rem",
        minHeight: "calc(100vh - 100px)",
      }}>
        {/* Mode Selector Pills */}
        <div className="chat-message" style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "2rem",
          justifyContent: "center",
        }}>
          {["answer", "flashcards", "quiz"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="hover-lift"
              style={{
                padding: "0.75rem 1.5rem",
                background: mode === m 
                  ? "white" 
                  : "rgba(255, 255, 255, 0.15)",
                color: mode === m ? "#667eea" : "white",
                border: mode === m 
                  ? "none" 
                  : "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "50px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                textTransform: "capitalize",
                boxShadow: mode === m ? "0 4px 20px rgba(0, 0, 0, 0.1)" : "none",
              }}
            >
              {m === "answer" ? "💬 Chat" : m === "flashcards" ? "🎴 Flashcards" : "📝 Quiz"}
            </button>
          ))}
        </div>

        {/* Import Section */}
        {session && (
          <div className="chat-message glass" style={{
            padding: "1.5rem",
            borderRadius: "16px",
            marginBottom: "1.5rem",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: "#2d3748",
                }}>
                  📚 Import Study Materials
                </h3>
                <p style={{
                  margin: "0.25rem 0 0 0",
                  fontSize: "0.875rem",
                  color: "#718096",
                }}>
                  {isImporting ? "Importing your document..." : "Connect your Google Drive to get started"}
                </p>
              </div>
              <button
                onClick={openPicker}
                disabled={isImporting}
                className="hover-lift"
                style={{
                  padding: "0.75rem 1.5rem",
                  background: isImporting 
                    ? "linear-gradient(135deg, #a0aec0 0%, #718096 100%)"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: isImporting ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  boxShadow: isImporting 
                    ? "none"
                    : "0 4px 15px rgba(102, 126, 234, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  opacity: isImporting ? 0.7 : 1,
                }}
              >
                {isImporting && (
                  <div className="spinner" style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid white",
                    borderRadius: "50%",
                  }} />
                )}
                {isImporting ? "Importing..." : "Import Files"}
              </button>
            </div>
          </div>
        )}

        {/* Memory Display */}
        {uploadedText && (
          <div className="chat-message glass" style={{
            padding: "1.5rem",
            borderRadius: "16px",
            marginBottom: "1.5rem",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
          }}>
            <h3 style={{
              margin: "0 0 1rem 0",
              fontSize: "0.875rem",
              fontWeight: "700",
              color: "#667eea",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              📖 Loaded Content
            </h3>
            <div style={{
              maxHeight: "200px",
              overflowY: "auto",
              padding: "1rem",
              background: "#f7fafc",
              borderRadius: "10px",
              fontSize: "0.875rem",
              lineHeight: "1.6",
              color: "#4a5568",
              fontFamily: "'Space Mono', monospace",
            }}>
              {uploadedText}
            </div>
          </div>
        )}

        {/* Input Section */}
        <div className="chat-message glass" style={{
          padding: "1.5rem",
          borderRadius: "16px",
          marginBottom: "2rem",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
        }}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              mode === "answer"
                ? "Ask me anything about your study materials..."
                : mode === "flashcards"
                ? "What topic should I create flashcards for?"
                : "What topic should I create a quiz on?"
            }
            style={{
              width: "100%",
              minHeight: "120px",
              padding: "1rem",
              border: "2px solid transparent",
              borderRadius: "12px",
              background: "#f7fafc",
              fontSize: "1rem",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              transition: "all 0.3s ease",
            }}
            onFocus={(e) => e.target.style.borderColor = "#667eea"}
            onBlur={(e) => e.target.style.borderColor = "transparent"}
          />
          
          <button
            onClick={handleAsk}
            disabled={isGenerating}
            className="hover-lift"
            style={{
              marginTop: "1rem",
              width: "100%",
              padding: "1rem",
              background: isGenerating
                ? "linear-gradient(135deg, #a0aec0 0%, #718096 100%)"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: isGenerating ? "not-allowed" : "pointer",
              fontWeight: "700",
              fontSize: "1rem",
              fontFamily: "inherit",
              boxShadow: isGenerating
                ? "none"
                : "0 4px 20px rgba(102, 126, 234, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            {isGenerating && (
              <div className="spinner" style={{
                width: "18px",
                height: "18px",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTop: "2px solid white",
                borderRadius: "50%",
              }} />
            )}
            {isGenerating 
              ? "Generating..." 
              : mode === "answer" 
                ? "✨ Ask Question" 
                : mode === "flashcards" 
                  ? "🎴 Generate Flashcards" 
                  : "📝 Generate Quiz"
            }
          </button>
        </div>

        {/* Answer Mode Output */}
        {mode === "answer" && answer && (
          <div className="chat-message glass" style={{
            padding: "2rem",
            borderRadius: "16px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
            marginBottom: "2rem",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}>
                🤖
              </div>
              <h3 style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: "700",
                color: "#2d3748",
              }}>
                AI Response
              </h3>
            </div>
            <div style={{
              fontSize: "1rem",
              lineHeight: "1.7",
              color: "#4a5568",
              whiteSpace: "pre-wrap",
            }}>
              {answer}
            </div>
          </div>
        )}

        {/* Flashcard Mode Output */}
        {mode === "flashcards" && flashcards.length > 0 && !reviewMode && (
          <div className="chat-message glass" style={{
            padding: "2rem",
            borderRadius: "16px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: "700",
                color: "#2d3748",
              }}>
                🎴 Your Flashcards ({flashcards.length})
              </h3>
              <button
                onClick={() => setReviewMode(true)}
                className="hover-lift"
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
                }}
              >
                Start Review
              </button>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}>
              {flashcards.map((card, i) => (
                <div
                  key={i}
                  className="hover-lift"
                  style={{
                    padding: "1.25rem",
                    background: "white",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div style={{
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    color: "#667eea",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.5rem",
                  }}>
                    Question
                  </div>
                  <p style={{
                    margin: "0 0 1rem 0",
                    fontSize: "0.95rem",
                    fontWeight: "600",
                    color: "#2d3748",
                    lineHeight: "1.5",
                  }}>{card.front}</p>
                  <div style={{
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    color: "#48bb78",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.5rem",
                  }}>
                    Answer
                  </div>
                  <p style={{
                    margin: "0 0 1rem 0",
                    fontSize: "0.875rem",
                    color: "#4a5568",
                    lineHeight: "1.5",
                  }}>{card.back}</p>
                  <div style={{
                    display: "inline-block",
                    padding: "0.25rem 0.75rem",
                    background: "#f7fafc",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    color: "#718096",
                  }}>
                    {card.difficulty}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "flashcards" && reviewMode && (
          <FlashcardViewer
            cards={flashcards}
            onExit={() => setReviewMode(false)}
            onGenerateMore={() => setShowOptionsSidebar(true)}
          />
        )}

        {/* Quiz Mode Output */}
        {mode === "quiz" && quiz.length > 0 && (
          <div className="chat-message glass" style={{
            padding: "2rem",
            borderRadius: "16px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
          }}>
            <h3 style={{
              margin: "0 0 1.5rem 0",
              fontSize: "1.125rem",
              fontWeight: "700",
              color: "#2d3748",
            }}>
              📝 Quiz ({quiz.length} questions)
            </h3>

            {quizFinished ? (
              <div style={{
                textAlign: "center",
                padding: "3rem 2rem",
              }}>
                <div style={{
                  width: "80px",
                  height: "80px",
                  margin: "0 auto 1.5rem",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5rem",
                }}>
                  🎉
                </div>
                <h3 style={{
                  margin: "0 0 1rem 0",
                  fontSize: "1.5rem",
                  fontWeight: "800",
                  color: "#2d3748",
                }}>
                  Quiz Complete!
                </h3>
                <p style={{
                  margin: "0 0 2rem 0",
                  fontSize: "2rem",
                  fontWeight: "700",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  {score} / {quiz.length}
                </p>
                <button
                  onClick={() => {
                    setCurrentQuestion(0);
                    setSelectedChoice(null);
                    setShowExplanation(false);
                    setScore(0);
                    setQuizFinished(false);
                  }}
                  className="hover-lift"
                  style={{
                    padding: "1rem 2rem",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontWeight: "700",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)",
                  }}
                >
                  Retake Quiz
                </button>
              </div>
            ) : (
              <>
                {/* Progress Bar */}
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}>
                    <span style={{
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      color: "#718096",
                    }}>
                      Question {currentQuestion + 1} of {quiz.length}
                    </span>
                    <span style={{
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      color: "#667eea",
                    }}>
                      Score: {score}
                    </span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "8px",
                    background: "#e2e8f0",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${((currentQuestion + 1) / quiz.length) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                </div>

                {/* Question */}
                <div style={{
                  padding: "1.5rem",
                  background: "white",
                  borderRadius: "12px",
                  marginBottom: "1.5rem",
                  border: "1px solid #e2e8f0",
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: "1.125rem",
                    fontWeight: "700",
                    color: "#2d3748",
                    lineHeight: "1.6",
                  }}>
                    {quiz[currentQuestion].question}
                  </h3>
                </div>

                {/* Choices */}
                <div style={{ marginBottom: "1.5rem" }}>
                  {quiz[currentQuestion].choices.map((choice, index) => {
                    const isCorrect = index === quiz[currentQuestion].correctIndex;
                    const isSelected = selectedChoice === index;

                    let bg = "white";
                    let borderColor = "#e2e8f0";
                    
                    if (showExplanation) {
                      if (isCorrect) {
                        bg = "#f0fff4";
                        borderColor = "#48bb78";
                      } else if (isSelected) {
                        bg = "#fff5f5";
                        borderColor = "#f56565";
                      }
                    } else if (isSelected) {
                      bg = "#eef2ff";
                      borderColor = "#667eea";
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => !showExplanation && setSelectedChoice(index)}
                        className="hover-lift"
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "1rem 1.25rem",
                          marginBottom: "0.75rem",
                          background: bg,
                          border: `2px solid ${borderColor}`,
                          borderRadius: "12px",
                          cursor: showExplanation ? "default" : "pointer",
                          fontSize: "0.95rem",
                          fontFamily: "inherit",
                          fontWeight: "500",
                          color: "#2d3748",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>

                {/* Submit Answer */}
                {!showExplanation && selectedChoice !== null && (
                  <button
                    onClick={() => {
                      const correct = selectedChoice === quiz[currentQuestion].correctIndex;
                      if (correct) setScore((s) => s + 1);
                      setShowExplanation(true);
                    }}
                    className="hover-lift"
                    style={{
                      width: "100%",
                      padding: "1rem",
                      background: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      boxShadow: "0 4px 15px rgba(72, 187, 120, 0.3)",
                    }}
                  >
                    Submit Answer
                  </button>
                )}

                {/* Explanation */}
                {showExplanation && (
                  <div style={{
                    padding: "1.5rem",
                    background: "#f7fafc",
                    borderRadius: "12px",
                    marginBottom: "1rem",
                  }}>
                    <div style={{
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      color: "#667eea",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.5rem",
                    }}>
                      Explanation
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: "0.95rem",
                      color: "#4a5568",
                      lineHeight: "1.6",
                    }}>
                      {quiz[currentQuestion].explanation}
                    </p>
                  </div>
                )}

                {/* Next Question */}
                {showExplanation && (
                  <button
                    onClick={() => {
                      setShowExplanation(false);
                      setSelectedChoice(null);
                      if (currentQuestion + 1 >= quiz.length) {
                        setQuizFinished(true);
                      } else {
                        setCurrentQuestion((q) => q + 1);
                      }
                    }}
                    className="hover-lift"
                    style={{
                      width: "100%",
                      padding: "1rem",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)",
                    }}
                  >
                    {currentQuestion + 1 >= quiz.length ? "Finish Quiz" : "Next Question →"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Options Sidebar */}
      {showOptionsSidebar && (mode === "flashcards" || mode === "quiz") && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "320px",
          height: "100vh",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(20px)",
          boxShadow: "-4px 0 30px rgba(0, 0, 0, 0.1)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.3s ease-out",
        }}>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: "1.5rem",
            borderBottom: "1px solid #e2e8f0",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: "700",
                color: "white",
              }}>
                ⚙️ Options
              </h3>
              <button
                onClick={() => setShowOptionsSidebar(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "700",
                color: "#2d3748",
                marginBottom: "0.5rem",
              }}>
                Count
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={generateCount}
                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 5)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "700",
                color: "#2d3748",
                marginBottom: "0.5rem",
              }}>
                Difficulty
              </label>
              <select
                value={generateDifficulty}
                onChange={(e) => setGenerateDifficulty(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <button
              onClick={handleAsk}
              disabled={isGenerating}
              className="hover-lift"
              style={{
                width: "100%",
                padding: "0.875rem",
                background: isGenerating
                  ? "linear-gradient(135deg, #a0aec0 0%, #718096 100%)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                cursor: isGenerating ? "not-allowed" : "pointer",
                fontSize: "0.95rem",
                fontWeight: "700",
                fontFamily: "inherit",
                marginBottom: "0.75rem",
                boxShadow: isGenerating
                  ? "none"
                  : "0 4px 15px rgba(102, 126, 234, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                opacity: isGenerating ? 0.7 : 1,
              }}
            >
              {isGenerating && (
                <div className="spinner" style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid white",
                  borderRadius: "50%",
                }} />
              )}
              {isGenerating ? "Regenerating..." : "🔄 Regenerate"}
            </button>

            <button
              onClick={handleAsk}
              disabled={isGenerating}
              className="hover-lift"
              style={{
                width: "100%",
                padding: "0.875rem",
                background: isGenerating ? "#e2e8f0" : "white",
                color: isGenerating ? "#a0aec0" : "#667eea",
                border: `2px solid ${isGenerating ? "#e2e8f0" : "#667eea"}`,
                borderRadius: "10px",
                cursor: isGenerating ? "not-allowed" : "pointer",
                fontSize: "0.95rem",
                fontWeight: "700",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                opacity: isGenerating ? 0.7 : 1,
              }}
            >
              {isGenerating && (
                <div className="spinner" style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #e2e8f0",
                  borderTop: "2px solid #667eea",
                  borderRadius: "50%",
                }} />
              )}
              {isGenerating ? "Adding..." : "➕ Add More"}
            </button>
          </div>

          {/* Stats Footer */}
          <div style={{
            padding: "1.5rem",
            borderTop: "1px solid #e2e8f0",
            background: "#f7fafc",
          }}>
            <div style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#718096",
            }}>
              {mode === "flashcards" && `Total Cards: ${flashcards.length}`}
              {mode === "quiz" && `Total Questions: ${quiz.length}`}
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      {!showOptionsSidebar && (
        (mode === "flashcards" && flashcards.length > 0) || 
        (mode === "quiz" && quiz.length > 0)
      ) && (
        <button
          onClick={() => setShowOptionsSidebar(true)}
          className="hover-lift"
          style={{
            position: "fixed",
            top: "50%",
            right: 0,
            transform: "translateY(-50%)",
            padding: "1.5rem 0.75rem",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px 0 0 12px",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: "700",
            zIndex: 999,
            writingMode: "vertical-rl",
            boxShadow: "-4px 4px 20px rgba(102, 126, 234, 0.3)",
          }}
        >
          ⚙️ Options
        </button>
      )}

      {/* Mobile Bottom Ad (Mobile Only - Responsive/Banner 320x50 or 320x100) */}
      <div className="mobile-ad-bottom" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(102, 126, 234, 0.2)",
        padding: "0.75rem",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.1)",
      }}>
        <div style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}>
          <div style={{
            fontSize: "0.65rem",
            fontWeight: "600",
            color: "rgba(102, 126, 234, 0.6)",
            textAlign: "center",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Advertisement
          </div>
          
          {/* REPLACE THIS SECTION WITH REAL ADSENSE CODE */}
          <div style={{
            width: "100%",
            height: "50px",
            background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1rem",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Decorative elements */}
            <div style={{
              position: "absolute",
              top: -10,
              right: -10,
              width: "60px",
              height: "60px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "50%",
            }} />
            <div style={{
              position: "absolute",
              bottom: -15,
              left: "30%",
              width: "40px",
              height: "40px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "50%",
            }} />
            
            {/* Fake Ad Content */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              position: "relative",
              zIndex: 1,
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                background: "white",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}>
                📚
              </div>
              <div>
                <div style={{
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: "700",
                  lineHeight: "1.2",
                }}>
                  Premium Study Tools
                </div>
                <div style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "0.7rem",
                }}>
                  Ace your exams with AI
                </div>
              </div>
            </div>
            <div style={{
              padding: "0.4rem 0.75rem",
              background: "white",
              color: "#667eea",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: "700",
              position: "relative",
              zIndex: 1,
            }}>
              Try Now
            </div>
          </div>
          {/* END REPLACE SECTION - Insert AdSense code like:
          <ins className="adsbygoogle"
            style={{display:"block"}}
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
            data-ad-slot="XXXXXXXXXX"
            data-ad-format="auto"
            data-full-width-responsive="true"></ins>
          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
          */}
        </div>
      </div>
    </div>
  );
}