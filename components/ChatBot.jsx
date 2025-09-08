"use client";

import { useState, useRef } from "react";
import { Send, MessageCircle, Mic, Square } from "lucide-react";

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! 👋 I'm your SageAI assistant. You can type or talk to me." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastInputType, setLastInputType] = useState("text"); // "voice" or "text"

  const recognitionRef = useRef(null);

  // 🎤 Start voice recognition
  const startListening = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "en-US";
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setLastInputType("voice"); // mark that last input was voice
    };

    recognitionRef.current.start();
  };

  // 🔊 Voice output
  const speak = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  // ⏹ Stop speaking
  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const inputType = lastInputType === "voice" ? "voice" : "text"; // default to text unless set by voice
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);

      // 🎙️ Only speak if last input was voice
      if (inputType === "voice") {
        speak(data.reply);
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "⚠️ Error: Could not reach Gemini API." },
      ]);
    } finally {
      setLoading(false);
      setLastInputType("text"); // reset after response
    }
  };

  return (
    <div>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition"
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-80 h-96 bg-white dark:bg-gray-900 shadow-xl rounded-2xl flex flex-col overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center">
            <span>SageAI Assistant</span>
            <button onClick={() => setIsOpen(false)} className="text-white">
              ✖
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg max-w-[80%] ${
                  m.role === "assistant"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 self-start"
                    : "bg-blue-500 text-white self-end ml-auto"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="p-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 w-fit">
                Typing...
              </div>
            )}
          </div>

          {/* Input + Voice */}
          <div className="p-2 border-t flex items-center gap-2">
            {/* 🎤 Mic changes to ⏹ when speaking */}
            <button
              onClick={isSpeaking ? stopSpeaking : startListening}
              className={`p-2 rounded-lg ${
                isSpeaking
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              title={isSpeaking ? "Stop Speaking" : "Start Voice Input"}
            >
              {isSpeaking ? <Square size={18} /> : <Mic size={18} />}
            </button>

            <input
              className="flex-1 border rounded-lg px-2 py-1 text-sm dark:bg-gray-800 dark:text-white"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setLastInputType("text");
              }}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type or speak..."
            />
            <button
              onClick={sendMessage}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
