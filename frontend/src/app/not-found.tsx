import Link from "next/link";
import { FileQuestion, ArrowLeft, Home, Briefcase, Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-8 md:p-10 text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-sm">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            Error 404
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 pt-1">Page Not Found</h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            The page you are looking for has been moved, renamed, or does not exist.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
          <Link
            href="/portal"
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all group"
          >
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
              <Compass className="w-4 h-4 text-emerald-600" />
              Candidate Portal
            </div>
            <p className="text-xs text-slate-500">
              Browse jobs, resume tailor, and tracked applications.
            </p>
          </Link>

          <Link
            href="/dashboard"
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group"
          >
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm mb-1">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              Recruiter Dashboard
            </div>
            <p className="text-xs text-slate-500">
              Requisitions, talent pipelines, and AI sourcing.
            </p>
          </Link>
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button
              variant="outline"
              className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Return to Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
