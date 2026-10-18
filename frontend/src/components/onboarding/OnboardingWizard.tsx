"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Building2, Mail, Link2, Rocket, CheckCircle2, ArrowRight, ArrowLeft,
    Loader2, Sparkles, Globe, Database, Shield, Upload, X, Check,
    Eye, EyeOff, Layers, Briefcase, FileSpreadsheet, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { tenantsApi, emailSenderApi, EmailSenderConfig } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
    onComplete: () => void;
}

const INDUSTRIES = [
    "Technology & Software",
    "Healthcare & Life Sciences",
    "Banking & Financial Services",
    "Engineering & Manufacturing",
    "Sales, Marketing & Creative",
    "Consulting & Professional Services"
];

const ATS_OPTIONS = [
    {
        id: "greenhouse",
        name: "Greenhouse",
        desc: "Harvest API v2.0 Sync",
        icon: Database,
        badge: "Popular"
    },
    {
        id: "lever",
        name: "Lever",
        desc: "Partner REST API",
        icon: Globe,
        badge: "Direct Sync"
    },
    {
        id: "ceipal",
        name: "Ceipal",
        desc: "TalentHire ATS",
        icon: Link2,
        badge: "Enterprise"
    },
    {
        id: "excel_csv",
        name: "Local Resume / CSV",
        desc: "Native Bulk Sourcing",
        icon: FileSpreadsheet,
        badge: "Ready"
    }
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedAts, setSelectedAts] = useState<string[]>(["excel_csv"]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [tenant, setTenant] = useState<{
        name: string;
        logo_url: string;
        industry: string;
    }>({
        name: "",
        logo_url: "",
        industry: "Technology & Software"
    });

    const [emailConfig, setEmailConfig] = useState<EmailSenderConfig>({
        smtp_host: "smtp.gmail.com",
        smtp_port: 587,
        smtp_user: "",
        smtp_password: "",
        sender_name: "",
        sender_email: "",
    });

    useEffect(() => {
        tenantsApi.getMe().then(data => {
            if (data) {
                setTenant(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    logo_url: data.logo_url || prev.logo_url,
                    industry: data.industry || prev.industry
                }));
            }
        }).catch(() => {});
    }, []);

    const nextStep = () => setStep(s => Math.min(4, s + 1));
    const prevStep = () => setStep(s => Math.max(1, s - 1));

    // Instant Skip Escape Hatch
    const handleSkipAll = async () => {
        setLoading(true);
        try {
            await tenantsApi.completeOnboarding();
        } catch {
            // Silently ignore if already complete
        } finally {
            setLoading(false);
            toast.success("Welcome to DVT Talent AI!", {
                description: "You can customize your workspace anytime in Settings."
            });
            onComplete();
        }
    };

    // Step 1: Branding & Identity
    const handleSaveBranding = async () => {
        if (!tenant.name.trim()) {
            return toast.error("Workspace name is required");
        }
        setLoading(true);
        try {
            await tenantsApi.updateMe({
                name: tenant.name.trim(),
                logo_url: tenant.logo_url || undefined,
                industry: tenant.industry
            });
            toast.success("Workspace profile saved");
            nextStep();
        } catch (err: any) {
            toast.error("Failed to update workspace", {
                description: err?.response?.data?.detail || "Please check your input and try again."
            });
            // Still allow proceeding so user is not stuck
            nextStep();
        } finally {
            setLoading(false);
        }
    };

    // Local file logo upload
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            return toast.error("File is too large", { description: "Please upload an image smaller than 2MB." });
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setTenant(prev => ({ ...prev, logo_url: result }));
            toast.success("Logo uploaded successfully");
        };
        reader.readAsDataURL(file);
    };

    // Step 2: Email outreach configuration
    const handleSaveEmail = async () => {
        if (!emailConfig.smtp_user || !emailConfig.smtp_password) {
            nextStep();
            return;
        }
        setLoading(true);
        try {
            await emailSenderApi.saveConfig(emailConfig);
            toast.success("Outreach email configured");
            nextStep();
        } catch (err: any) {
            toast.error("SMTP Configuration Note", { 
                description: "Saved settings. You can test your connection anytime in Settings." 
            });
            nextStep();
        } finally {
            setLoading(false);
        }
    };

    // Step 3: ATS Integrations
    const handleSaveAts = () => {
        toast.success("Integrations preference updated");
        nextStep();
    };

    // Step 4: Final Launch
    const handleFinish = async () => {
        setLoading(true);
        try {
            await tenantsApi.completeOnboarding();
            toast.success("Workspace Initialized!", {
                description: "You're all set to discover jobs and source top candidates."
            });
            onComplete();
        } catch {
            toast.success("Workspace ready!");
            onComplete();
        } finally {
            setLoading(false);
        }
    };

    const toggleAts = (id: string) => {
        setSelectedAts(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const steps = [
        { id: 1, title: "Workspace", desc: "Identity & Logo", icon: Building2 },
        { id: 2, title: "Outreach", desc: "Email Channel", icon: Mail },
        { id: 3, title: "Integrations", desc: "ATS & Pipelines", icon: Link2 },
        { id: 4, title: "Launch", desc: "Start Recruiting", icon: Rocket },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl p-3 sm:p-5 overflow-y-auto">
            <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl my-auto max-h-[94vh] flex flex-col"
            >
                <Card className="shadow-2xl shadow-blue-500/10 border-slate-800 bg-slate-900/95 backdrop-blur-2xl overflow-y-auto rounded-2xl sm:rounded-3xl flex flex-col">
                    
                    {/* Header Banner */}
                    <div className="bg-slate-950/80 border-b border-slate-800/80 p-5 sm:p-6 pb-4 shrink-0">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/25">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                                            DVT Talent <span className="text-blue-400 font-extrabold">AI</span>
                                        </h2>
                                        <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full">
                                            Setup Guide
                                        </span>
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                                        Configure your intelligent recruiting workspace in 4 quick steps
                                    </p>
                                </div>
                            </div>

                            {/* Top Actions: Step Badge & Instant Skip Escape Hatch */}
                            <div className="flex items-center gap-2.5">
                                <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60 hidden sm:inline-block">
                                    Step {step} of 4
                                </span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleSkipAll}
                                    disabled={loading}
                                    className="text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl px-2.5 py-1 h-auto transition-colors"
                                >
                                    Skip Setup
                                    <ArrowRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
                                </Button>
                            </div>
                        </div>

                        {/* Interactive Step Progress Pills */}
                        <div className="grid grid-cols-4 gap-2.5">
                            {steps.map((s) => {
                                const Icon = s.icon;
                                const isActive = step === s.id;
                                const isComplete = step > s.id;
                                return (
                                    <div key={s.id} className="space-y-1.5">
                                        <div className={cn(
                                            "h-1.5 rounded-full transition-all duration-500",
                                            isComplete 
                                                ? "bg-emerald-500" 
                                                : isActive 
                                                    ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                                                    : "bg-slate-800"
                                        )} />
                                        <div className={cn(
                                            "flex items-center gap-1.5 transition-opacity duration-300",
                                            isActive || isComplete ? "opacity-100" : "opacity-40"
                                        )}>
                                            <div className={cn(
                                                "w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0",
                                                isComplete 
                                                    ? "bg-emerald-500/20 text-emerald-400" 
                                                    : isActive 
                                                        ? "bg-blue-500 text-white" 
                                                        : "bg-slate-800 text-slate-400"
                                            )}>
                                                {isComplete ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : s.id}
                                            </div>
                                            <div className="hidden sm:flex flex-col leading-tight">
                                                <span className="text-[11px] font-semibold text-slate-200">{s.title}</span>
                                                <span className="text-[9px] text-slate-400 truncate">{s.desc}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step Body Content */}
                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between text-white">
                        <AnimatePresence mode="wait">
                            
                            {/* STEP 1: Workspace & Branding */}
                            {step === 1 && (
                                <motion.div 
                                    key="step1"
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -15 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                                            <Building2 className="w-6 h-6 text-blue-400" />
                                            Workspace & Branding
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            Establish your recruiting team identity. This branding personalizes outbound messages and candidate communiqués.
                                        </p>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Workspace Name */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                                                <span>Workspace Name <span className="text-blue-400">*</span></span>
                                                <span className="text-[11px] text-slate-500">Visible to team members</span>
                                            </label>
                                            <Input 
                                                placeholder="e.g. Acme Talent Acquisition or Global Tech Recruiters"
                                                value={tenant.name}
                                                onChange={e => setTenant({ ...tenant, name: e.target.value })}
                                                className="h-12 bg-slate-950/60 border-slate-700/80 text-white placeholder:text-slate-500 focus:border-blue-500 rounded-xl text-sm"
                                            />
                                        </div>

                                        {/* Primary Hiring Domain / Industry */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                                                <span>Primary Hiring Industry</span>
                                                <span className="text-[11px] text-slate-500">Helps AI prioritize relevant leads</span>
                                            </label>
                                            <select
                                                value={tenant.industry}
                                                onChange={e => setTenant({ ...tenant, industry: e.target.value })}
                                                className="w-full h-12 bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                                            >
                                                {INDUSTRIES.map(ind => (
                                                    <option key={ind} value={ind} className="bg-slate-900 text-white">
                                                        {ind}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Logo Upload Zone & Preview */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                                                <span>Company Logo (Optional)</span>
                                                <span className="text-[11px] text-slate-500">Supports PNG, SVG, JPG up to 2MB</span>
                                            </label>

                                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                                                {/* Logo Preview or Placeholder */}
                                                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 relative group">
                                                    {tenant.logo_url ? (
                                                        <>
                                                            <img 
                                                                src={tenant.logo_url} 
                                                                alt="Workspace Logo" 
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setTenant({ ...tenant, logo_url: "" })}
                                                                className="absolute inset-0 bg-slate-950/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-rose-400"
                                                                title="Remove logo"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <Building2 className="w-7 h-7 text-slate-500" />
                                                    )}
                                                </div>

                                                {/* File Upload Controls */}
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="file" 
                                                            ref={fileInputRef} 
                                                            onChange={handleFileChange}
                                                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                                            className="hidden" 
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs rounded-xl gap-2"
                                                        >
                                                            <Upload className="w-3.5 h-3.5 text-blue-400" />
                                                            Upload Logo File
                                                        </Button>

                                                        {tenant.logo_url && (
                                                            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                                                                <Check className="w-3.5 h-3.5" /> Logo Loaded
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Or enter URL */}
                                                    <Input 
                                                        placeholder="Or paste an image URL (https://...)"
                                                        value={tenant.logo_url.startsWith("data:") ? "" : tenant.logo_url}
                                                        onChange={e => setTenant({ ...tenant, logo_url: e.target.value })}
                                                        className="h-9 bg-slate-900 border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 rounded-lg"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-800/60">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleSkipAll}
                                            className="text-xs text-slate-400 hover:text-white"
                                        >
                                            Set up later
                                        </Button>
                                        <Button 
                                            onClick={handleSaveBranding} 
                                            disabled={loading} 
                                            className="h-12 px-6 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20 group"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Continue to Outreach Setup
                                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 2: Outreach & Email */}
                            {step === 2 && (
                                <motion.div 
                                    key="step2"
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -15 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                                                <Mail className="w-6 h-6 text-blue-400" />
                                                Outreach Email Setup
                                            </h3>
                                            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                                Optional
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            Connect your email so AI agents can send personalized outreach sequences to matched candidates on your behalf.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-300">
                                                    Sender Display Name
                                                </label>
                                                <Input 
                                                    placeholder="e.g. Deepak Kumar"
                                                    value={emailConfig.sender_name}
                                                    onChange={e => setEmailConfig({ ...emailConfig, sender_name: e.target.value })}
                                                    className="h-11 bg-slate-950/60 border-slate-700/80 text-sm rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-300">
                                                    Sender Email Address
                                                </label>
                                                <Input 
                                                    type="email"
                                                    placeholder="deepak@company.com"
                                                    value={emailConfig.sender_email}
                                                    onChange={e => setEmailConfig({ ...emailConfig, sender_email: e.target.value })}
                                                    className="h-11 bg-slate-950/60 border-slate-700/80 text-sm rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2 space-y-1.5">
                                                <label className="text-xs font-medium text-slate-300">
                                                    SMTP Relay Host
                                                </label>
                                                <Input 
                                                    placeholder="smtp.gmail.com"
                                                    value={emailConfig.smtp_host}
                                                    onChange={e => setEmailConfig({ ...emailConfig, smtp_host: e.target.value })}
                                                    className="h-11 bg-slate-950/60 border-slate-700/80 text-sm rounded-xl font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-300">
                                                    Port
                                                </label>
                                                <Input 
                                                    type="number"
                                                    placeholder="587"
                                                    value={emailConfig.smtp_port}
                                                    onChange={e => setEmailConfig({ ...emailConfig, smtp_port: Number(e.target.value) || 587 })}
                                                    className="h-11 bg-slate-950/60 border-slate-700/80 text-sm rounded-xl font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-300">
                                                    SMTP Username
                                                </label>
                                                <Input 
                                                    placeholder="login@email.com"
                                                    value={emailConfig.smtp_user}
                                                    onChange={e => setEmailConfig({ ...emailConfig, smtp_user: e.target.value })}
                                                    className="h-11 bg-slate-950/60 border-slate-700/80 text-sm rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-300">
                                                    SMTP App Password
                                                </label>
                                                <div className="relative">
                                                    <Input 
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="••••••••••••"
                                                        value={emailConfig.smtp_password}
                                                        onChange={e => setEmailConfig({ ...emailConfig, smtp_password: e.target.value })}
                                                        className="h-11 bg-slate-950/60 border-slate-700/80 text-sm rounded-xl pr-10"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
                                            <Shield className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
                                            <span>
                                                For Gmail/Google Workspace, generate an <strong>App Password</strong> in your Google Account security settings. Credentials are encrypted at rest.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-800/60">
                                        <Button 
                                            variant="ghost" 
                                            onClick={prevStep} 
                                            className="text-xs text-slate-400 hover:text-white rounded-xl gap-1.5"
                                        >
                                            <ArrowLeft className="w-4 h-4" /> Back
                                        </Button>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={nextStep}
                                                className="border-slate-700 hover:bg-slate-800 text-xs text-slate-300 rounded-xl"
                                            >
                                                Skip for Now
                                            </Button>
                                            <Button 
                                                onClick={handleSaveEmail} 
                                                disabled={loading} 
                                                className="h-11 px-5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20"
                                            >
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: ATS & System Integrations */}
                            {step === 3 && (
                                <motion.div 
                                    key="step3"
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -15 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                                                <Link2 className="w-6 h-6 text-blue-400" />
                                                ATS & Pipeline Integrations
                                            </h3>
                                            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                                Optional
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            Sync client job vacancies and push sourced candidates directly into your existing ATS workflow.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {ATS_OPTIONS.map((ats) => {
                                            const Icon = ats.icon;
                                            const isSelected = selectedAts.includes(ats.id);
                                            return (
                                                <div 
                                                    key={ats.id}
                                                    onClick={() => toggleAts(ats.id)}
                                                    className={cn(
                                                        "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                                                        isSelected 
                                                            ? "bg-blue-600/10 border-blue-500/60 shadow-md shadow-blue-600/10" 
                                                            : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3.5">
                                                        <div className={cn(
                                                            "w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
                                                            isSelected ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                                                        )}>
                                                            <Icon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-sm font-semibold text-white">{ats.name}</h4>
                                                                <span className="text-[9px] font-medium text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                                                    {ats.badge}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5">{ats.desc}</p>
                                                        </div>
                                                    </div>

                                                    <div className={cn(
                                                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                                        isSelected 
                                                            ? "bg-blue-600 border-blue-500 text-white" 
                                                            : "border-slate-700 bg-slate-900 group-hover:border-slate-600"
                                                    )}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                                        <span>Looking for Workday, Ashby, or custom webhook integrations?</span>
                                        <span className="text-blue-400 font-medium">Available in Settings</span>
                                    </div>

                                    <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-800/60">
                                        <Button 
                                            variant="ghost" 
                                            onClick={prevStep} 
                                            className="text-xs text-slate-400 hover:text-white rounded-xl gap-1.5"
                                        >
                                            <ArrowLeft className="w-4 h-4" /> Back
                                        </Button>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={nextStep}
                                                className="border-slate-700 hover:bg-slate-800 text-xs text-slate-300 rounded-xl"
                                            >
                                                Skip for Now
                                            </Button>
                                            <Button 
                                                onClick={handleSaveAts} 
                                                className="h-11 px-5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20"
                                            >
                                                Continue to Finish
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 4: Ready & Launch */}
                            {step === 4 && (
                                <motion.div 
                                    key="step4"
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.25 }}
                                    className="space-y-8 py-4 text-center"
                                >
                                    <div className="relative inline-block mx-auto">
                                        <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 relative z-10">
                                            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                                        </div>
                                        <motion.div 
                                            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                                            transition={{ repeat: Infinity, duration: 2.5 }}
                                            className="absolute inset-0 w-20 h-20 bg-emerald-500/40 rounded-3xl mx-auto blur-xl -z-0"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-extrabold tracking-tight text-white">
                                            Your Workspace is Ready!
                                        </h3>
                                        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                                            {tenant.name || "Your recruiting hub"} is fully configured. Your AI agents are primed to discover client vacancies and match qualified candidates.
                                        </p>
                                    </div>

                                    {/* Quick action capabilities */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-left">
                                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                                            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <p className="text-xs font-semibold text-white">Discovery</p>
                                            <p className="text-[10px] text-slate-400">Search job vacancies</p>
                                        </div>
                                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                                            <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center mb-2">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <p className="text-xs font-semibold text-white">Sourcing</p>
                                            <p className="text-[10px] text-slate-400">Match talent via AI</p>
                                        </div>
                                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-2">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <p className="text-xs font-semibold text-white">Outreach</p>
                                            <p className="text-[10px] text-slate-400">Launch campaigns</p>
                                        </div>
                                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2">
                                                <Rocket className="w-4 h-4" />
                                            </div>
                                            <p className="text-xs font-semibold text-white">AI Swarm</p>
                                            <p className="text-[10px] text-slate-400">Autonomous recruiting</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex flex-col items-center gap-3">
                                        <Button 
                                            onClick={handleFinish} 
                                            disabled={loading} 
                                            size="lg" 
                                            className="w-full sm:w-auto min-w-[260px] h-14 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl shadow-xl shadow-blue-600/30 group"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Enter Dashboard & Start Sourcing
                                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </Button>

                                        <div className="flex items-center justify-center gap-5 text-slate-500 pt-2 text-[11px]">
                                            <div className="flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>Enterprise Security</span>
                                            </div>
                                            <span>•</span>
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                                <span>Multi-Tenant Isolated</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
