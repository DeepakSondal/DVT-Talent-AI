"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, Shield, Upload, CheckCircle2,
  AlertCircle, Plus, X, Building2, Lock,
  Save, Sparkles, FileText, Check
} from "lucide-react";
import { candidatePortalApi, type CandidateProfile } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

export default function CandidateProfilePage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["candidate-profile"],
    queryFn: candidatePortalApi.getProfile,
  });

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    title: "",
    location: "",
    linkedin_url: "",
    github_url: "",
    portfolio_url: "",
    experience_years: 0,
    current_company: "",
    current_salary: 0,
    expected_salary: 0,
    availability: "Immediate",
    is_searchable: true,
  });

  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");

  const [blockedCompanies, setBlockedCompanies] = useState<string[]>([]);
  const [newBlockedInput, setNewBlockedInput] = useState("");

  const [uploadingResume, setUploadingResume] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        title: profile.title || "",
        location: profile.location || "",
        linkedin_url: profile.linkedin_url || "",
        github_url: profile.github_url || "",
        portfolio_url: profile.portfolio_url || "",
        experience_years: profile.experience_years || 0,
        current_company: profile.current_company || "",
        current_salary: profile.current_salary || 0,
        expected_salary: profile.expected_salary || 0,
        availability: profile.availability || "Immediate",
        is_searchable: profile.is_searchable ?? true,
      });
      setSkillsList(profile.skills || []);
      setBlockedCompanies(profile.hide_from_companies || []);
    }
  }, [profile]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => candidatePortalApi.updateProfile(data),
    onSuccess: () => {
      toast.success("Profile Updated", {
        description: "Your settings and privacy shield have been saved.",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      });
      queryClient.invalidateQueries({ queryKey: ["candidate-profile"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-jobs"] });
    },
    onError: (err: any) => {
      toast.error("Update Failed", {
        description: err.response?.data?.detail || "Could not save profile updates.",
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      skills: skillsList,
      hide_from_companies: blockedCompanies,
    });
  };

  const handleAddSkill = () => {
    const s = newSkillInput.trim();
    if (s && !skillsList.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setSkillsList([...skillsList, s]);
      setNewSkillInput("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkillsList(skillsList.filter((s) => s !== skill));
  };

  const handleAddBlockedCompany = () => {
    const raw = newBlockedInput.trim();
    if (!raw) return;
    const cleaned = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
    if (cleaned && !blockedCompanies.includes(cleaned)) {
      setBlockedCompanies([...blockedCompanies, cleaned]);
      setNewBlockedInput("");
    }
  };

  const handleRemoveBlockedCompany = (comp: string) => {
    setBlockedCompanies(blockedCompanies.filter((c) => c !== comp));
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side extension validation
    const allowed = [".pdf", ".docx", ".doc", ".txt", ".rtf"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error("Unsupported File Format", {
        description: "Please upload a PDF, DOCX, TXT, or RTF file.",
      });
      e.target.value = "";
      return;
    }

    // Client-side size validation (10 MB maximum)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File Too Large", {
        description: "Resume file size must be under 10 MB.",
      });
      e.target.value = "";
      return;
    }

    const form = new FormData();
    form.append("file", file);

    setUploadingResume(true);
    try {
      const res = await candidatePortalApi.uploadResume(form);
      toast.success("Resume Parsed Successfully", {
        description: `Imported ${res.skills_detected?.length || 0} skills into your profile.`,
        icon: <CheckCircle2 className="w-4 h-4 text-primary" />,
      });
      queryClient.invalidateQueries({ queryKey: ["candidate-profile"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-jobs"] });
    } catch (err: any) {
      toast.error("Resume Upload Failed", {
        description: err.response?.data?.detail || "Could not parse resume file.",
      });
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Candidate Profile &amp; Privacy Shield
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Control how you appear to agencies, your salary expectations, and blacklist your current employer.
          </p>
        </div>

        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-6 h-10 rounded-xl shadow-md shadow-indigo-600/20"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Resume Section */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-4 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Resume &amp; CV Document</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile?.has_resume
                  ? `Active resume: ${profile.resume_name || "Parsed and indexed"}`
                  : "Upload a PDF or Word document to auto-extract your skills and boost 5-dimension match scoring."}
              </p>
            </div>
          </div>
          {profile?.has_resume && (
            <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs font-bold">
              <Check className="w-3 h-3 mr-1 inline" /> Active
            </Badge>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {profile?.has_resume ? "Upload updated version (.pdf, .docx, .txt):" : "Upload new resume:"}
          </span>
          <label className="cursor-pointer">
            <span className="sr-only">Choose File</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleResumeUpload}
              disabled={uploadingResume}
              className="text-xs text-slate-500 dark:text-slate-400 file:mr-2 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* Privacy Shield Section */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-5 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Privacy Shield &amp; Blacklist</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control visibility and safeguard your confidentiality from current or competing employers.
            </p>
          </div>
        </div>

        {/* Searchable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white block">
              Allow Verified Recruiting Agencies to Source Me
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              When enabled, your profile can be surfaced to hiring managers looking for your exact skills.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, is_searchable: !formData.is_searchable })}
            className={`w-12 h-6 rounded-full transition-colors p-1 ${
              formData.is_searchable ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                formData.is_searchable ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Company Blacklist */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Hide Profile From Specific Companies (Current Employer Blacklist)
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Add company names or domains (e.g. &ldquo;Google&rdquo; or &ldquo;acme.com&rdquo;). Recruiters from these organizations will never see your profile.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="e.g. Current Employer, Inc."
              value={newBlockedInput}
              onChange={(e) => setNewBlockedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddBlockedCompany();
                }
              }}
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs h-10 rounded-xl max-w-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBlockedCompany}
              className="text-xs font-semibold h-10 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Company
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {blockedCompanies.map((comp) => (
              <Badge
                key={comp}
                className="bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 text-xs py-1 px-3 flex items-center gap-1.5 font-semibold"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                {comp}
                <button
                  type="button"
                  onClick={() => handleRemoveBlockedCompany(comp)}
                  className="hover:text-rose-600 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {blockedCompanies.length === 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">No companies blacklisted yet</span>
            )}
          </div>
        </div>
      </Card>

      {/* General Profile Fields */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-6 transition-colors">
        <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          Personal &amp; Professional Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            required
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Last Name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            required
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Professional Title / Archetype"
            placeholder="e.g. Senior Full Stack Engineer"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Location"
            placeholder="e.g. New York, NY (or Remote)"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Years of Experience"
            type="number"
            value={formData.experience_years.toString()}
            onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Current Employer (Optional)"
            placeholder="e.g. Stealth Startup"
            value={formData.current_company}
            onChange={(e) => setFormData({ ...formData, current_company: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Expected Annual Salary (USD)"
            type="number"
            placeholder="e.g. 150000"
            value={formData.expected_salary ? formData.expected_salary.toString() : ""}
            onChange={(e) => setFormData({ ...formData, expected_salary: parseInt(e.target.value) || 0 })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Availability"
            placeholder="e.g. 2 Weeks Notice"
            value={formData.availability}
            onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <Input
            label="LinkedIn URL"
            placeholder="https://linkedin.com/in/..."
            value={formData.linkedin_url}
            onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="GitHub URL"
            placeholder="https://github.com/..."
            value={formData.github_url}
            onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
          <Input
            label="Portfolio / Website"
            placeholder="https://..."
            value={formData.portfolio_url}
            onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-10 rounded-xl"
          />
        </div>
      </Card>

      {/* Skills Inventory */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-4 transition-colors">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Skills Inventory</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Skills are matched against job requirements during 5-dimension scoring. Add or remove tags.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. TypeScript, React, Docker, Python..."
            value={newSkillInput}
            onChange={(e) => setNewSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSkill();
              }
            }}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs h-10 rounded-xl max-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSkill}
            className="text-xs font-semibold h-10 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Skill
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2">
          {skillsList.map((skill) => (
            <Badge
              key={skill}
              className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs py-1 px-3 flex items-center gap-1.5 font-semibold"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="hover:text-rose-600 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {skillsList.length === 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">No skills added yet.</span>
          )}
        </div>
      </Card>

      {/* Bottom Save Action */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-8 h-11 rounded-xl shadow-md shadow-indigo-600/20"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {updateMutation.isPending ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </form>
  );
}
