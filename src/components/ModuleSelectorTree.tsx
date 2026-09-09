import React, { useState, useMemo } from "react";
import {
  Layers,
  Search,
  Zap,
  Sparkles,
  Crown,
  CheckCircle2,
  XCircle
} from "lucide-react";
import {
  APP_MODULES,
  AppModule,
  getPageDefaultTier,
  getDefaultPagesForPlan,
  getDefaultModulesForPlan
} from "@/lib/subscriptionModules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ModuleSelectorTreeProps {
  selectedPages: string[];
  selectedModules: string[];
  onPagesChange: (pages: string[]) => void;
  onModulesChange: (modules: string[]) => void;
  onPlanQuickSelect?: (plan: string) => void;
  currentPlan?: string;
}

export const ModuleSelectorTree: React.FC<ModuleSelectorTreeProps> = ({
  selectedPages = [],
  selectedModules = [],
  onPagesChange,
  onModulesChange,
  onPlanQuickSelect
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "spark" | "hero" | "prime">("all");

  const handleModuleToggle = (module: AppModule) => {
    const pageIds = module.pages.map((p) => p.id);
    const allChecked = pageIds.every((id) => selectedPages.includes(id));

    let updatedPages: string[];
    let updatedModules: string[];

    if (allChecked) {
      updatedPages = selectedPages.filter((id) => !pageIds.includes(id));
      updatedModules = selectedModules.filter((id) => id !== module.id);
    } else {
      const pagesToAdd = pageIds.filter((id) => !selectedPages.includes(id));
      updatedPages = [...selectedPages, ...pagesToAdd];
      updatedModules = selectedModules.includes(module.id)
        ? selectedModules
        : [...selectedModules, module.id];
    }

    onPagesChange(updatedPages);
    onModulesChange(updatedModules);
  };

  const handlePageToggle = (module: AppModule, pageId: string) => {
    const isChecked = selectedPages.includes(pageId);
    let updatedPages: string[];

    if (isChecked) {
      updatedPages = selectedPages.filter((id) => id !== pageId);
    } else {
      updatedPages = [...selectedPages, pageId];
    }

    const modulePageIds = module.pages.map((p) => p.id);
    const allModulePagesChecked = modulePageIds.every((id) => updatedPages.includes(id));

    let updatedModules = [...selectedModules];
    if (allModulePagesChecked && !updatedModules.includes(module.id)) {
      updatedModules.push(module.id);
    } else if (!allModulePagesChecked && updatedModules.includes(module.id)) {
      updatedModules = updatedModules.filter((id) => id !== module.id);
    }

    onPagesChange(updatedPages);
    onModulesChange(updatedModules);
  };

  const handleApplyPreset = (tier: string) => {
    const pages = getDefaultPagesForPlan(tier);
    const modules = getDefaultModulesForPlan(tier);
    onPagesChange(pages);
    onModulesChange(modules);
    if (onPlanQuickSelect) {
      onPlanQuickSelect(tier);
    }
  };

  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return APP_MODULES.map((module) => {
      const pages = module.pages.filter((page) => {
        const matchesQuery =
          !q ||
          page.name.toLowerCase().includes(q) ||
          page.route.toLowerCase().includes(q) ||
          page.description.toLowerCase().includes(q) ||
          module.name.toLowerCase().includes(q);

        const pageTier = getPageDefaultTier(page.id);
        const matchesTier = tierFilter === "all" || pageTier === tierFilter;

        return matchesQuery && matchesTier;
      });

      return {
        ...module,
        filteredPages: pages
      };
    }).filter((m) => m.filteredPages.length > 0);
  }, [searchQuery, tierFilter]);

  const renderTierBadge = (tier: 'spark' | 'hero' | 'prime') => {
    if (tier === 'spark') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
          <Zap className="w-3 h-3 text-amber-600 fill-amber-500/30" /> Spark
        </span>
      );
    }
    if (tier === 'hero') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
          <Sparkles className="w-3 h-3 text-indigo-600" /> Hero
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
        <Crown className="w-3 h-3 text-emerald-600" /> Prime
      </span>
    );
  };

  const totalPagesCount = APP_MODULES.flatMap((m) => m.pages).length;

  return (
    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      
      {/* TOP HEADER & PRESETS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-100 text-[#FA8112] flex items-center justify-center border border-orange-200 font-bold shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
              Module & Page Subscription Permissions
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Configure allowed modules and features for this showroom ({selectedPages.length}/{totalPagesCount} pages enabled)
            </p>
          </div>
        </div>

        {/* QUICK PRESET TIER BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-slate-500 uppercase mr-1">Apply Tier Preset:</span>
          
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleApplyPreset("spark")}
            className="h-8 px-3 text-xs font-extrabold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-amber-600 fill-amber-500/30" /> Spark Tier
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleApplyPreset("hero")}
            className="h-8 px-3 text-xs font-extrabold border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Hero Tier
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleApplyPreset("prime")}
            className="h-8 px-3 text-xs font-extrabold border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl"
          >
            <Crown className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Prime Tier (All)
          </Button>
        </div>
      </div>

      {/* SEARCH AND TIER FILTER TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search module name, sub-page, or route URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 text-xs">
          <span className="text-[11px] font-extrabold text-slate-500 px-2 uppercase">Filter Tier:</span>
          {(["all", "spark", "hero", "prime"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={`px-3 py-1 rounded-lg font-extrabold text-xs transition cursor-pointer ${
                tierFilter === tier
                  ? "bg-white text-[#FA8112] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tier === "all" ? "ALL" : tier.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* MODULE CARDS CONTAINER WITH ROWS AND COLUMNS TABLE */}
      <div className="space-y-4">
        {filteredModules.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 font-semibold text-xs">
            No modules or pages match your filter search query.
          </div>
        ) : (
          filteredModules.map((module) => {
            const modulePageIds = module.pages.map((p) => p.id);
            const checkedCount = modulePageIds.filter((id) => selectedPages.includes(id)).length;
            const isFullyChecked = checkedCount === modulePageIds.length;
            const isPartiallyChecked = checkedCount > 0 && !isFullyChecked;

            return (
              <div
                key={module.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
              >
                {/* MODULE SECTION BANNER HEADER */}
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`module-check-${module.id}`}
                      checked={isFullyChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallyChecked;
                      }}
                      onChange={() => handleModuleToggle(module)}
                      className="h-4 w-4 rounded border-slate-600 text-[#FA8112] focus:ring-[#FA8112] cursor-pointer"
                    />

                    <label
                      htmlFor={`module-check-${module.id}`}
                      className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2 cursor-pointer"
                    >
                      <span>{module.name}</span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                        {checkedCount} / {modulePageIds.length} Pages Enabled
                      </span>
                    </label>
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium hidden md:block">
                    {module.description}
                  </div>
                </div>

                {/* TABLE OF SUB-PAGES (ROW & COLUMN) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 text-[10.5px] uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-12 text-center">Select</th>
                        <th className="py-2.5 px-4">Sub-Page / Feature Name</th>
                        <th className="py-2.5 px-4">Route Path</th>
                        <th className="py-2.5 px-4 text-center w-32">Default Tier</th>
                        <th className="py-2.5 px-4 text-center w-32">Access Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {module.filteredPages.map((page) => {
                        const isChecked = selectedPages.includes(page.id);
                        const defaultTier = getPageDefaultTier(page.id);

                        return (
                          <tr
                            key={page.id}
                            onClick={() => handlePageToggle(module, page.id)}
                            className={`transition-colors cursor-pointer ${
                              isChecked ? "bg-amber-50/40 hover:bg-amber-50/80" : "bg-white hover:bg-slate-50"
                            }`}
                          >
                            <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handlePageToggle(module, page.id)}
                                className="h-4 w-4 rounded border-slate-300 text-[#FA8112] focus:ring-[#FA8112] cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 text-xs">{page.name}</div>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                {page.description}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <code className="text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded">
                                {page.route}
                              </code>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {renderTierBadge(defaultTier)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {isChecked ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                                  <XCircle className="w-3 h-3 text-slate-400" /> Disabled
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
