"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function FlashcardViewer({ cards, onExit }: any) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];

  const next = () => {
    setFlipped(false);
    if (index < cards.length - 1) setIndex(index + 1);
  };

  const prev = () => {
    setFlipped(false);
    if (index > 0) setIndex(index - 1);
  };

  return (
    <div
      style={{
        marginTop: "1.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Progress */}
      <p style={{ opacity: 0.7 }}>
        Card {index + 1} of {cards.length}
      </p>

      <div style={{ position: "relative", width: 300, height: 200 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={index + "-" + flipped}
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.35 }}
            onClick={() => setFlipped(!flipped)}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #ddd",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "1rem",
              cursor: "pointer",
              backfaceVisibility: "hidden",
              textAlign: "center",
              fontSize: "1.1rem",
              fontWeight: 500,
            }}
          >
            {flipped ? card.back : card.front}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Swipe Buttons */}
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          gap: "1rem",
        }}
      >
        <button
          onClick={prev}
          disabled={index === 0}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            border: "1px solid #ccc",
            background: index === 0 ? "#eee" : "white",
            cursor: index === 0 ? "default" : "pointer",
          }}
        >
          ← Prev
        </button>

        <button
          onClick={next}
          disabled={index === cards.length - 1}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            border: "1px solid #ccc",
            background: index === cards.length - 1 ? "#eee" : "white",
            cursor: index === cards.length - 1 ? "default" : "pointer",
          }}
        >
          Next →
        </button>
      </div>

      {/* Exit */}
      <button
        onClick={onExit}
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#dc3545",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Exit Review
      </button>
    </div>
  );
}
