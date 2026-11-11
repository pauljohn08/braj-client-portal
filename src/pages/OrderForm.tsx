import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SERVICES } from "@/lib/services";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";

export default function OrderForm() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("service") || "";
  const { user, isAdmin, isPartTimer, isPendingPartTimer, isLoading } = useAuth();
  const navigate = useNavigate();

  const [serviceId, setServiceId] = useState(preselected);
  const [tierId, setTierId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deadline, setDeadline] = useState("");
  const [chapterCount, setChapterCount] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasTitle, setHasTitle] = useState<"yes" | "no" | null>(null);
  const [wantUsToMakeTitle, setWantUsToMakeTitle] = useState<boolean | null>(null);
  const [chapter1To3File, setChapter1To3File] = useState<File | null>(null);
  const [questionnaireFile, setQuestionnaireFile] = useState<File | null>(null);
  const [dataExcelFile, setDataExcelFile] = useState<File | null>(null);
  const [screeningWillingToPay, setScreeningWillingToPay] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
    else if (!isLoading && user && isPendingPartTimer) navigate("/pending-parttimer");
    else if (!isLoading && user && isPartTimer && !isAdmin) navigate("/parttimer");
  }, [user, isAdmin, isPartTimer, isPendingPartTimer, isLoading, navigate]);

  const service = SERVICES.find((s) => s.id === serviceId);
  const isResearch = serviceId === "research";
  const isStatisticalAnalysis = serviceId === "statistical-analysis";
  const isValidationOfInstrument = serviceId === "validation-of-instrument";
  const requiresChapterQuestionnaireData = isStatisticalAnalysis || isValidationOfInstrument;

  const isExcelFile = (f: File) => /\.(xlsx|xls)$/i.test(f.name);

  const effectiveTitle = isResearch && hasTitle === "no" && wantUsToMakeTitle === true
    ? "Title to be provided by BRAJ"
    : isResearch && hasTitle === "no" && wantUsToMakeTitle === false
      ? "No title specified"
      : title;

  const canProceedResearch = isResearch && (
    hasTitle === "yes" ? title.trim() !== "" :
    hasTitle === "no" ? wantUsToMakeTitle !== null : false
  );
  const hasRequiredChapterQuestionnaireData = requiresChapterQuestionnaireData &&
    !!chapter1To3File && !!questionnaireFile && !!dataExcelFile && isExcelFile(dataExcelFile);
  const screeningOk = !service?.screeningQuestion || screeningWillingToPay === true;
  const tierOk = !service || service.tiers.length <= 1 || !!tierId || isStatisticalAnalysis || isResearch;
  const canProceedOrder = requiresChapterQuestionnaireData
    ? (!!serviceId && title.trim() !== "" && hasRequiredChapterQuestionnaireData && screeningOk && tierOk)
    : !isResearch
      ? (!!serviceId && title.trim() !== "" && screeningOk && tierOk)
      : (!!serviceId && canProceedResearch && screeningOk && tierOk);

  const handleSubmit = async () => {
    if (!user || !service) return;
    setSubmitting(true);

    try {
      const tier = isStatisticalAnalysis
        ? { name: "To be set by admin", priceValue: 0 }
        : isResearch
          ? { name: "To be set by admin", priceValue: 0 }
          : (service.tiers.find((t) => t.name === tierId) || service.tiers[0]);

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          service_type: service.name,
          pricing_tier: tier.name,
          title: effectiveTitle,
          instructions,
          deadline: deadline || null,
          chapter_count: chapterCount ? parseInt(chapterCount) : null,
          word_count: wordCount ? parseInt(wordCount) : null,
          amount: tier.priceValue ?? 0,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const uploadFile = async (file: File, pathPrefix: string) => {
        const filePath = `${user.id}/${order.id}/${pathPrefix}${file.name}`;
        const { error: uploadError } = await supabase.storage.from("input-files").upload(filePath, file);
        if (uploadError) throw uploadError;
        await supabase.from("order_files").insert({
          order_id: order.id,
          file_type: "input" as const,
          file_path: filePath,
          file_name: file.name,
          uploaded_by: user.id,
        });
      };

      if (requiresChapterQuestionnaireData && chapter1To3File && questionnaireFile && dataExcelFile) {
        await uploadFile(chapter1To3File, "chapters/");
        await uploadFile(questionnaireFile, "questionnaire/");
        await uploadFile(dataExcelFile, "data/");
      }

      for (const file of files) {
        const filePath = `${user.id}/${order.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("input-files")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        await supabase.from("order_files").insert({
          order_id: order.id,
          file_type: "input" as const,
          file_path: filePath,
          file_name: file.name,
          uploaded_by: user.id,
        });
      }

      toast({ title: "Order placed!", description: "Your order has been submitted successfully." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-12">
          <div className="container max-w-lg">
            <Card>
              <CardHeader>
                <CardTitle>Confirm Your Order</CardTitle>
                <CardDescription>Please review the details before submitting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><strong>Service:</strong> {service?.name}</div>
                <div><strong>Tier:</strong> {isStatisticalAnalysis || isResearch ? "To be set by admin" : (tierId || service?.tiers[0]?.name)}</div>
                <div><strong>Title:</strong> {effectiveTitle}</div>
                {instructions && <div><strong>Instructions:</strong> {instructions}</div>}
                {deadline && <div><strong>Deadline:</strong> {deadline}</div>}
                {chapterCount && <div><strong>Chapters:</strong> {chapterCount}</div>}
                {wordCount && <div><strong>Word Count:</strong> {wordCount}</div>}
                {requiresChapterQuestionnaireData && (chapter1To3File || questionnaireFile || dataExcelFile) && (
                  <div><strong>Required files:</strong>
                    <ul className="list-disc pl-4 mt-1">
                      {chapter1To3File && <li>Chapter 1 to 3: {chapter1To3File.name}</li>}
                      {questionnaireFile && <li>Questionnaire: {questionnaireFile.name}</li>}
                      {dataExcelFile && <li>Data (Excel): {dataExcelFile.name}</li>}
                    </ul>
                  </div>
                )}
                {files.length > 0 && (
                  <div><strong>Files:</strong> {files.map((f) => f.name).join(", ")}</div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
                    Go Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                    {submitting ? "Submitting..." : "Submit Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-lg">
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Place an Order</CardTitle>
                </div>
              </div>
              <CardDescription>Fill out the form below to place your order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={(v) => {
                  setServiceId(v);
                  setTierId("");
                  if (v !== "research") { setHasTitle(null); setWantUsToMakeTitle(null); setTitle(""); }
                  if (v !== "statistical-analysis") { setScreeningWillingToPay(null); }
                  if (v !== "statistical-analysis" && v !== "validation-of-instrument") { setChapter1To3File(null); setQuestionnaireFile(null); setDataExcelFile(null); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>
                    {SERVICES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {service && service.screeningQuestion && (
                <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Screening Question</Label>
                    <p className="text-sm">{service.screeningQuestion}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Pricing</Label>
                    <ul className="text-sm list-disc list-inside space-y-0.5">
                      {service.tiers.map((t) => (
                        <li key={t.name}>{t.name} — {t.price}</li>
                      ))}
                    </ul>
                    {isStatisticalAnalysis && (
                      <p className="text-xs text-muted-foreground mt-1">Admin will set the tier based on your requirements before payment.</p>
                    )}
                  </div>
                  <RadioGroup
                    value={screeningWillingToPay === null ? "" : screeningWillingToPay ? "yes" : "no"}
                    onValueChange={(v) => {
                      const val = v === "yes";
                      setScreeningWillingToPay(val);
                      if (!val) {
                        setTierId("");
                        setServiceId("");
                      }
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="screening-yes" />
                      <Label htmlFor="screening-yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="screening-no" />
                      <Label htmlFor="screening-no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                  {screeningWillingToPay === true && service.tiers.length > 1 && !isStatisticalAnalysis && (
                    <div className="space-y-2 pt-1">
                      <Label>Pricing Tier</Label>
                      <Select value={tierId} onValueChange={setTierId}>
                        <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                        <SelectContent>
                          {service.tiers.map((t) => (
                            <SelectItem key={t.name} value={t.name}>{t.name} — {t.price}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {service && service.tiers.length > 1 && !service.screeningQuestion && (
                <div className="space-y-2">
                  <Label>Pricing Tier</Label>
                  <Select value={tierId} onValueChange={setTierId}>
                    <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                    <SelectContent>
                      {service.tiers.map((t) => (
                        <SelectItem key={t.name} value={t.name}>{t.name} — {t.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isResearch && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Contact Baltazar Abobo for an agreement</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Admin will set the final amount before payment.</p>
                </div>
              )}

              {isResearch ? (
                <>
                  <div className="space-y-2">
                    <Label>Do you have a Title?</Label>
                    <RadioGroup
                      value={hasTitle ?? ""}
                      onValueChange={(v) => { setHasTitle(v as "yes" | "no"); setWantUsToMakeTitle(null); setTitle(""); }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="has-title-yes" />
                        <Label htmlFor="has-title-yes" className="font-normal cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="has-title-no" />
                        <Label htmlFor="has-title-no" className="font-normal cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {hasTitle === "yes" && (
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter your title" required />
                    </div>
                  )}
                  {hasTitle === "no" && (
                    <div className="space-y-2">
                      <Label>Do you want us to make a title?</Label>
                      <RadioGroup
                        value={wantUsToMakeTitle === null ? "" : wantUsToMakeTitle ? "yes" : "no"}
                        onValueChange={(v) => setWantUsToMakeTitle(v === "yes")}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="want-title-yes" />
                          <Label htmlFor="want-title-yes" className="font-normal cursor-pointer">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="want-title-no" />
                          <Label htmlFor="want-title-no" className="font-normal cursor-pointer">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" required />
                </div>
              )}

              <div className="space-y-2">
                <Label>Instructions / Notes</Label>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Any specific instructions..." />
              </div>

              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>

              {service?.hasChapterCount && (
                <div className="space-y-2">
                  <Label>Chapter Count</Label>
                  <Input type="number" value={chapterCount} onChange={(e) => setChapterCount(e.target.value)} min={1} />
                </div>
              )}

              {service?.hasWordCount && (
                <div className="space-y-2">
                  <Label>Word Count</Label>
                  <Input type="number" value={wordCount} onChange={(e) => setWordCount(e.target.value)} min={1} />
                </div>
              )}

              {requiresChapterQuestionnaireData ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Required: Chapter 1-3, Questionnaire, and Data file in Excel
                  </p>
                  <div className="space-y-2">
                    <Label>Chapter 1 to 3 (required)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="flex-1"
                        onChange={(e) => setChapter1To3File(e.target.files?.[0] ?? null)}
                      />
                      {chapter1To3File && <span className="text-xs text-muted-foreground">{chapter1To3File.name}</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Questionnaire (required)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xlsx,.xls"
                        className="flex-1"
                        onChange={(e) => setQuestionnaireFile(e.target.files?.[0] ?? null)}
                      />
                      {questionnaireFile && <span className="text-xs text-muted-foreground">{questionnaireFile.name}</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Data file in Excel (required)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        className="flex-1"
                        onChange={(e) => setDataExcelFile(e.target.files?.[0] ?? null)}
                      />
                      {dataExcelFile && (
                        <span className={`text-xs ${isExcelFile(dataExcelFile) ? "text-muted-foreground" : "text-destructive"}`}>
                          {dataExcelFile.name} {!isExcelFile(dataExcelFile) && "(must be .xlsx or .xls)"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Upload Files</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => document.getElementById("file-input")?.click()}>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {files.length > 0 ? `${files.length} file(s) selected` : "Click to upload files"}
                    </p>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => setShowConfirm(true)}
                disabled={!canProceedOrder}
              >
                Review Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
