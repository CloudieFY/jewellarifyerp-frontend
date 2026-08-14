import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Search, Package, Filter, Layers, Gem, Hash, Weight, Sparkles, Plus, Image as ImageIcon, Loader2, Trash2, ZoomIn, Pencil, MessageSquare, Send, Download, Copy } from "lucide-react";
import { useTenantAPI } from "@/lib/api";
import { type Product, inr } from "@/lib/storage";
import { useDebounce } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function CatalogPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();
  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };
  const { data: allItems = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: api.inventory.getAll });
  const { data: customersList = [] } = useQuery<any[]>({ queryKey: ["customers"], queryFn: api.customers.getAll });
  const createMutation = useApiMutation((data: Product) => api.inventory.create(data), ["inventory"]);
  const updateMutation = useApiMutation((data: { id: string; body: any }) => api.inventory.update(data.id, data.body), ["inventory"]);
  const deleteMutation = useApiMutation((id: string) => api.inventory.remove(id), ["inventory"]);
  
  const products = useMemo(() => (Array.isArray(allItems) ? allItems : []), [allItems]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [category, setCategory] = useState<string>("All");
  const [subcategory, setSubcategory] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waSelectedCustomer, setWaSelectedCustomer] = useState<string>("custom");
  const [waPhone, setWaPhone] = useState<string>("");
  const [waCustomMessage, setWaCustomMessage] = useState<string>("");
  const [waProductItem, setWaProductItem] = useState<Product | null>(null);

  const tenantSession = useMemo(() => {
    try {
      const stored = localStorage.getItem("jewelshop.tenantSession");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);
  const shopName = tenantSession?.shop?.shopName || "Our Jewellery Shop";
  
  const [draft, setDraft] = useState<Partial<Product>>({
    name: "",
    category: "Gold",
    subcategory: "",
    purity: "22K",
    netWeight: 0,
    ratePerGram: 7200,
    makingCharge: 0,
    stock: 0,
    imageUrl: "",
    imageUrls: [],
    note: "Catalog Item"
  });
  
  const categories = useMemo(() => {
    const cats = new Set(["Gold", "Silver", ...products.map(p => p.category)]);
    return ["All", ...Array.from(cats).filter(Boolean)];
  }, [products]);

  const subcategories = useMemo(() => {
    const relevantProducts = category === "All" ? products : products.filter(p => p.category === category);
    const subCats = new Set(relevantProducts.map(p => p.subcategory).filter(Boolean));
    return ["All", ...Array.from(subCats)];
  }, [products, category]);

  const filtered = products.filter(p => {
    const searchLower = debouncedQ.toLowerCase().trim();
    const matchesSearch = !searchLower ||
                          (p.name || "").toLowerCase().includes(searchLower) || 
                          (p.huid || "").toLowerCase().includes(searchLower) ||
                          (p.barcode || "").toLowerCase().includes(searchLower) ||
                          ((p as any).itemCode || "").toLowerCase().includes(searchLower) ||
                          ((p as any).sku || "").toLowerCase().includes(searchLower) ||
                          (p.subcategory || "").toLowerCase().includes(searchLower) ||
                          (p.purity || "").toLowerCase().includes(searchLower);
    const matchesCategory = category === "All" || p.category === category;
    const matchesSubcategory = subcategory === "All" || p.subcategory === subcategory;
    
    return matchesSearch && matchesCategory && matchesSubcategory;
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  
  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedFiltered = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Record<string, Product[]>> = {};
    paginatedFiltered.forEach(p => {
      const cat = p.category || "General";
      const subcat = p.subcategory || "General / Uncategorized";
      if (!groups[cat]) groups[cat] = {};
      if (!groups[cat][subcat]) groups[cat][subcat] = [];
      groups[cat][subcat].push(p);
    });
    return groups;
  }, [paginatedFiltered]);

  const handleImageChange = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 400; 
          let { width, height } = img;
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/webp", 0.5); 
          setDraft((prev) => ({ ...prev, imageUrls: [...(prev.imageUrls || []), compressedBase64] }));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleOpenEdit = (product: Product) => {
    const targetId = (product as any)._id || product.id;
    setEditingId(targetId);
    setDraft({
      name: product.name || "",
      category: product.category || "Gold",
      subcategory: product.subcategory || "",
      purity: product.purity || "22K",
      netWeight: product.netWeight || 0,
      ratePerGram: product.ratePerGram || 7200,
      makingCharge: product.makingCharge || 0,
      stock: product.stock || 0,
      imageUrl: product.imageUrl || "",
      imageUrls: product.imageUrls?.length ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
      note: product.note || "Catalog Item",
    });
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name) {
      toast.error("Item name is required.");
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          body: draft
        });
        toast.success("Catalog item updated successfully!");
        if (selectedProduct && ((selectedProduct as any)._id === editingId || selectedProduct.id === editingId)) {
          setSelectedProduct({ ...selectedProduct, ...draft } as Product);
        }
      } else {
        await createMutation.mutateAsync({ 
          ...draft,
          id: Date.now().toString(), 
          barcode: `CAT-${Date.now()}`,
          grossWeight: draft.netWeight || 0,
          stoneWeight: 0,
          makingChargePct: 0,
          gstPct: 3,
          huid: "",
          imageUrl: draft.imageUrls?.[0] || "",
        } as Product);
        toast.success("New item added to catalog!");
      }
      setAddOpen(false);
      setEditingId(null);
      setDraft({
        name: "",
        category: "Gold",
        subcategory: "",
        purity: "22K",
        netWeight: 0,
        ratePerGram: 7200,
        makingCharge: 0,
        stock: 0,
        imageUrl: "",
        imageUrls: [],
        note: "Catalog Item"
      });
    } catch (error) {
      console.error("Save error:", error);
      toast.error(editingId ? "Failed to update catalog item." : "Failed to add item to catalog.");
    }
  };

  const handleOpenWhatsAppModal = (prod?: Product | null) => {
    setWaProductItem(prod || null);
    setWaSelectedCustomer("custom");
    setWaPhone("");

    let defaultMsg = "";
    if (prod) {
      const metalValue = prod.netWeight * prod.ratePerGram;
      const making = prod.makingChargePct ? (metalValue * prod.makingChargePct) / 100 : prod.makingCharge;
      const totalEst = metalValue + making + (prod.stoneWeight || 0);

      const itemId = prod._id || prod.id;

      let viewLink = "";
      if (itemId) {
        viewLink = `${window.location.protocol}//${window.location.host}/v/${itemId}`;
      } else if (prod.imageUrl && (prod.imageUrl.startsWith("http://") || prod.imageUrl.startsWith("https://"))) {
        viewLink = prod.imageUrl;
      }

      defaultMsg = `✨ *${shopName}* ✨\n\nDear Customer,\nCheck out this design from our catalog:\n\n📌 *Item:* ${prod.name}\n🏷️ *Category:* ${prod.category}${prod.subcategory ? ` (${prod.subcategory})` : ''}\n✨ *Purity:* ${prod.purity}\n⚖️ *Net Weight:* ${prod.netWeight} g\n💰 *Est. Price:* ${inr(totalEst)}${viewLink ? `\n\n🖼️ *Click to View Photo & Details:*\n${viewLink}` : ''}\n\nInterested? Contact us or visit our store today! 💍✨`;
    } else {
      defaultMsg = `✨ *${shopName}* ✨\n\nDear Customer,\nExplore our latest Jewellery Catalog collection with exclusive designs in Gold, Silver, and Diamonds!\n\nContact us or visit our store today to place your order! 💍✨`;
    }

    setWaCustomMessage(defaultMsg);
    setWaModalOpen(true);
  };

  const handleSelectWaCustomer = (custId: string) => {
    setWaSelectedCustomer(custId);
    if (custId === "custom") {
      setWaPhone("");
      return;
    }
    const found = customersList.find((c) => (c._id || c.id) === custId);
    if (found) {
      setWaPhone(found.phone || found.mobile || "");
    }
  };

  const imageToPngBlob = (imageUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context error"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("PNG Blob conversion failed"));
        }, "image/png");
      };
      img.onerror = (e) => reject(e);
      img.src = imageUrl;
    });
  };

  const handleDownloadWaImage = () => {
    if (!waProductItem?.imageUrl) return;
    const a = document.createElement("a");
    a.href = waProductItem.imageUrl;
    a.download = `${waProductItem.name.replace(/\s+/g, "_")}_design.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Design image downloaded to your device!");
  };

  const handleCopyWaImage = async () => {
    if (!waProductItem?.imageUrl) return;
    try {
      const pngBlob = await imageToPngBlob(waProductItem.imageUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
      ]);
      toast.success("Image copied to clipboard! Press Ctrl+V (Paste) in WhatsApp chat box.");
    } catch (err) {
      console.error("Clipboard copy error:", err);
      toast.info("Image copy not supported by browser. Click 'Save Photo' instead.");
    }
  };

  const handleSendWhatsApp = async () => {
    if (!waPhone.trim()) {
      toast.error("Please enter customer's mobile number.");
      return;
    }
    let cleanPhone = waPhone.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    // Auto-copy PNG image to clipboard so user can press Ctrl+V in WhatsApp chat window
    if (waProductItem?.imageUrl) {
      try {
        const pngBlob = await imageToPngBlob(waProductItem.imageUrl);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
        toast.success(`Opening chat for +${cleanPhone}! Image copied to clipboard — press Ctrl+V to paste photo in WhatsApp.`, { duration: 7000 });
      } catch (err) {
        console.error("Auto copy error:", err);
        toast.info(`Opening chat for +${cleanPhone}! Click 'Save Photo' to attach photo.`, { duration: 5000 });
      }
    } else {
      toast.success(`Opening direct WhatsApp chat for +${cleanPhone}!`);
    }

    const encoded = encodeURIComponent(waCustomMessage);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
    setWaModalOpen(false);
  };

  const handleKeyNav = useFormKeyboardNav(handleSave);

  return (
    <Layout>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage showcase items and client-facing designs</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            onClick={() => handleOpenWhatsAppModal(null)}
          >
            <MessageSquare className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" /> Share Catalog on WhatsApp
          </Button>

          <Dialog open={addOpen} onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              setEditingId(null);
              setDraft({
                name: "",
                category: "Gold",
                subcategory: "",
                purity: "22K",
                netWeight: 0,
                ratePerGram: 7200,
                makingCharge: 0,
                stock: 0,
                imageUrl: "",
                imageUrls: [],
                note: "Catalog Item"
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Add Catalog Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl" onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Catalog Item" : "Add New Catalog Item"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Update details and showcase images for this catalog item." : "Create a new product listing to showcase in your store catalog."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Product Images</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/20">
                      <ImageIcon className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground font-medium">Upload</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageChange(e.target.files)} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {draft.imageUrls?.map((img, idx) => (
                        <div key={idx} className="w-20 h-20 shrink-0 rounded-lg border border-border overflow-hidden relative group">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setDraft(prev => ({ ...prev, imageUrls: prev.imageUrls?.filter((_, i) => i !== idx) }))}
                            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Item Name *</Label>
                  <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Diamond Necklace" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Category</Label><Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="Gold, Silver..." /></div>
                  <div className="space-y-1.5"><Label>Subcategory</Label><Input value={draft.subcategory || ""} onChange={e => setDraft({ ...draft, subcategory: e.target.value })} placeholder="Necklace, Ring..." /></div>
                  <div className="space-y-1.5"><Label>Purity</Label><Input value={draft.purity} onChange={e => setDraft({ ...draft, purity: e.target.value })} placeholder="22K, 18K..." /></div>
                  <div className="space-y-1.5"><Label>Weight (g)</Label><Input type="number" value={draft.netWeight || ""} onChange={e => setDraft({ ...draft, netWeight: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Rate (₹/g)</Label><Input type="number" value={draft.ratePerGram || ""} onChange={e => setDraft({ ...draft, ratePerGram: Number(e.target.value) })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAddOpen(false); setEditingId(null); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {editingId ? "Update Item" : "Save Item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            className="pl-9 bg-background" 
            placeholder="Search by name or HUID..." 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
          />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <Select value={category} onValueChange={(val) => { setCategory(val); setSubcategory("All"); setPage(1); }}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Category" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c === "All" ? "All Categories" : c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select value={subcategory} onValueChange={(val) => { setSubcategory(val); setPage(1); }}>
              <SelectTrigger className="bg-background">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Subcategory" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {subcategories.map(sc => (
                  <SelectItem key={sc} value={sc}>{sc === "All" ? "All Subcategories" : sc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Package className="w-6 h-6 mr-2 animate-pulse" /> Loading catalog...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
          <Gem className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
          <h3 className="text-lg font-medium text-foreground">No products found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedProducts).map(([cat, subGroups]) => {
            const catItemCount = Object.values(subGroups).reduce((sum, arr) => sum + arr.length, 0);
            return (
              <div key={cat} className="space-y-6 bg-card/40 rounded-xl p-5 border border-border/60 shadow-sm">
                <div className="flex items-center justify-between border-b pb-3 border-border/60">
                  <h2 className="text-xl font-bold font-display flex items-center gap-2 text-foreground">
                    <Filter className="w-5 h-5 text-primary" />
                    <span>Category: {cat}</span>
                    <Badge variant="secondary" className="text-xs ml-1">{catItemCount} {catItemCount === 1 ? 'item' : 'items'}</Badge>
                  </h2>
                </div>

                <div className="space-y-6">
                  {Object.entries(subGroups).map(([subcat, prods]) => (
                    <div key={subcat} className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border/50 w-fit">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span>Subcategory: <strong className="text-foreground">{subcat}</strong></span>
                        <Badge variant="outline" className="text-[10px] ml-1 bg-background">{prods.length}</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {prods.map(p => {
                          const metalValue = p.netWeight * p.ratePerGram;
                          const making = p.makingChargePct ? (metalValue * p.makingChargePct) / 100 : p.makingCharge;
                          const totalEst = metalValue + making + (p.stoneWeight || 0);

                          return (
                            <Card key={(p as any)._id || p.id} className="overflow-hidden flex flex-col group hover:shadow-lg transition-all cursor-pointer border-border hover:border-primary/50" onClick={() => setSelectedProduct(p)}>
                              <div className="aspect-square bg-muted relative overflow-hidden">
                                {(p.imageUrls?.[0] || p.imageUrl) ? (
                                  <img 
                                    src={p.imageUrls?.[0] || p.imageUrl} 
                                    alt={p.name} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <Gem className="w-12 h-12 mb-2" />
                                    <span className="text-xs font-medium">No Image</span>
                                  </div>
                                )}
                                {p.stock <= 0 && p.note !== "Catalog Item" && (
                                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[1px]">
                                    <Badge variant="destructive" className="text-xs uppercase tracking-widest px-3 py-1">Out of Stock</Badge>
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="w-8 h-8 rounded-full shadow-md bg-white hover:bg-slate-100 text-slate-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEdit(p);
                                    }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    className="w-8 h-8 rounded-full shadow-md"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (window.confirm("Are you sure you want to delete this catalog item?")) {
                                        try {
                                          await deleteMutation.mutateAsync((p as any)._id || p.id);
                                          toast.success("Item deleted from database.");
                                        } catch (error) {
                                          toast.error("Failed to delete item.");
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <CardContent className="p-4 flex-1 flex flex-col bg-card">
                                <h3 className="font-semibold text-base line-clamp-1 mb-1" title={p.name}>{p.name}</h3>
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{p.category}</Badge>
                                  {p.subcategory && (
                                    <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 bg-primary/10 text-primary border-primary/20">{p.subcategory}</Badge>
                                  )}
                                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{p.purity}</Badge>
                                </div>
                                <div className="mt-auto pt-3 border-t border-border space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Net Wt</span>
                                      <span className="font-medium text-foreground">{p.netWeight} g</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Est. Price</span>
                                      <span className="font-bold text-primary">{inr(totalEst)}</span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs border-emerald-500/30 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenWhatsAppModal(p);
                                      }}
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" /> WhatsApp
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="flex-1 text-xs bg-primary/90 hover:bg-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = `/orders?createForItem=${encodeURIComponent((p as any)._id || p.id)}`;
                                      }}
                                    >
                                      Create Order
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <div className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={(v) => { if (!v) { setSelectedProduct(null); setActiveImageIndex(0); } }}>
        <DialogContent className="max-w-3xl overflow-hidden p-0 sm:rounded-2xl" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
          {selectedProduct && (() => {
            const displayImages = selectedProduct.imageUrls?.length ? selectedProduct.imageUrls : (selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []);
            const currentImage = displayImages[activeImageIndex] || displayImages[0];
            return (
              <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
              {/* Left: Image */}
              <div 
                className={`w-full md:w-1/2 bg-muted/30 relative flex flex-col items-center justify-center aspect-square md:aspect-auto md:min-h-112.5 group/img ${currentImage ? 'cursor-zoom-in' : ''}`}
                onClick={() => {
                  if (currentImage) {
                    setFullScreenImage(currentImage);
                  }
                }}
              >
                {currentImage ? (
                  <>
                    <img src={currentImage} alt={selectedProduct.name} className={`absolute inset-0 w-full h-full object-contain p-6 drop-shadow-md transition-transform duration-300 group-hover/img:scale-[1.02] ${displayImages.length > 1 ? "pb-20" : ""}`} />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors pointer-events-none flex items-center justify-center">
                      <ZoomIn className="w-10 h-10 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center opacity-50">
                    <Gem className="w-16 h-16 mb-2" />
                    <span className="font-medium">No Image</span>
                  </div>
                )}
                {displayImages.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 z-20">
                    {displayImages.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        className={`w-12 h-12 object-cover rounded-md cursor-pointer border-2 shadow-sm transition-all hover:scale-105 bg-background ${idx === activeImageIndex ? 'border-primary scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`} 
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(idx); }}
                      />
                    ))}
                  </div>
                )}
                {selectedProduct.stock <= 0 && selectedProduct.note !== "Catalog Item" && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="destructive" className="uppercase tracking-widest shadow-sm">Out of Stock</Badge>
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col">
                <DialogHeader className="text-left space-y-1 mb-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none">{selectedProduct.category}</Badge>
                    {selectedProduct.subcategory && <Badge variant="outline" className="border-border">{selectedProduct.subcategory}</Badge>}
                    <Badge variant="outline" className="border-border">{selectedProduct.purity}</Badge>
                  </div>
                  <DialogTitle className="text-2xl font-display leading-tight">{selectedProduct.name}</DialogTitle>
                  <DialogDescription className="text-sm line-clamp-3">
                    {selectedProduct.note || "No additional description available for this item."}
                  </DialogDescription>
                </DialogHeader>
                <div className="absolute top-4 right-12 bg-background rounded-md shadow-sm border border-border z-10 flex items-center divide-x border-border">
                  <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-r-none" onClick={() => handleOpenEdit(selectedProduct)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-l-none" onClick={async () => {
                    if (window.confirm("Are you sure you want to delete this catalog item?")) {
                      try {
                        await deleteMutation.mutateAsync((selectedProduct as any)._id || selectedProduct.id);
                        toast.success("Item deleted from database.");
                        setSelectedProduct(null);
                      } catch (error) {
                        toast.error("Failed to delete item.");
                      }
                    }
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4 flex-1 mt-2">
                  <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border border-border">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Weight className="w-3.5 h-3.5" /> Net Weight
                      </span>
                      <span className="font-semibold">{selectedProduct.netWeight} g</span>
                    </div>
                    <div>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Weight className="w-3.5 h-3.5" /> Gross Weight
                      </span>
                      <span className="font-semibold">{selectedProduct.grossWeight || selectedProduct.netWeight} g</span>
                    </div>
                    {selectedProduct.huid && (
                      <div className="col-span-2 border-t border-border pt-3 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Hash className="w-3.5 h-3.5" /> HUID
                        </span>
                        <span className="font-semibold tracking-wider">{selectedProduct.huid}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary/70 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Price Estimate
                    </h4>
                    {(() => {
                      const metalValue = selectedProduct.netWeight * selectedProduct.ratePerGram;
                      const making = selectedProduct.makingChargePct ? (metalValue * selectedProduct.makingChargePct) / 100 : selectedProduct.makingCharge;
                      const estTotal = metalValue + making + (selectedProduct.stoneWeight || 0);
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Metal (@ {inr(selectedProduct.ratePerGram)}/g)</span>
                            <span className="font-medium">{inr(metalValue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Making {selectedProduct.makingChargePct ? `(${selectedProduct.makingChargePct}%)` : ''}</span>
                            <span className="font-medium">{inr(making)}</span>
                          </div>
                          {selectedProduct.stoneWeight > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Stone</span>
                              <span className="font-medium">{inr(selectedProduct.stoneWeight)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t border-primary/10 pt-2 mt-2">
                            <span className="font-semibold text-primary">Est. Total (ex. GST)</span>
                            <span className="text-xl font-bold text-primary">{inr(estTotal)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button
                      variant="outline"
                      className="flex-1 border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                      onClick={() => {
                        const p = selectedProduct;
                        setSelectedProduct(null);
                        handleOpenWhatsAppModal(p);
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-2 text-emerald-600" /> Share on WhatsApp
                    </Button>
                    <Button
                      className="flex-1 bg-primary text-white hover:bg-primary/90"
                      onClick={() => {
                        window.location.href = `/orders?createForItem=${encodeURIComponent((selectedProduct as any)._id || selectedProduct.id)}`;
                      }}
                    >
                      Create Custom Order
                    </Button>
                  </div>
                </div>
              </div>
            </div>);
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Send Catalog on WhatsApp
            </DialogTitle>
            <DialogDescription>
              Share product details directly to your customer's WhatsApp chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {waProductItem && (
              <div className="bg-muted/40 p-3 rounded-lg border border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {waProductItem.imageUrl ? (
                    <img src={waProductItem.imageUrl} alt={waProductItem.name} className="w-12 h-12 object-cover rounded-md border shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0 border">
                      <Gem className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{waProductItem.name}</div>
                    <div className="text-xs text-muted-foreground">{waProductItem.category} • {waProductItem.purity} • {waProductItem.netWeight}g</div>
                  </div>
                </div>

                {waProductItem.imageUrl && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={handleDownloadWaImage} title="Save photo to send on WhatsApp">
                      <Download className="w-3.5 h-3.5 mr-1" /> Save Photo
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={handleCopyWaImage} title="Copy photo to clipboard">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Photo
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Customer (Optional)</Label>
              <Select value={waSelectedCustomer} onValueChange={handleSelectWaCustomer}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select existing customer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">-- Enter Mobile Number Manually --</SelectItem>
                  {customersList.map((c) => (
                    <SelectItem key={c._id || c.id} value={c._id || c.id}>
                      {c.name} ({c.phone || c.mobile || "No phone"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Customer Mobile Number *</Label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-md border border-input bg-muted text-xs text-muted-foreground font-semibold">
                  +91
                </span>
                <Input
                  className="text-xs"
                  placeholder="Enter 10-digit mobile number"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message Preview</Label>
              <textarea
                rows={6}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono leading-relaxed resize-none"
                value={waCustomMessage}
                onChange={(e) => setWaCustomMessage(e.target.value)}
              />
              <p className="text-[11px] font-medium text-emerald-800 bg-emerald-50/80 p-2 rounded border border-emerald-200 mt-1">
                🚀 <b>Direct Customer Chat:</b> Clicking the button opens the WhatsApp chat <b>directly for the customer's phone number</b> with all details pre-filled. Design image is auto-copied — just press <b>Ctrl+V (Paste)</b> to attach photo!
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setWaModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={handleSendWhatsApp}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Open Direct Customer Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullScreenImage} onOpenChange={(v) => !v && setFullScreenImage(null)}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-black/95 shadow-none sm:rounded-none flex items-center justify-center [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:hover:text-white" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Image Zoom</DialogTitle>
          {fullScreenImage && (
            <img src={fullScreenImage} alt="Zoomed" className="w-full h-full object-contain p-4" />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}