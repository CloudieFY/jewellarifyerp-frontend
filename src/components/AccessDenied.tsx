import React from "react";
import { Lock, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface AccessDeniedProps {
  pageName?: string;
  requiredTier?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  pageName = "This Feature",
  requiredTier = "Hero / Prime",
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <Card className="max-w-lg w-full bg-white border-slate-200 shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-3">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Feature Not Included</h2>
          <p className="text-xs text-amber-100 mt-1 font-medium">
            {pageName} is restricted under your shop's current subscription plan.
          </p>
        </div>

        <CardContent className="p-6 space-y-5 text-center">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-[#FA8112]" /> Subscription Access Required
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              To unlock <strong>{pageName}</strong> along with advanced modules, please contact your platform administrator or upgrade your subscription plan to <strong>{requiredTier}</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="flex-1 font-bold border-slate-300 rounded-xl h-11"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => navigate("/profile")}
              className="flex-1 bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold rounded-xl h-11 shadow-md"
            >
              View Shop Subscription <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
