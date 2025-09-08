"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { generateQuiz, saveQuizResult } from "@/actions/interview";
import { getUser } from "@/actions/user"; // ✅ new import
import QuizResult from "./quiz-result";
import useFetch from "@/hooks/use-fetch";
import { BarLoader } from "react-spinners";

export default function Quiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);

  // user profile
  const [user, setUser] = useState(null);

  // toggle custom mode
  const [customMode, setCustomMode] = useState(false);

  // custom selections
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedSubIndustry, setSelectedSubIndustry] = useState("");
  const [selectedSkills, setSelectedSkills] = useState("");

  const [industries, setIndustries] = useState([]);

  // mock data (replace with DB fetch if needed)
  useEffect(() => {
    const mockIndustries = [
  {
    id: "1",
    name: "Software Engineering",
    subIndustries: [
      "Frontend Development",
      "Backend Development",
      "Full Stack Development",
      "Mobile Development",
      "DevOps",
      "Game Development",
      "Embedded Systems",
    ],
  },
  {
    id: "2",
    name: "Data Science",
    subIndustries: [
      "Machine Learning",
      "Artificial Intelligence",
      "Data Analytics",
      "Big Data Engineering",
      "Business Intelligence",
      "Natural Language Processing",
      "Computer Vision",
    ],
  },
  {
    id: "3",
    name: "Cloud Computing",
    subIndustries: [
      "AWS",
      "Microsoft Azure",
      "Google Cloud Platform",
      "Cloud Architecture",
      "Cloud Security",
      "Serverless Computing",
      "Kubernetes & Containerization",
    ],
  },
  {
    id: "4",
    name: "Cybersecurity",
    subIndustries: [
      "Network Security",
      "Application Security",
      "Cloud Security",
      "Ethical Hacking",
      "Digital Forensics",
      "Security Operations (SOC)",
      "Penetration Testing",
    ],
  },
  {
    id: "5",
    name: "Artificial Intelligence",
    subIndustries: [
      "Deep Learning",
      "Generative AI",
      "AI Ethics",
      "Reinforcement Learning",
      "Autonomous Systems",
      "Robotics",
    ],
  },
  {
    id: "6",
    name: "Product & Project Management",
    subIndustries: [
      "Agile Project Management",
      "Scrum Mastery",
      "Product Ownership",
      "Technical Program Management",
      "Stakeholder Management",
    ],
  },
  {
    id: "7",
    name: "UI/UX & Design",
    subIndustries: [
      "UI Design",
      "UX Research",
      "Product Design",
      "Human-Computer Interaction",
      "Design Systems",
      "Interaction Design",
    ],
  },
  {
    id: "8",
    name: "Business & Finance",
    subIndustries: [
      "Financial Analysis",
      "Investment Banking",
      "Risk Management",
      "Accounting",
      "Business Strategy",
      "Entrepreneurship",
    ],
  },
  {
    id: "9",
    name: "Marketing & Sales",
    subIndustries: [
      "Digital Marketing",
      "Content Marketing",
      "SEO/SEM",
      "Sales Strategy",
      "Brand Management",
      "Social Media Marketing",
    ],
  },
  {
    id: "10",
    name: "Healthcare & Life Sciences",
    subIndustries: [
      "Healthcare IT",
      "Medical Research",
      "Biotechnology",
      "Pharmaceuticals",
      "Public Health",
    ],
  },

    ];
    setIndustries(mockIndustries);
  }, []);

  // ✅ fetch logged-in user
  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getUser();
        setUser(u);
      } catch (err) {
        console.error("Failed to load user", err);
        toast.error("Failed to load user profile");
      }
    }
    loadUser();
  }, []);

  const {
    loading: generatingQuiz,
    fn: generateQuizFn,
    data: quizData,
  } = useFetch((industry, skills) => generateQuiz(industry, skills));

  const {
    loading: savingResult,
    fn: saveQuizResultFn,
    data: resultData,
    setData: setResultData,
  } = useFetch(saveQuizResult);

  useEffect(() => {
    if (quizData) {
      setAnswers(new Array(quizData.length).fill(null));
    }
  }, [quizData]);

  const handleAnswer = (answer) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quizData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowExplanation(false);
    } else {
      finishQuiz();
    }
  };

  const calculateScore = () => {
    let correct = 0;
    answers.forEach((answer, index) => {
      if (answer === quizData[index].correctAnswer) {
        correct++;
      }
    });
    return (correct / quizData.length) * 100;
  };

  const finishQuiz = async () => {
    const score = calculateScore();
    try {
      await saveQuizResultFn(quizData, answers, score);
      toast.success("Quiz completed!");
    } catch (error) {
      toast.error(error.message || "Failed to save quiz results");
    }
  };

  // ✅ default quiz (registered profile field)
  const startDefaultQuiz = () => {
    if (!user?.industry) {
      toast.error("No registered field found. Please complete onboarding.");
      return;
    }
    setCustomMode(false);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowExplanation(false);
    generateQuizFn(user.industry, user.skills || []);
    setResultData(null);
  };

  // custom quiz
  const startCustomQuiz = () => {
    setCustomMode(true);
  };

  const launchCustomQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowExplanation(false);
    generateQuizFn(
      `${selectedIndustry}-${selectedSubIndustry}`,
      selectedSkills.split(",").map((s) => s.trim())
    );
    setResultData(null);
  };

  // --- UI states ---
  if (generatingQuiz) {
    return <BarLoader className="mt-4" width={"100%"} color="gray" />;
  }

  if (resultData) {
    return (
      <div className="mx-2">
        <QuizResult result={resultData} onStartNew={startDefaultQuiz} />
      </div>
    );
  }

  if (!quizData) {
    return (
      <Card className="mx-2">
        <CardHeader>
          <CardTitle>Choose How You Want to Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!customMode ? (
            <>
              {/* Default Option */}
              <Button onClick={startDefaultQuiz} className="w-full">
                Start Quiz (Registered Field)
              </Button>

              {/* Switch to Custom */}
              <Button
                onClick={startCustomQuiz}
                variant="outline"
                className="w-full"
              >
                Custom Quiz (Choose Field)
              </Button>
            </>
          ) : (
            <>
              {/* Industry */}
              <Select onValueChange={(value) => setSelectedIndustry(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Industries</SelectLabel>
                    {industries.map((ind) => (
                      <SelectItem key={ind.id} value={ind.name}>
                        {ind.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {/* Sub-Industry */}
              {selectedIndustry && (
                <Select
                  onValueChange={(value) => setSelectedSubIndustry(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Specializations</SelectLabel>
                      {industries
                        .find((ind) => ind.name === selectedIndustry)
                        ?.subIndustries?.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}

              {/* Skills */}
              <Input
                placeholder="Enter skills (comma separated)"
                value={selectedSkills}
                onChange={(e) => setSelectedSkills(e.target.value)}
              />

              <Button
                onClick={launchCustomQuiz}
                className="w-full"
                disabled={!selectedIndustry || !selectedSubIndustry}
              >
                Start Custom Quiz
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Quiz questions ---
  const question = quizData[currentQuestion];

  return (
    <Card className="mx-2">
      <CardHeader>
        <CardTitle>
          Question {currentQuestion + 1} of {quizData.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-medium">{question.question}</p>
        {question.options.map((option, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="radio"
              id={`option-${index}`}
              value={option}
              checked={answers[currentQuestion] === option}
              onChange={() => handleAnswer(option)}
            />
            <label htmlFor={`option-${index}`}>{option}</label>
          </div>
        ))}

        {showExplanation && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="font-medium">Explanation:</p>
            <p className="text-muted-foreground">{question.explanation}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {!showExplanation && (
          <Button
            onClick={() => setShowExplanation(true)}
            variant="outline"
            disabled={!answers[currentQuestion]}
          >
            Show Explanation
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!answers[currentQuestion] || savingResult}
          className="ml-auto"
        >
          {currentQuestion < quizData.length - 1 ? "Next Question" : "Finish Quiz"}
        </Button>
      </CardFooter>
    </Card>
  );
}
