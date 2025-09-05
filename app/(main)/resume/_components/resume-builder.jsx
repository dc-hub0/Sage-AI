"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Download,
  Edit,
  Loader2,
  Monitor,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import MDEditor from "@uiw/react-md-editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { saveResume } from "@/actions/resume";
import { EntryForm } from "./entry-form";
import useFetch from "@/hooks/use-fetch";
import { useUser } from "@clerk/nextjs";
import { entriesToMarkdown } from "@/app/lib/helper";
import { resumeSchema } from "@/app/lib/schema";
import ReactMarkdown from "react-markdown";


export default function ResumeBuilder({ initialContent }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState(initialContent);
  const { user } = useUser();
  const [resumeMode, setResumeMode] = useState("preview");

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      contactInfo: {},
      summary: "",
      skills: "",
      experience: [],
      education: [],
      projects: [],
    },
  });

  const {
    loading: isSaving,
    fn: saveResumeFn,
    data: saveResult,
    error: saveError,
  } = useFetch(saveResume);

  // Watch form fields for preview updates
  const formValues = watch();

  useEffect(() => {
    if (initialContent) setActiveTab("preview");
  }, [initialContent]);

  // Update preview content when form values change
  useEffect(() => {
    if (activeTab === "edit") {
      const newContent = getCombinedContent();
      setPreviewContent(newContent ? newContent : initialContent);
    }
  }, [formValues, activeTab]);

  // Handle save result
  useEffect(() => {
    if (saveResult && !isSaving) {
      toast.success("Resume saved successfully!");
    }
    if (saveError) {
      toast.error(saveError.message || "Failed to save resume");
    }
  }, [saveResult, saveError, isSaving]);

  const getContactMarkdown = () => {
    const { contactInfo } = formValues;
    const parts = [];
    if (contactInfo.email) parts.push(`📧 ${contactInfo.email}`);
    if (contactInfo.mobile) parts.push(`📱 ${contactInfo.mobile}`);
    if (contactInfo.linkedin)
      parts.push(`💼 [LinkedIn](${contactInfo.linkedin})`);
    if (contactInfo.twitter) parts.push(`🐦 [Twitter](${contactInfo.twitter})`);

    return parts.length > 0
      ? `## <div align="center">${user.fullName}</div>
        \n\n<div align="center">\n\n${parts.join(" | ")}\n\n</div>`
      : "";
  };

  const getCombinedContent = () => {
    const { summary, skills, experience, education, projects } = formValues;
    return [
      getContactMarkdown(),
      summary && `## Professional Summary\n\n${summary}`,
      skills && `## Skills\n\n${skills}`,
      entriesToMarkdown(experience, "Work Experience"),
      entriesToMarkdown(education, "Education"),
      entriesToMarkdown(projects, "Projects"),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const [isGenerating, setIsGenerating] = useState(false);

 const generatePDF = async () => {
  setIsGenerating(true);
  try {
    const { jsPDF } = await import("jspdf");

    // --- PDF setup
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const contentWidth = pageWidth - marginX * 2;

    let y = 20; // current cursor Y

    // --- Helpers
    const addHr = (offset = 2) => {
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(marginX, y + offset, pageWidth - marginX, y + offset);
      y += offset + 4;
    };

    const ensureSpace = (needed = 10) => {
      if (y + needed > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }
    };

    const addBlock = (text, fontSize = 11, fontStyle = "normal", topPad = 2, bottomPad = 2) => {
      if (!text) return;
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length * (fontSize * 0.45 + 1) + topPad + bottomPad);
      y += topPad;
      doc.text(lines, marginX, y);
      y += lines.length * (fontSize * 0.45 + 1) + bottomPad;
    };

    const addCentered = (text, fontSize = 12, fontStyle = "normal", topPad = 0, bottomPad = 2) => {
      if (!text) return;
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length * (fontSize * 0.45 + 1) + topPad + bottomPad);
      y += topPad;
      lines.forEach((ln) => {
        const w = doc.getTextWidth(ln);
        doc.text(ln, (pageWidth - w) / 2, y);
        y += fontSize * 0.45 + 1;
      });
      y += bottomPad;
    };

    // --- 1) Sanitize/parse your markdown
    let md = (previewContent || "")
      // remove HTML tags like <div align="center">...</div>
      .replace(/<[^>]+>/g, "")
      // convert links [text](url) -> text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      // normalize bullets
      .replace(/^[ \t]*[-*]\s+/gm, "- ")
      // replace emoji to safe labels (avoid encoding artifacts)
      .replace(/📧/g, "Email:")
      .replace(/📱/g, "Phone:")
      .replace(/💼/g, "LinkedIn:")
      .replace(/🐦/g, "Twitter:")
      // trim excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const lines = md.split("\n");

    // --- 2) Extract name + contact from the first lines (your centered block)
    let name = "";
    let contact = "";

    // find first H2 line ("## Deepak Chauhan")
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    if (i < lines.length && lines[i].startsWith("## ")) {
      name = lines[i].replace(/^##\s+/, "").trim();
      lines.splice(i, 1); // remove the name line

      // grab the next non-empty line as contact (if not another section)
      while (i < lines.length && !lines[i].trim()) i++;
      if (i < lines.length && !lines[i].startsWith("## ")) {
        contact = lines[i].trim();
        lines.splice(i, 1);
      }
    }

    // --- 3) Split remaining content into sections by "## " headings
    const sections = [];
    let current = null;
    const pushCurrent = () => {
      if (current && (current.title || current.body.length)) sections.push(current);
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("## ")) {
        pushCurrent();
        current = { title: line.replace(/^##\s+/, "").trim(), body: [] };
      } else if (line.startsWith("### ")) {
        // treat h3 as uppercased subheading inside body
        if (!current) current = { title: "", body: [] };
        current.body.push(line.replace(/^###\s+/, "").toUpperCase());
      } else {
        if (!current) current = { title: "", body: [] };
        current.body.push(line);
      }
    }
    pushCurrent();

    // --- 4) Draw PDF nicely

    // Name (centered, big & bold)
    if (name) {
      addCentered(name, 20, "bold", 0, 2);
    }

    // Contact (centered, small)
    if (contact) {
      addCentered(contact.replace(/\s*\|\s*/g, "  •  "), 11, "normal", 0, 6);
    }

    // Thin line under header
    addHr(0);

    // Sections
    sections.forEach((sec, idx) => {
      // Section title
      if (sec.title) {
        ensureSpace(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(sec.title, marginX, y);
        y += 6;
        addHr(0);
      }

      // Section body
      let buffer = [];
      const flush = () => {
        if (buffer.length) {
          addBlock(buffer.join("\n"), 11, "normal", 1, 4);
          buffer = [];
        }
      };

      for (const l of sec.body) {
        if (!l) continue;
        // treat uppercase lines (from ###) as mini-subheadings
        if (l === l.toUpperCase() && l.length <= 80 && /^[A-Z0-9 ()/@,&.-]+$/.test(l)) {
          flush();
          addBlock(l, 12, "bold", 2, 2);
        } else {
          buffer.push(l);
        }
      }
      flush();

      if (idx < sections.length - 1) {
        ensureSpace(6);
      }
    });

    // --- Save
    doc.save("resume.pdf");
  } catch (error) {
    console.error("PDF generation error:", error);
  } finally {
    setIsGenerating(false);
  }
};




  const onSubmit = async (data) => {
    try {
      const formattedContent = previewContent
        .replace(/\n/g, "\n") // Normalize newlines
        .replace(/\n\s*\n/g, "\n\n") // Normalize multiple newlines to double newlines
        .trim();

      console.log(previewContent, formattedContent);
      await saveResumeFn(previewContent);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  return (
    <div data-color-mode="light" className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-2">
        <h1 className="font-bold gradient-title text-5xl md:text-6xl">
          Resume Builder
        </h1>
        <div className="space-x-2">
          <Button
            variant="destructive"
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Form</TabsTrigger>
          <TabsTrigger value="preview">Markdown</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    {...register("contactInfo.email")}
                    type="email"
                    placeholder="your@email.com"
                    error={errors.contactInfo?.email}
                  />
                  {errors.contactInfo?.email && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile Number</label>
                  <Input
                    {...register("contactInfo.mobile")}
                    type="tel"
                    placeholder="+1 234 567 8900"
                  />
                  {errors.contactInfo?.mobile && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.mobile.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">LinkedIn URL</label>
                  <Input
                    {...register("contactInfo.linkedin")}
                    type="url"
                    placeholder="https://linkedin.com/in/your-profile"
                  />
                  {errors.contactInfo?.linkedin && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.linkedin.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Twitter/X Profile
                  </label>
                  <Input
                    {...register("contactInfo.twitter")}
                    type="url"
                    placeholder="https://twitter.com/your-handle"
                  />
                  {errors.contactInfo?.twitter && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.twitter.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Professional Summary</h3>
              <Controller
                name="summary"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    className="h-32"
                    placeholder="Write a compelling professional summary..."
                    error={errors.summary}
                  />
                )}
              />
              {errors.summary && (
                <p className="text-sm text-red-500">{errors.summary.message}</p>
              )}
            </div>

            {/* Skills */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Skills</h3>
              <Controller
                name="skills"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    className="h-32"
                    placeholder="List your key skills..."
                    error={errors.skills}
                  />
                )}
              />
              {errors.skills && (
                <p className="text-sm text-red-500">{errors.skills.message}</p>
              )}
            </div>

            {/* Experience */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Work Experience</h3>
              <Controller
                name="experience"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Experience"
                    entries={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.experience && (
                <p className="text-sm text-red-500">
                  {errors.experience.message}
                </p>
              )}
            </div>

            {/* Education */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Education</h3>
              <Controller
                name="education"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Education"
                    entries={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.education && (
                <p className="text-sm text-red-500">
                  {errors.education.message}
                </p>
              )}
            </div>

            {/* Projects */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Projects</h3>
              <Controller
                name="projects"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Project"
                    entries={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.projects && (
                <p className="text-sm text-red-500">
                  {errors.projects.message}
                </p>
              )}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="preview">
          {activeTab === "preview" && (
            <Button
              variant="link"
              type="button"
              className="mb-2"
              onClick={() =>
                setResumeMode(resumeMode === "preview" ? "edit" : "preview")
              }
            >
              {resumeMode === "preview" ? (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Resume
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4" />
                  Show Preview
                </>
              )}
            </Button>
          )}

          {activeTab === "preview" && resumeMode !== "preview" && (
            <div className="flex p-3 gap-2 items-center border-2 border-yellow-600 text-yellow-600 rounded mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">
                You will lose editied markdown if you update the form data.
              </span>
            </div>
          )}
          <div className="border rounded-lg">
            <MDEditor
              value={previewContent}
              onChange={setPreviewContent}
              height={800}
              preview={resumeMode}
            />
          </div>
          <div className="hidden">
         <div id="resume-pdf" style={{ background: "white", color: "black" }}>
  <ReactMarkdown>{previewContent}</ReactMarkdown>
</div>


          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
