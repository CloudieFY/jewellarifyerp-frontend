import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileQuestion,
  ArrowLeft,
  LayoutDashboard,
  Compass,
  AlertCircle,
  Home,
} from "lucide-react";

interface NotFoundPageProps {
  insideTenant?: boolean;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ insideTenant }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSession, superAdminSession } = useAuth();

  const isTenant = insideTenant || !!tenantSession;
  const isSuperAdmin = !!superAdminSession;

  const content = (
    <div className="flex flex-col items-center justify-center min-h-[75vh] p-4 sm:p-6 text-center">
      <div className="max-w-xl w-full space-y-6">
        {/* Animated Icon & Badge */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse"></div>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-xl shadow-orange-500/20 text-white relative z-10 border border-white/20">
            <FileQuestion className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
        </div>

        {/* Header Titles */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
            <AlertCircle className="w-3.5 h-3.5" /> Error 404
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Page Not Available / Invalid URL
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium">
            यह पेज उपलब्ध नहीं है या दर्ज किया गया URL गलत है।
          </p>
        </div>

        {/* Display Current URL */}
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 max-w-md mx-auto overflow-hidden">
          <span className="text-slate-400 font-sans font-semibold">Entered URL:</span>
          <code className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-amber-600 dark:text-amber-400 truncate max-w-[280px]">
            {location.pathname}
          </code>
        </div>

        {/* Helpful Suggestions Card */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg rounded-2xl text-left overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              <Compass className="w-4 h-4 text-[#FA8112]" /> Please check the following / कृपया निम्नलिखित की जांच करें:
            </div>
            <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 pl-1">
              <li className="flex items-start gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#FA8112] mt-1.5 flex-shrink-0"></span>
                <span><strong>Correct URL spelling:</strong> Ensure there are no typos, extra characters, or missing hyphens in the address bar.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#FA8112] mt-1.5 flex-shrink-0"></span>
                <span><strong>Access rights:</strong> Some modules require specific permissions or an upgraded plan.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#FA8112] mt-1.5 flex-shrink-0"></span>
                <span><strong>Moved page:</strong> The feature or page might have been updated or moved to a new route.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Navigation Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-6 h-11 rounded-xl font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back / पीछे जाएं
          </Button>

          {isTenant ? (
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full sm:w-auto px-6 h-11 rounded-xl font-bold bg-[#FA8112] hover:bg-[#FA8112]/90 text-white shadow-md shadow-orange-500/20"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Go to Dashboard / डैशबोर्ड पर जाएं
            </Button>
          ) : isSuperAdmin ? (
            <Button
              onClick={() => navigate("/superadmin")}
              className="w-full sm:w-auto px-6 h-11 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Super Admin Dashboard
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto px-6 h-11 rounded-xl font-bold bg-[#FA8112] hover:bg-[#FA8112]/90 text-white shadow-md shadow-orange-500/20"
            >
              <Home className="w-4 h-4 mr-2" /> Go to Login / लॉग इन करें
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (insideTenant) {
    return <Layout>{content}</Layout>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      {content}
    </div>
  );
};

export default NotFoundPage;
